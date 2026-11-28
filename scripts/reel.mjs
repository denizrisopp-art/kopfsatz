// Kopfsatz: baut das Reel des Tages.
// Ablauf: nächsten geprüften Eintrag aus bank/zitate.json nehmen -> Stimme über n8n (ElevenLabs) -> Szenen nach Stimme timen -> Remotion -> out/reel.mp4
import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { bundle } from '@remotion/bundler';
import { renderMedia, selectComposition } from '@remotion/renderer';

const FPS = 30;
const MIN = [45, 110, 60, 150, 54, 66, 66]; // Mindestlänge je Szene in Bildern
const bank = JSON.parse(fs.readFileSync('bank/zitate.json', 'utf8'));
const wunsch = (process.env.EINTRAG_ID || '').trim();
const eintrag = wunsch
  ? bank.find((e) => e.id === wunsch)
  : bank.filter((e) => e.status === 'geprueft').sort((a, b) => a.id.localeCompare(b.id))[0];
if (!eintrag) {
  console.log('KEIN_EINTRAG');
  fs.appendFileSync(process.env.GITHUB_OUTPUT || '/dev/null', 'fertig=nein\n');
  process.exit(0);
}
if (!Array.isArray(eintrag.sprechtext) || eintrag.sprechtext.length !== 7) throw new Error('sprechtext muss 7 Teile haben: ' + eintrag.id);
console.log('Eintrag:', eintrag.id);

// 1) Stimme mit Zeitstempeln (n8n ruft ElevenLabs auf, der Schlüssel bleibt in n8n)
const teile = eintrag.sprechtext.map((t) => String(t).replace(/\s+/g, ' ').trim());
const volltext = teile.join(' ');
const antwort = await fetch(process.env.N8N_STIMME_URL, {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ id: eintrag.id }),
});
const tts = await antwort.json().catch(() => ({}));
if (!tts.audio_base64 || !tts.alignment) throw new Error('Stimme fehlt: ' + JSON.stringify(tts).slice(0, 300));
if (tts.text && tts.text !== volltext) console.log('Hinweis: Text aus n8n weicht ab');
const pub = path.resolve('public');
fs.mkdirSync(pub, { recursive: true });
// Tempo: seit 27.11. abends 1,0 = Stimme unverändert (natürliches Sprechtempo der Stimme, keine Nachbeschleunigung,
// die klang maschinell). Nur zum Testen per Umgebungsvariable TEMPO änderbar; Zeitstempel werden dann umgerechnet.
const TEMPO = Number(process.env.TEMPO || 1.0);
fs.writeFileSync(path.join(pub, 'stimme-roh.mp3'), Buffer.from(tts.audio_base64, 'base64'));
if (TEMPO !== 1) {
  execSync(`npx remotion ffmpeg -y -loglevel error -i "${path.join(pub, 'stimme-roh.mp3')}" -filter:a "atempo=${TEMPO}" -b:a 192k "${path.join(pub, 'stimme.mp3')}"`, { stdio: 'inherit' });
} else {
  fs.copyFileSync(path.join(pub, 'stimme-roh.mp3'), path.join(pub, 'stimme.mp3'));
}
console.log('Stimme:', tts.modell || 'unbekannt', '| Tempo', TEMPO);
const al = tts.alignment;
const zS = al.character_start_times_seconds.map((x) => x / TEMPO);
const zE = al.character_end_times_seconds.map((x) => x / TEMPO);
const ende = zE[zE.length - 1];

