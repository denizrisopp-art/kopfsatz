import React from 'react';
import { AbsoluteFill, Audio, Easing, Sequence, interpolate, spring, staticFile, useCurrentFrame, useVideoConfig } from 'remotion';
import { SANS, SERIF } from './fonts';

// ---------- Design-Token „Kopfsatz“ ----------
export const C = {
  grund: '#09090D',
  text: '#F5F1EA',
  leise: '#A9A3B8',
  akzent: '#A493FF', // Kopfsatz-Lila
  tief: '#4B32E8',
  koralle: '#FF7A5C',
  bestaetigt: '#5BE49B',
  teilweise: '#FFC857',
  widerlegt: '#FF6B6B',
};
// Sicherer Bereich 1080 × 1920: oben 220, unten 420, rechts 140 frei
const LINKS = 90;
const BREITE = 1080 - LINKS - 140; // 850

export type Urteil = 'bestaetigt' | 'teilweise' | 'widerlegt';
export interface KopfsatzProps {
  serie: string;
  hook: string;
  zitat: string;
  autor: string;
  jahr: string;
  werk: string;
  gemeint: string;
  fakt_zahl: number;
  fakt_einheit: string;
  fakt_text: string;
  fakt_quelle: string;
  aber: string;
  urteil: Urteil;
  tipp: string;
  ende: string;
  szenen?: number[]; // Bilder je Szene: Hook, Zitat, Gemeint, Forschung, Urteil, Tipp, Ende
  audio?: string; // Datei in public/, z. B. stimme.mp3
  ton?: { start: number; ende: number }[]; // Sekunden im Audio je Szene
  aberAb?: number; // Bild in Szene 4, ab dem das „Aber“ erscheint
  musik?: string; // optionales Musikbett in public/
  these?: boolean; // Serie 2: These in eigenen Worten statt wörtlichem Zitat (keine Anführungszeichen)
}

export const STANDARD_SZENEN = [75, 150, 105, 180, 90, 105, 90];
export const kopfsatzDauer = (p: KopfsatzProps) => (p.szenen ?? STANDARD_SZENEN).reduce((a, b) => a + b, 0);

const URTEIL_TEXT: Record<Urteil, string> = { bestaetigt: 'Bestätigt', teilweise: 'Teilweise', widerlegt: 'Widerlegt' };
const URTEIL_FARBE: Record<Urteil, string> = { bestaetigt: C.bestaetigt, teilweise: C.teilweise, widerlegt: C.widerlegt };

const ease = Easing.bezier(0.16, 1, 0.3, 1);
const clamp = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' } as const;

// ---------- Text mit *Hervorhebung* ----------
type Wort = { w: string; hl: boolean };
const zerlege = (s: string): Wort[] =>
  s.split('*').flatMap((teil, i) => teil.split(/\s+/).filter(Boolean).map((w) => ({ w, hl: i % 2 === 1 })));

const Woerter: React.FC<{
  text: string;
  start: number;
  stagger?: number;
  statisch?: boolean;
  hlStyle?: React.CSSProperties;
  style?: React.CSSProperties;
}> = ({ text, start, stagger = 3, statisch, hlStyle, style }) => {
  const f = useCurrentFrame();
  const woerter = zerlege(text);
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', columnGap: '0.26em', ...style }}>
      {woerter.map((x, i) => {
        const p = statisch ? 1 : interpolate(f - start - i * stagger, [0, 16], [0, 1], { ...clamp, easing: ease });
        return (
          <span
            key={i}
            style={{
              display: 'inline-block',
              opacity: p,
              transform: `translateY(${(1 - p) * 46}px)`,
              filter: p < 1 ? `blur(${(1 - p) * 14}px)` : undefined,
              ...(x.hl ? { color: C.akzent, ...hlStyle } : {}),
            }}
          >
            {x.w}
          </span>
        );
      })}
    </div>
  );
};

