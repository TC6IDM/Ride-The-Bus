/**
 * The card face: a real deck's layout, one drawing of each suit, one colour
 * family per card, and one face for every dealt card.
 *
 * WHAT THIS GUARDS, and why each is a test rather than a look:
 *   - The pip grid. A 9 with eight pips, or a pip past the middle printed the
 *     right way up, is exactly the kind of wrong nobody notices until a player
 *     screenshots it - a round deals four cards, so one bad face can take
 *     hundreds of rounds to come up.
 *   - One face. The board and the takeover's fan used to draw their own faces;
 *     they were close enough to pass a glance and different enough that the fan
 *     "re-dealt" a card the board had just turned over. Both draw CardFace now.
 *   - One colour family. Card 1's guess is Red or Black. The court sprite is
 *     painted only in the six role variables CardFace maps per suit colour; a
 *     literal colour in it would draw the same in every suit and could put red
 *     on a black card.
 *   - The asset's paperwork. static/ ships wholesale, and ASSET_LICENCES.md
 *     must answer for every file in it (the music has the same test).
 */
import assert from 'node:assert/strict';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, test } from 'node:test';

import {
	FACE_W,
	FACE_H,
	PIP_SIZE,
	INDEX,
	COURT_FRAME,
	COURT_PANEL,
	faceKind,
	pipLayout,
	courtSymbol,
} from '../cardFaceLayout.ts';
import { SUIT_PATHS, isRedSuit, suitName } from '../suitPaths.ts';
import { ranks } from '../../round/roundContract.ts';
import { source } from '../../sources.testlib.ts';

const APP = resolve(import.meta.dirname, '../../../..');
const SPRITE = resolve(APP, 'static/cards/courts.svg');
const REPO = resolve(APP, '../../..');

describe('the pip grid is a real deck', () => {
	test('2 to 10 carry exactly their value in pips; A, J, Q, K carry none', () => {
		for (const rank of ranks) {
			const pips = pipLayout(rank);
			const value = Number(rank);
			if (Number.isInteger(value)) {
				assert.equal(faceKind(rank), 'pips', rank);
				assert.equal(pips.length, value, `${rank} has ${pips.length} pips`);
			} else {
				assert.equal(pips.length, 0, `${rank} has pips`);
				assert.equal(faceKind(rank), rank === 'A' ? 'ace' : 'court', rank);
			}
		}
	});

	test('every pip sits wholly on the card and clear of the corner index', () => {
		const half = PIP_SIZE / 2;
		// The index column is x <= ~29.3 ("10" at 36 units, centred at x 17),
		// down to the index pip's bottom edge; mirrored at the bottom-right.
		const indexRight = INDEX.x + 12.3;
		const indexBottom = INDEX.pipY + INDEX.pipSize / 2;
		for (const rank of ranks) {
			for (const p of pipLayout(rank)) {
				assert.ok(p.x - half >= 0 && p.x + half <= FACE_W && p.y - half >= 0 && p.y + half <= FACE_H, `${rank} pip off the card`);
				const inTopCorner = p.x - half < indexRight && p.y - half < indexBottom;
				const inBottomCorner = p.x + half > FACE_W - indexRight && p.y + half > FACE_H - indexBottom;
				assert.ok(!inTopCorner && !inBottomCorner, `${rank} pip at (${p.x}, ${p.y}) sits on the index`);
			}
		}
	});

	test('no two pips touch', () => {
		for (const rank of ranks) {
			const pips = pipLayout(rank);
			for (let i = 0; i < pips.length; i++) {
				for (let j = i + 1; j < pips.length; j++) {
					const apart = Math.max(Math.abs(pips[i].x - pips[j].x), Math.abs(pips[i].y - pips[j].y));
					assert.ok(apart >= PIP_SIZE, `${rank}: pips ${i} and ${j} overlap`);
				}
			}
		}
	});

	test('a pip past the middle is printed upside down, one on the middle is not', () => {
		for (const rank of ranks) {
			for (const p of pipLayout(rank)) {
				assert.equal(p.inverted, p.y > FACE_H / 2 + 0.01, `${rank} pip at y ${p.y}`);
			}
		}
	});

	test('the layout turns onto itself - except the 7, as printed', () => {
		const key = (x: number, y: number) => `${x.toFixed(2)},${y.toFixed(2)}`;
		for (const rank of ranks) {
			const pips = pipLayout(rank);
			if (!pips.length) continue;
			const set = new Set(pips.map((p) => key(p.x, p.y)));
			const symmetric = pips.every((p) => set.has(key(FACE_W - p.x, FACE_H - p.y)));
			assert.equal(symmetric, rank !== '7', `${rank} ${symmetric ? 'is' : 'is not'} point-symmetric`);
		}
	});
});