// 2) Szenen nach der Stimme timen
const pos = [];
let p = 0;
teile.forEach((t) => { pos.push(p); p += t.length + 1; });
const zeit = (i) => zS[Math.min(i, zS.length - 1)];
// Seit 27.11. abends: Jede Szene spielt nur ihren Satz plus eine kurze natürliche Atempause.
// Vorher lief die ganze Pause der Stimme plus 0,2 s Polster mit: an jedem Schnitt fast 1 s Stille, das klang maschinell.
const NACH = 0.16; // Sekunden nach dem letzten Laut der Szene
const VOR = 0.05; // Sekunden vor dem ersten Laut der Szene
const sprechEnde = (i) => {
  let m = 0;
  for (let k = pos[i]; k < Math.min(pos[i] + teile[i].length, zE.length); k++) m = Math.max(m, zE[k]);
  return m;
};
const ton = teile.map((t, i) => {
  const start = i === 0 ? 0 : Math.max(0, zeit(pos[i]) - VOR);
  const naechster = i + 1 < teile.length ? Math.max(0, zeit(pos[i + 1]) - VOR) : ende + 0.25;
  return { start, ende: Math.min(naechster, sprechEnde(i) + NACH) };
});
const szenen = ton.map((t, i) => Math.max(MIN[i], Math.ceil((t.ende - t.start) * FPS) + 2));
// Ab wann das „Aber/Nur“ in Szene 4 gesprochen wird
const s4 = teile[3];
const m = s4.search(/\b(Aber|Doch)\b|\bNur\b/); // seit 27.11.: gesprochen ohne Doppelpunkt („Aber nur …“)
const aberAb = m > 0 ? Math.max(40, Math.round((zeit(pos[3] + m) - ton[3].start) * FPS) - 4) : 112;

const props = {
  serie: eintrag.serie, hook: eintrag.hook, zitat: eintrag.zitat, autor: eintrag.autor, jahr: String(eintrag.jahr), werk: eintrag.werk,
  gemeint: eintrag.gemeint, fakt_zahl: Number(eintrag.fakt_zahl), fakt_einheit: eintrag.fakt_einheit, fakt_text: eintrag.fakt_text,
  fakt_quelle: eintrag.fakt_quelle, aber: eintrag.aber, urteil: eintrag.urteil, tipp: eintrag.tipp, ende: eintrag.ende,
  szenen, audio: 'stimme.mp3', ton, aberAb, these: eintrag.these === true,
};
// Musikbett und Stempel-Ton (seit 28.11.): einmal mit Eleven Music bzw. ElevenLabs Sound Effects aus Deniz' Plan erzeugt,
// liegen im Repo unter public/musik/ und public/ton/ (Herkunft in QUELLE.md). Das Bett wechselt nach der Position des
// Eintrags in der Bank. Die Lautstärke gleicht die Betten an: 0,11 bezogen auf ein Bett mit -18 LUFS (gemessen 28.11.).
// Fehlt eine Datei, läuft das Reel ohne sie weiter. MUSIK=aus schaltet das Bett zum Testen ab.
const BETTEN = [
  { datei: 'musik/bett-1.m4a', lufs: -19.7 },
  { datei: 'musik/bett-2.m4a', lufs: -22.8 },
  { datei: 'musik/bett-3.m4a', lufs: -16.2 },
  { datei: 'musik/bett-4.m4a', lufs: -14.7 },
].filter((b) => fs.existsSync(path.join(pub, b.datei)));
if (BETTEN.length && process.env.MUSIK !== 'aus') {
  const nr = Math.max(0, bank.findIndex((e) => e.id === eintrag.id));
  const bett = BETTEN[nr % BETTEN.length];
  props.musik = bett.datei;
  props.musikLautstaerke = Number((0.11 * 10 ** ((-18 - bett.lufs) / 20)).toFixed(3));
  console.log('Musikbett:', bett.datei, '| Lautstärke', props.musikLautstaerke);
}
if (fs.existsSync(path.join(pub, 'ton/stempel.ogg'))) props.stempel = 'ton/stempel.ogg';
fs.writeFileSync('props.json', JSON.stringify(props, null, 1));
console.log('Szenen (Bilder):', szenen.join(', '), '| Dauer:', (szenen.reduce((a, b) => a + b, 0) / FPS).toFixed(1), 's');

// 3) Rendern
const serveUrl = await bundle({ entryPoint: path.resolve('src/index.ts') });
const composition = await selectComposition({ serveUrl, id: 'Kopfsatz', inputProps: props });
await renderMedia({ composition, serveUrl, codec: 'h264', outputLocation: 'out/reel.mp4', inputProps: props, crf: 18, audioBitrate: '192k', concurrency: 2 });
fs.appendFileSync(process.env.GITHUB_OUTPUT || '/dev/null', `fertig=ja\nid=${eintrag.id}\n`);
console.log('Fertig:', eintrag.id);