// ---------- Hintergrund: Aurora, Orb, Körnung ----------
const Aurora: React.FC = () => {
  const f = useCurrentFrame();
  const blob = (x: number, y: number, r: number, farbe: string, a: number, sx: number, sy: number, ph: number) => {
    const bx = x + Math.sin(f / sx + ph) * 120;
    const by = y + Math.cos(f / sy + ph) * 160;
    return (
      <div
        style={{
          position: 'absolute',
          left: bx - r,
          top: by - r,
          width: r * 2,
          height: r * 2,
          borderRadius: '50%',
          background: `radial-gradient(circle, ${farbe} 0%, transparent 68%)`,
          opacity: a,
        }}
      />
    );
  };
  return (
    <AbsoluteFill style={{ backgroundColor: C.grund, overflow: 'hidden' }}>
      {blob(220, 380, 720, C.tief, 0.55, 70, 90, 0)}
      {blob(900, 1250, 760, '#2A1C8F', 0.6, 85, 60, 2)}
      {blob(760, 300, 520, C.koralle, 0.16, 55, 75, 4)}
      {blob(260, 1600, 600, '#1B2B7A', 0.5, 95, 80, 1)}
    </AbsoluteFill>
  );
};

const Koernung: React.FC = () => {
  const f = useCurrentFrame();
  return (
    <AbsoluteFill style={{ mixBlendMode: 'overlay', opacity: 0.22, pointerEvents: 'none' }}>
      <svg width="1080" height="1920">
        <filter id="k">
          <feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves="2" seed={f % 12} stitchTiles="stitch" />
          <feColorMatrix type="saturate" values="0" />
        </filter>
        <rect width="100%" height="100%" filter="url(#k)" />
      </svg>
    </AbsoluteFill>
  );
};

const Vignette: React.FC = () => (
  <AbsoluteFill style={{ background: 'radial-gradient(ellipse 120% 85% at 50% 45%, transparent 55%, rgba(0,0,0,0.65) 100%)' }} />
);

// Orb aus rotierenden Ringen, wandert zwischen den Szenen
const Orb: React.FC<{ grenzen: number[] }> = ({ grenzen }) => {
  const f = useCurrentFrame();
  // Position/Größe/Deckkraft je Szene
  const ziele = [
    [790, 560, 1.0, 0.9],
    [800, 430, 0.62, 0.7],
    [820, 1360, 0.75, 0.6],
    [540, 690, 1.05, 0.35],
    [540, 900, 1.5, 0.45],
    [810, 520, 0.7, 0.6],
    [540, 640, 0.9, 0.85],
  ];
  const keys = grenzen.slice(0, ziele.length);
  const wert = (k: number) =>
    interpolate(
      f,
      keys.flatMap((g, i) => (i === 0 ? [g] : [g - 4, g + 14])),
      ziele.flatMap((z, i) => (i === 0 ? [z[k]] : [ziele[i - 1][k], z[k]])),
      { ...clamp, easing: ease }
    );
  const x = wert(0), y = wert(1), s = wert(2), a = wert(3);
  const ringe = 11;
  return (
    <div style={{ position: 'absolute', left: x - 260, top: y - 260, width: 520, height: 520, perspective: 1400, opacity: a, transform: `scale(${s})` }}>
      <div style={{ position: 'absolute', inset: 0, transformStyle: 'preserve-3d', transform: `rotateX(${62 + Math.sin(f / 40) * 10}deg) rotateZ(${f * 0.5}deg)` }}>
        {Array.from({ length: ringe }).map((_, i) => (
          <div
            key={i}
            style={{
              position: 'absolute',
              inset: 0,
              borderRadius: '50%',
              border: `2px solid rgba(164,147,255,${0.25 + (i % 3) * 0.12})`,
              transform: `rotateY(${(i * 180) / ringe + f * 0.35}deg)`,
              boxShadow: i % 4 === 0 ? `0 0 24px rgba(164,147,255,0.25)` : undefined,
            }}
          />
        ))}
        <div style={{ position: 'absolute', left: 230, top: 230, width: 60, height: 60, borderRadius: '50%', background: C.akzent, filter: 'blur(18px)', opacity: 0.8 }} />
      </div>
    </div>
  );
};

// ---------- Szenen-Hülle mit Übergang ----------
const Szene: React.FC<{ dauer: number; sofort?: boolean; children: React.ReactNode }> = ({ dauer, sofort, children }) => {
  const f = useCurrentFrame();
  const rein = sofort ? 1 : interpolate(f, [0, 12], [0, 1], { ...clamp, easing: ease });
  const raus = interpolate(f, [dauer - 8, dauer], [0, 1], { ...clamp, easing: Easing.in(Easing.cubic) });
  const zoom = interpolate(f, [0, dauer], [1, 1.035]);
  return (
    <AbsoluteFill
      style={{
        opacity: Math.min(rein, 1 - raus),
        transform: `scale(${zoom + raus * 0.04}) translateY(${(1 - rein) * 30}px)`,
        filter: raus > 0 ? `blur(${raus * 14}px)` : undefined,
      }}
    >
      {children}
    </AbsoluteFill>
  );
};

