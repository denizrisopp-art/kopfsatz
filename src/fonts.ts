import { continueRender, delayRender, staticFile } from 'remotion';

export const SANS = 'KopfsatzSans';
export const SERIF = 'KopfsatzSerif';

const handle = delayRender('Schriften laden');
const faces: FontFace[] = [
  ...[400, 500, 600, 700, 800].map(
    (w) => new FontFace(SANS, `url(${staticFile(`fonts/geist-sans-latin-${w}-normal.woff2`)}) format('woff2')`, { weight: String(w) })
  ),
  ...(['normal', 'italic'] as const).flatMap((style) =>
    ['latin', 'latin-ext'].map(
      (sub) =>
        new FontFace(SERIF, `url(${staticFile(`fonts/instrument-serif-${sub}-400-${style}.woff2`)}) format('woff2')`, {
          weight: '400',
          style,
        })
    )
  ),
];
Promise.all(faces.map((f) => f.load().then((ff) => (document as any).fonts.add(ff))))
  .then(() => continueRender(handle))
  .catch(() => continueRender(handle));
