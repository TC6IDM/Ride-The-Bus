/**
 * The takeover title picks a face that can draw the WHOLE string.
 *
 * Two halves, and the second is the one that will actually catch something.
 *
 * The first pins the behaviour: which face each locale's tier names resolve to,
 * including the two that were rendering in two faces at once before this
 * existed.
 *
 * The second pins the DATA displayFace.ts is transcribed from. Those ranges are
 * a hand copy of the `unicode-range` descriptors in components/app.css, and a
 * hand copy of a font subset is exactly the kind of thing that goes stale in
 * silence - re-subsetting a face changes a woff2 and a descriptor, and nothing
 * about that edit points at this module. So the test parses app.css and fails
 * if the two ever stop agreeing.
 */
import assert from 'node:assert/strict';
import { test, describe } from 'node:test';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { titleFaceFor, LATIN_SUBSET, LATIN_EXT_SUBSET } from '../displayFace.ts';

const read = (rel: string) => readFileSync(resolve(import.meta.dirname, rel), 'utf8');

/* ---- What each locale's tier names actually get ------------------------- */

describe('the title face covers the whole string', () => {
  test('English stays on the display face', () => {
    for (const s of ['Big Win', 'Huge Win', 'Mega Win', 'Epic Win', 'Max Win']) {
      assert.equal(titleFaceFor(s), 'display', s);
    }
  });

  test('a Latin-ext string drops to the body face, not part-way', () => {
    // Polish. The z-dot is absent from Big Shoulders and present in Poppins,
    // so before this the accent alone came from the body face - one word, two
    // files. Poppins covers the whole string, so 'body' renders it in one.
    assert.equal(titleFaceFor('Duża Wygrana'), 'body');
    assert.equal(titleFaceFor('Ogromna Wygrana'), 'display'); // no accent at all
  });

  test('Vietnamese needs the system stack, because neither webfont covers it', () => {
    // U+1EAF and U+1EDB sit in the gap between Poppins' U+1E00-1E9F and
    // U+1EF2-1EFF. Falling back to the body face would still have broken these
    // mid-word, which is the whole reason the answer is three-way.
    assert.equal(titleFaceFor('Thắng Lớn'), 'system');
    assert.equal(titleFaceFor('Thắng Khổng Lồ'), 'system');
  });

  test('non-Latin scripts take the system stack as a whole string', () => {
    assert.equal(titleFaceFor('Крупный'), 'system'); // ru
    assert.equal(titleFaceFor('大当たり'), 'system'); // ja
    assert.equal(titleFaceFor('大奖'), 'system'); // zh
  });

  test('a string is never split across two files', () => {
    // The property that matters, stated directly: whatever face is chosen, every
    // codepoint in the string must be drawable by it. 'system' is the escape
    // hatch and is trusted by definition - the OS picks one face for the run.
    const covered = (cp: number, ranges: ReadonlyArray<readonly [number, number]>) =>
      ranges.some(([lo, hi]) => cp >= lo && cp <= hi);

    const samples = [
      'Big Win',
      'Duża Wygrana',
      'Maks. Kazanç',
      'Ganho Épico',
      'Thắng Lớn',
    ];

    for (const s of samples) {
      const face = titleFaceFor(s);
      if (face === 'system') continue;
      const ranges = face === 'display' ? LATIN_SUBSET : [...LATIN_SUBSET, ...LATIN_EXT_SUBSET];
      for (const ch of s) {
        assert.ok(
          covered(ch.codePointAt(0)!, ranges),
          `${JSON.stringify(s)} was given "${face}", which cannot draw ${JSON.stringify(ch)}`,
        );
      }
    }
  });
});

/* ---- The ranges match the font files they were copied from -------------- */