const Etikett: React.FC<{ text: string; start?: number; farbe?: string; statisch?: boolean }> = ({ text, start = 0, farbe = C.akzent, statisch }) => {
  const f = useCurrentFrame();
  const p = statisch ? 1 : interpolate(f - start, [0, 14], [0, 1], { ...clamp, easing: ease });
  const lang = text.length > 30;
  return (
    <div
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 16,
        padding: '14px 26px',
        borderRadius: 999,
        background: 'rgba(255,255,255,0.06)',
        border: '1px solid rgba(255,255,255,0.14)',
        backdropFilter: 'blur(10px)',
        fontFamily: SANS,
        fontWeight: 600,
        fontSize: lang ? 24 : 30,
        letterSpacing: lang ? '0.08em' : '0.14em',
        lineHeight: 1.25,
        maxWidth: BREITE,
        whiteSpace: 'normal',
        textTransform: 'uppercase',
        color: C.text,
        opacity: p,
        transform: `translateX(${(1 - p) * -30}px)`,
      }}
    >
      <span style={{ flex: '0 0 auto', width: 14, height: 14, borderRadius: 7, background: farbe, boxShadow: `0 0 16px ${farbe}` }} />
      {text}
    </div>
  );
};

const Block: React.FC<{ top: number; children: React.ReactNode }> = ({ top, children }) => (
  <div style={{ position: 'absolute', left: LINKS, top, width: BREITE }}>{children}</div>
);

// ---------- Szenen ----------
const Hook: React.FC<{ p: KopfsatzProps }> = ({ p }) => {
  const f = useCurrentFrame();
  const strich = interpolate(f, [26, 50], [0, 1], { ...clamp, easing: ease });
  return (
    <>
      <Block top={290}>
        <Etikett text={p.serie} statisch />
      </Block>
      <Block top={760}>
        <Woerter
          text={p.hook}
          start={0}
          statisch
          style={{ fontFamily: SANS, fontWeight: 800, fontSize: 118, lineHeight: 1.02, letterSpacing: '-0.035em', color: C.text }}
          hlStyle={{ fontFamily: SERIF, fontWeight: 400, fontStyle: 'italic', letterSpacing: '-0.01em', fontSize: 132 }}
        />
        <div style={{ marginTop: 34, height: 8, width: 380 * strich, borderRadius: 4, background: `linear-gradient(90deg, ${C.akzent}, ${C.koralle})` }} />
      </Block>
    </>
  );
};

const Zitat: React.FC<{ p: KopfsatzProps }> = ({ p }) => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const q = spring({ frame: f, fps, config: { damping: 14, stiffness: 120 } });
  const { durationInFrames } = useVideoConfig();
  const laenge = p.zitat.replace(/\*/g, '').length;
  const groesse = laenge > 58 ? Math.max(78, Math.round(108 * Math.sqrt(58 / laenge))) : 108;
  const autorAb = Math.min(80, Math.max(40, (p.szenen?.[1] ?? 150) - 50));
  const autor = interpolate(f, [autorAb, autorAb + 18], [0, 1], { ...clamp, easing: ease });
  return (
    <>
      {p.these ? (
        <Block top={560}>
          <Etikett text="Die Idee, in eigenen Worten" />
        </Block>
      ) : (
      <div
        style={{
          position: 'absolute',
          left: LINKS - 10,
          top: 300,
          fontFamily: SERIF,
          fontSize: 400,
          lineHeight: 1,
          color: C.akzent,
          opacity: 0.9 * q,
          transform: `scale(${0.5 + q * 0.5}) rotate(${(1 - q) * -20}deg)`,
          transformOrigin: 'left top',
        }}
      >
        “
      </div>
      )}
      <Block top={700}>
        <Woerter
          text={p.zitat}
          start={8}
          stagger={4}
          style={{ fontFamily: SERIF, fontSize: groesse, lineHeight: 1.06, letterSpacing: '-0.01em', color: C.text }}
          hlStyle={{ fontStyle: 'italic' }}
        />
        <div style={{ marginTop: 56, opacity: autor, transform: `translateY(${(1 - autor) * 24}px)` }}>
          <div style={{ fontFamily: SANS, fontWeight: 700, fontSize: 42, color: C.text, letterSpacing: '-0.01em' }}>
            — {p.autor}, {p.jahr}
          </div>
          <div style={{ fontFamily: SERIF, fontStyle: 'italic', fontSize: 38, color: C.leise, marginTop: 8 }}>{p.werk}</div>
        </div>
      </Block>
    </>
  );
};

