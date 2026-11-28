# Musikbetten für Kopfsatz

Erzeugt am 28.11.2026 mit Eleven Music (ElevenLabs, Modell Music v2.5) aus Deniz' bestehendem Starter-Plan (kommerzielle Lizenz für Musik laut Plan, keine Zusatzkosten). Instrumental, je 30 Sekunden, AAC im MP4-Container. Einmal erzeugt und danach nur wiederverwendet.

scripts/reel.mjs wählt das Bett im Wechsel nach der Position des Eintrags in bank/zitate.json (bett-1 bis bett-4, danach von vorn). Lautstärke im Reel 0,11 mit kurzem Ein- und Ausblenden (src/Kopfsatz.tsx).

| Datei | Titel bei ElevenLabs | Prompt |
|---|---|---|
| bett-1.m4a | Quiet Curiosity | Warm, calm lo-fi background music to sit quietly under a spoken voiceover. Soft felt piano chords, gentle warm pad, very light brushed drums, around 78 BPM, intimate, thoughtful and curious mood. Instrumental only, no vocals, no build-ups or drops, steady even level throughout. |
| bett-2.m4a | Quiet Light | Gentle, warm acoustic background music for a calm spoken explainer. Soft fingerpicked nylon guitar, warm Rhodes electric piano and a quiet cello pad, around 74 BPM, cozy, reflective and hopeful. Instrumental only, no vocals, no percussion hits, no build-ups or drops, steady even level throughout. |
| bett-3.m4a | Quiet Curiosity (2. Variante) | wie bett-1 |
| bett-4.m4a | Warm Stillness | wie bett-2 |
