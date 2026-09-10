/**
 * Translation coverage.
 *
 * en.ts is the source of truth: its keys ARE the English text, so a missing
 * key silently degrades to English rather than breaking. That makes gaps easy
 * to introduce and invisible in testing - hence this.
 */
import assert from 'node:assert/strict';
import { test, describe } from 'node:test';
import { readdirSync } from 'node:fs';
import { resolve } from 'node:path';

// Imported statically rather than with dynamic import(): on Windows a resolved
// absolute path is `c:\...`, which the ESM loader rejects outright.
import ar from '../ar.ts';
import de from '../de.ts';
import en from '../en.ts';
import es from '../es.ts';
import fi from '../fi.ts';
import fr from '../fr.ts';
import hi from '../hi.ts';
import id from '../id.ts';
import ja from '../ja.ts';
import ko from '../ko.ts';
import pl from '../pl.ts';
import pt from '../pt.ts';
import ru from '../ru.ts';
import tr from '../tr.ts';
import vi from '../vi.ts';
import zh from '../zh.ts';

const LOCALES: Record<string, Record<string, string>> = {
	ar,
	de,
	es,
	fi,
	fr,
	hi,
	id,
	ja,
	ko,
	pl,
	pt,
	ru,
	tr,
	vi,
	zh,
};

/** The sixteen languages the RGS can request (RGS.md, "Language"). */
const SUPPORTED = [
	'ar',
	'de',
	'en',
	'es',
	'fi',
	'fr',
	'hi',
	'id',
	'ja',
	'ko',
	'pl',
	'pt',
	'ru',
	'tr',
	'vi',
	'zh',
];

/**
 * `lang:key` pairs whose translation is legitimately identical to the English.
 *
 * Every other identical value is a bug - a string that was added to en.ts and
 * copied into the locale files without ever being translated. That is invisible
 * at runtime (the copy renders as perfectly good English) and invisible to the
 * missing-key test above (the key IS present), so it has to be asserted
 * explicitly. Eighteen strings shipped that way before this test existed.
 *
 * Everything listed here is an acronym or a loanword the language genuinely
 * borrows unchanged. Pinning exact pairs rather than allowlisting whole keys
 * means a NEW untranslated locale still fails even for these words.
 */
const IDENTICAL_TO_ENGLISH_OK = new Set([
	'de:Autoplay',
	'de:Normal',
	'de:RTP',
	'de:Start',
	'es:Color',
	'es:Error',
	'es:Normal',
	'es:RTP',
	'fi:RTP',
	'fr:Mode',
	'fr:RTP',
	'fr:Session',
	'hi:RTP',
	'id:Mode',
	'id:Normal',
	'id:RTP',
	'ja:RTP',
	'ko:RTP',
	'pl:RTP',
	'pl:Start',
	'pt:Normal',
	'pt:RTP',
	'ru:RTP',
	'tr:Normal',
	'tr:RTP',
	'vi:RTP',
	'zh:RTP',
]);

// The catalogues are the PARENT directory: this test sits in messagesMap/tests/
// and walks messagesMap/ itself.
const HERE = resolve(import.meta.dirname, '..');

const localeFiles = () =>
	readdirSync(HERE)
		.filter((f) => f.endsWith('.ts') && !f.endsWith('.test.ts') && f !== 'index.ts')
		.map((f) => f.replace(/\.ts$/, ''));

describe('locale coverage', () => {
	test('every RGS-supported language has a file', () => {
		const present = new Set(localeFiles());
		const missing = SUPPORTED.filter((l) => !present.has(l));
		assert.deepEqual(missing, [], `missing locale files: ${missing.join(', ')}`);
	});

	test('no stray locale files beyond the supported set', () => {
		const extra = localeFiles().filter((l) => !SUPPORTED.includes(l));
		assert.deepEqual(extra, [], `unexpected locale files: ${extra.join(', ')}`);
	});
});

describe('every locale covers every English key', () => {
	const englishKeys = Object.keys(en);

	for (const [lang, messages] of Object.entries(LOCALES)) {
		test(`${lang}: no missing keys`, () => {
			const missing = englishKeys.filter((k) => !(k in messages));
			assert.deepEqual(
				missing,
				[],
				`${lang} missing ${missing.length}: ${missing.slice(0, 5).join(' | ')}`,
			);
		});

		test(`${lang}: no keys that do not exist in English`, () => {
			// A stale key is dead weight and usually means the English copy changed
			// without the translation following.
			const extra = Object.keys(messages).filter((k) => !(k in en));
			assert.deepEqual(
				extra,
				[],
				`${lang} has ${extra.length} stale: ${extra.slice(0, 5).join(' | ')}`,
			);
		});

		test(`${lang}: no empty values`, () => {
			const blank = Object.entries(messages).filter(([, v]) => typeof v !== 'string' || !v.trim());
			assert.equal(
				blank.length,
				0,
				`${lang} blank: ${blank
					.map(([k]) => k)
					.slice(0, 5)
					.join(' | ')}`,
			);
		});

		test(`${lang}: no untranslated values`, () => {
			const untranslated = englishKeys.filter(
				(k) => messages[k] === (en as Record<string, string>)[k] && !IDENTICAL_TO_ENGLISH_OK.has(`${lang}:${k}`),
			);
			assert.deepEqual(
				untranslated,
				[],
				`${lang} left ${untranslated.length} string(s) in English: ${untranslated
					.map((k) => k.slice(0, 60))
					.slice(0, 5)
					.join(' | ')}`,
			);
		});

		test(`${lang}: keeps the %s placeholder`, () => {
			// Substituted at render time. Lose it and the tooltip reads
			// "Spins must be seconds apart" with no number.
			const key = 'Spins must be %s seconds apart';
			assert.ok(messages[key]?.includes('%s'), `${lang} dropped %s from "${key}"`);
		});
	}
});