const TextSzene: React.FC<{ etikett: string; text: string; farbe?: string }> = ({ etikett, text, farbe }) => (
  <>
    <Block top={560}>
      <Etikett text={etikett} farbe={farbe} />
    </Block>
    <Block top={700}>
      <Woerter
        text={text}
        start={8}
        stagger={3}
        style={{ fontFamily: SANS, fontWeight: 700, fontSize: 80, lineHeight: 1.08, letterSpacing: '-0.03em', color: C.text }}
        hlStyle={{ fontFamily: SERIF, fontWeight: 400, fontStyle: 'italic', fontSize: 92, letterSpacing: '-0.01em' }}
      />
    </Block>
  </>
);

const Forschung: React.FC<{ p: KopfsatzProps }> = ({ p }) => {
  const f = useCurrentFrame();
  const z = interpolate(f, [10, 62], [0, 1], { ...clamp, easing: Easing.out(Easing.cubic) });
  const r = 170;
  const umfang = 2 * Math.PI * r;
  const aberAb = p.aberAb ?? 112;
  const quelle = interpolate(f, [Math.min(92, aberAb - 16), Math.min(108, aberAb)], [0, 1], { ...clamp, easing: ease });
  const prozent = p.fakt_einheit.trim() === '%';
  return (
    <>
      <Block top={290}>
        <Etikett text="Was die Forschung sagt" />
      </Block>
      <div style={{ position: 'absolute', left: LINKS, top: 400, width: 400, height: 400 }}>
        <svg width="400" height="400" style={{ position: 'absolute', inset: 0, transform: 'rotate(-90deg)' }}>
          <circle cx="200" cy="200" r={r} stroke="rgba(255,255,255,0.10)" strokeWidth="22" fill="none" />
          <circle
            cx="200"
            cy="200"
            r={r}
            stroke="url(#g)"
            strokeWidth="22"
            strokeLinecap="round"
            fill="none"
            strokeDasharray={umfang}
            strokeDashoffset={prozent ? umfang * (1 - (z * Math.min(100, p.fakt_zahl)) / 100) : umfang}
          />
          <defs>
            <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor={C.akzent} />
              <stop offset="100%" stopColor={C.koralle} />
            </linearGradient>
          </defs>
        </svg>
        <div
          style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontFamily: SANS,
            fontWeight: 800,
            fontSize: 120,
            letterSpacing: '-0.05em',
            color: C.text,
            fontVariantNumeric: 'tabular-nums',
          }}
        >
          {Math.round(z * p.fakt_zahl).toLocaleString('de-DE')}
          <span style={{ fontSize: 64, marginLeft: 6, color: C.akzent }}>{p.fakt_einheit}</span>
        </div>
      </div>
      <Block top={850}>
        <Woerter
          text={p.fakt_text}
          start={46}
          stagger={2}
          style={{ fontFamily: SANS, fontWeight: 600, fontSize: 58, lineHeight: 1.12, letterSpacing: '-0.02em', color: C.text }}
        />
        <div style={{ marginTop: 22, fontFamily: SANS, fontWeight: 500, fontSize: 30, color: C.leise, opacity: quelle }}>Studie: {p.fakt_quelle}</div>
        <div style={{ marginTop: 52 }}>
          <Woerter
            text={p.aber}
            start={aberAb}
            stagger={2}
            style={{ fontFamily: SERIF, fontStyle: 'italic', fontSize: 62, lineHeight: 1.1, color: C.text }}
            hlStyle={{ color: C.teilweise }}
          />
        </div>
      </Block>
    </>
  );
};