describe('the subsets still match app.css', () => {
  const css = read('../../../components/app.css');

  /** Every @font-face block, as { family, weight, range }. */
  const faces = [...css.matchAll(/@font-face\s*\{([^}]*)\}/g)].map(([, body]) => ({
    family: /font-family:\s*'([^']+)'/.exec(body)?.[1] ?? '',
    src: /src:\s*url\('([^']+)'/.exec(body)?.[1] ?? '',
    range: /unicode-range:\s*([^;]+);/.exec(body)?.[1].trim() ?? '',
  }));

  /** "U+0000-00FF, U+0131, ..." -> [[0,255],[305,305], ...] */
  const parse = (range: string) =>
    range
      .split(',')
      .map((part) => part.trim().replace(/^U\+/i, ''))
      .filter(Boolean)
      .map((part) => {
        const [lo, hi] = part.split('-');
        return [parseInt(lo, 16), parseInt(hi ?? lo, 16)] as const;
      });

  const same = (a: ReadonlyArray<readonly [number, number]>, b: ReadonlyArray<readonly [number, number]>) =>
    JSON.stringify(a.map((r) => [...r])) === JSON.stringify(b.map((r) => [...r]));

  test('app.css still declares the faces this module assumes', () => {
    assert.ok(faces.length >= 10, `only found ${faces.length} @font-face blocks`);
    assert.ok(
      faces.some((f) => f.family === 'Big Shoulders'),
      'no Big Shoulders @font-face - the display face moved',
    );
  });

  test('Big Shoulders is still latin-ONLY, which is what makes this necessary', () => {
    // The asymmetry IS the bug: Poppins ships latin-ext and Big Shoulders does
    // not, so one accented letter in an otherwise-Latin word comes from the
    // other face. If a latin-ext Big Shoulders is ever added, the mid-word split
    // stops happening for Latin-ext locales and titleFaceFor should be revisited
    // rather than left quietly over-correcting.
    const bs = faces.filter((f) => f.family === 'Big Shoulders');
    assert.ok(bs.length > 0);
    for (const f of bs) {
      assert.ok(
        !f.src.includes('latin-ext'),
        `Big Shoulders now ships ${f.src} - re-read game/ui/displayFace.ts`,
      );
      assert.ok(same(parse(f.range), LATIN_SUBSET), `Big Shoulders range drifted: ${f.range}`);
    }
  });

  test('LATIN_SUBSET matches every latin block, byte for byte', () => {
    const latin = faces.filter((f) => f.range && !f.src.includes('latin-ext'));
    assert.ok(latin.length >= 6, `expected the latin blocks, found ${latin.length}`);
    for (const f of latin) {
      assert.ok(
        same(parse(f.range), LATIN_SUBSET),
        `${f.family} ${f.src} declares a range LATIN_SUBSET does not match:\n  ${f.range}`,
      );
    }
  });

  test('LATIN_EXT_SUBSET matches every latin-ext block', () => {
    const ext = faces.filter((f) => f.src.includes('latin-ext'));
    assert.ok(ext.length >= 4, `expected the Poppins latin-ext blocks, found ${ext.length}`);
    for (const f of ext) {
      assert.ok(
        same(parse(f.range), LATIN_EXT_SUBSET),
        `${f.family} ${f.src} declares a range LATIN_EXT_SUBSET does not match:\n  ${f.range}`,
      );
    }
  });
});

/* ---- The component actually asks ---------------------------------------- */

describe('the takeover title is wired to it', () => {
  test('WinCelebration picks the face rather than hardcoding one', () => {
    const comp = read('../../../components/board/WinCelebration.svelte');
    assert.match(comp, /titleFaceFor/, 'WinCelebration no longer calls titleFaceFor');
    assert.match(comp, /class="wc-title face-\{titleFace\}"/, '.wc-title lost its face class');
  });

  test('the stylesheet defines the two fallbacks the function can return', () => {
    const css = read('../../../styles/scene/win-celebration.css');
    assert.match(css, /\.wc-title\.face-body\s*\{/, 'no .face-body rule');
    assert.match(css, /\.wc-title\.face-system\s*\{/, 'no .face-system rule');
  });
});