describe('the court geometry is the English pattern, scaled', () => {
	test('the frame is two L-shaped lines with their corners open for the index', () => {
		assert.equal(COURT_FRAME.length, 2);
		// The masters' frame opens at x 60 (top edge) and y 150 (left edge) on a
		// 360 x 540 card; the index has to fit inside that cut.
		assert.ok(INDEX.x + 12.3 < (60 * FACE_W) / 360, 'the index reaches past the frame\'s cut corner');
		assert.ok(INDEX.pipY + INDEX.pipSize / 2 < (150 * FACE_H) / 540, 'the index pip reaches past the frame\'s cut corner');
	});

	test('the panel is the masters\' 300 x 480, so the figures keep their shape', () => {
		assert.ok(Math.abs(COURT_PANEL.w / COURT_PANEL.h - 300 / 480) < 0.01);
	});

	test('every court resolves to a symbol id in the sprite\'s naming', () => {
		for (const r of ['J', 'Q', 'K']) {
			for (const s of ['♠', '♥', '♦', '♣']) assert.match(courtSymbol(r, s), /^court-[JQK][SHDC]$/);
		}
		assert.equal(courtSymbol('K', 'spade'), courtSymbol('K', '♠'));
	});
});

describe('one drawing of each suit', () => {
	test('SuitIcon and CardFace both draw suitPaths, and SuitIcon has no shapes of its own', () => {
		const icon = source('../components/icons/SuitIcon.svelte');
		assert.ok(icon.includes("from '../../game/ui/suitPaths'"), 'SuitIcon no longer draws suitPaths');
		assert.ok(!/<path\s+d="M/.test(icon) && !/<circle/.test(icon), 'SuitIcon has grown its own suit shapes again');
		assert.ok(source('../components/cards/CardFace.svelte').includes("from '../../game/ui/suitPaths'"));
	});

	test('both spellings of a suit resolve, and only hearts and diamonds are red', () => {
		for (const [ch, name] of [['♥', 'heart'], ['♦', 'diamond'], ['♣', 'club'], ['♠', 'spade']] as const) {
			assert.equal(suitName(ch), name);
			assert.ok(SUIT_PATHS[name].length > 0);
			assert.equal(isRedSuit(ch), name === 'heart' || name === 'diamond');
		}
	});
});

describe('one face for every dealt card', () => {
	test('the board and the fan draw CardFace, and neither draws a face of its own', () => {
		const board = source('../components/board/GameBoard.svelte');
		const fan = source('../components/board/WinCelebration.svelte');
		assert.ok(board.includes('<CardFace '), 'the board no longer draws CardFace');
		assert.ok(fan.includes('<CardFace '), 'the fan no longer draws CardFace');
		for (const [name, text] of [
			['GameBoard.svelte', board],
			['WinCelebration.svelte', fan],
			['cards.css', source('../styles/board/cards.css')],
			['win-celebration.css', source('../styles/scene/win-celebration.css')],
		] as const) {
			for (const old of ['index-rank', 'card-face"', '.card-face', 'wc-fan-index', 'wc-fan-rank', 'wc-fan-pip']) {
				assert.ok(!text.includes(old), `${name} draws its own face again (${old})`);
			}
		}
	});

	test('the faces never mix the two colour families', () => {
		const face = source('../components/cards/CardFace.svelte');
		const black = face.match(/\.card-face-art\s*{([^}]*)}/)?.[1] ?? '';
		const red = face.match(/\.card-face-art\.is-red\s*{([^}]*)}/)?.[1] ?? '';
		// Every role the sprite is painted in has a value on every card.
		for (const role of ['p', 'g', 't', 'd', 'l', 'b']) assert.ok(black.includes(`--cf-${role}:`), `--cf-${role} unset`);
		// A red card overrides every coloured role; nothing black survives on it.
		for (const role of ['t', 'd', 'l', 'b', 'suit']) assert.ok(red.includes(`--cf-${role}:`), `a red card keeps the black --cf-${role}`);
		assert.ok(!/--card-ink|--court-ink/.test(red), 'a red card draws in an ink token');
		assert.ok(!/--card-red|--court-red/.test(black), 'a black card draws in a red token');
	});
});