const UrteilSzene: React.FC<{ p: KopfsatzProps }> = ({ p }) => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const s = spring({ frame: f - 10, fps, config: { damping: 11, stiffness: 140 } });
  const farbe = URTEIL_FARBE[p.urteil];
  const stufen: Urteil[] = ['bestaetigt', 'teilweise', 'widerlegt'];
  const idx = stufen.indexOf(p.urteil);
  const lauf = interpolate(f, [0, 22], [0, idx], { ...clamp, easing: ease });
  return (
    <>
      <Block top={560}>
        <Etikett text={p.serie} farbe={farbe} />
      </Block>
      <Block top={720}>
        <div style={{ position: 'relative', display: 'flex', gap: 0, width: BREITE, height: 84, borderRadius: 42, background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)' }}>
          <div style={{ position: 'absolute', top: 6, left: 6 + lauf * ((BREITE - 12) / 3), width: (BREITE - 12) / 3, height: 72, borderRadius: 36, background: farbe, opacity: 0.95 }} />
          {stufen.map((st, i) => (
            <div key={st} style={{ position: 'relative', flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: SANS, fontWeight: 700, fontSize: 32, color: i === idx && f > 18 ? C.grund : C.leise }}>
              {URTEIL_TEXT[st]}
            </div>
          ))}
        </div>
        <div
          style={{
            marginTop: 90,
            display: 'inline-block',
            padding: '18px 44px 26px',
            border: `8px solid ${farbe}`,
            borderRadius: 28,
            fontFamily: SANS,
            fontWeight: 800,
            fontSize: 150,
            letterSpacing: '-0.04em',
            color: farbe,
            opacity: Math.min(1, s * 1.5),
            transform: `scale(${2 - s}) rotate(${-4 - (1 - s) * 10}deg)`,
            transformOrigin: 'left center',
            textShadow: `0 0 40px ${farbe}55`,
          }}
        >
          {URTEIL_TEXT[p.urteil]}
        </div>
      </Block>
    </>
  );
};

const Ende: React.FC<{ p: KopfsatzProps }> = ({ p }) => {
  const f = useCurrentFrame();
  const logo = interpolate(f, [30, 48], [0, 1], { ...clamp, easing: ease });
  return (
    <>
      <Block top={940}>
        <Woerter text={p.ende} start={4} stagger={2} style={{ fontFamily: SERIF, fontSize: 84, lineHeight: 1.08, color: C.text }} hlStyle={{ fontStyle: 'italic' }} />
      </Block>
      <div style={{ position: 'absolute', left: 0, right: 0, top: 1340, display: 'flex', justifyContent: 'center', opacity: logo, transform: `translateY(${(1 - logo) * 20}px)` }}>
        <Marke />
      </div>
    </>
  );
};

export const Marke: React.FC<{ gross?: number }> = ({ gross = 64 }) => (
  <div style={{ fontSize: gross, color: C.text, letterSpacing: '-0.03em', display: 'flex', alignItems: 'baseline' }}>
    <span style={{ fontFamily: SANS, fontWeight: 800 }}>Kopf</span>
    <span style={{ fontFamily: SERIF, fontStyle: 'italic', fontSize: gross * 1.12, color: C.akzent }}>satz</span>
  </div>
);

// ---------- Komposition ----------
export const Kopfsatz: React.FC<KopfsatzProps> = (p) => {
  const d = p.szenen ?? STANDARD_SZENEN;
  const starts = d.reduce<number[]>((acc, x, i) => [...acc, i === 0 ? 0 : acc[i - 1] + d[i - 1]], []);
  const teile: React.ReactNode[] = [
    <Hook p={p} />,
    <Zitat p={p} />,
    <TextSzene etikett="Was das heißt" text={p.gemeint} />,
    <Forschung p={p} />,
    <UrteilSzene p={p} />,
    <TextSzene etikett="Was du damit machst" text={p.tipp} farbe={C.bestaetigt} />,
    <Ende p={p} />,
  ];
  return (
    <AbsoluteFill style={{ backgroundColor: C.grund }}>
      <Aurora />
      <Orb grenzen={starts} />
      {p.musik ? <Audio src={staticFile(p.musik)} volume={0.12} /> : null}
      {p.audio && p.ton
        ? p.ton.map((t, i) => (
            <Sequence key={'ton' + i} from={starts[i]} durationInFrames={d[i]}>
              <Audio src={staticFile(p.audio!)} startFrom={Math.round(t.start * 30)} endAt={Math.max(Math.round(t.start * 30) + 1, Math.round(t.ende * 30))} />
            </Sequence>
          ))
        : null}
      {teile.map((t, i) => (
        <Sequence key={i} from={starts[i]} durationInFrames={d[i]}>
          <Szene dauer={d[i]} sofort={i === 0}>
            {t}
          </Szene>
        </Sequence>
      ))}
      <Vignette />
      <Koernung />
    </AbsoluteFill>
  );
};