describe('the Takeover crown', () => {
  test('crowns every court pip and the house spade, in gold only', () => {
    const face = source('../components/cards/CardFace.svelte');
    const courts = face.slice(face.indexOf('{#if courtArt.ready}'));
    assert.equal((courts.match(/@render crown\(COURT_CROWN|@render crown\(FACE_W - COURT_CROWN/g) ?? []).length, 2, 'a court lost a crown');
    assert.ok(face.includes('@render crown(FACE_CENTRE.x, ACE.crownY'), 'the house spade lost its crown');
    assert.match(face, /\.cf-crown\s*{\s*fill:\s*var\(--cf-g\);\s*}/, 'the crown is no longer gold-only - it would touch the Red/Black read');
  });
});

describe('the court sprite', () => {
	const sprite = existsSync(SPRITE) ? readFileSync(SPRITE, 'utf8') : null;

	test('is there, and holds all twelve courts', (t) => {
		if (sprite === null) return t.skip('static/cards/courts.svg not built - run node scripts/court-art.mjs');
		for (const r of 'KQJ') for (const s of 'SHDC') assert.ok(sprite.includes(`<symbol id="court-${r}${s}"`), `court-${r}${s} missing`);
	});

	test('is painted only in the six roles - no literal colour anywhere', (t) => {
		if (sprite === null) return t.skip('not built');
		assert.ok(!/#[0-9a-f]{3,6}\b/i.test(sprite.replace(/href="#[^"]*"/g, '').replace(/url\(#[^)]*\)/g, '')), 'a literal colour is in the sprite');
		assert.ok(!/\b(fill|stroke)="(?!none)/.test(sprite), 'a paint is a presentation attribute, which a <use> cannot recolour');
		const vars = new Set(sprite.match(/var\(--[a-z-]+\)/g));
		for (const v of vars) assert.match(v, /^var\(--cf-[pgltdb]\)$/, `the sprite paints in ${v}`);
	});

	test('stays small enough to fetch behind the loader', (t) => {
		if (sprite === null) return t.skip('not built');
		// 199 kB when this was written (43 kB gzipped). Everything in static/ ships.
		const kb = statSync(SPRITE).size / 1024;
		assert.ok(kb < 240, `courts.svg is ${kb.toFixed(0)} kB`);
	});

	test('has its row in ASSET_LICENCES.md and its masters beside their provenance', () => {
		const licences = readFileSync(resolve(REPO, 'ASSET_LICENCES.md'), 'utf8');
		assert.ok(licences.includes('`static/cards/courts.svg`'), 'no licence row for the court sprite');
		assert.ok(/CC0/.test(licences.slice(licences.indexOf('static/cards/courts.svg'))), 'the licence row does not name CC0');
		assert.ok(existsSync(resolve(REPO, 'art-masters/courts/README.md')), 'the masters\' provenance is gone');
		assert.ok(existsSync(resolve(REPO, 'scripts/court-art.mjs')), 'nothing can rebuild the sprite');
	});
});
