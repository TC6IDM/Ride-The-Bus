/**
 * The `?lang=` parameter must not be able to break the display.
 *
 * Stake's PreChecks list "Invalid language parameters do not break game
 * display" as its own line, and this game failed it. The reason is subtle
 * enough to be worth restating: an UNKNOWN language is harmless, because t()
 * falls back to English and then to the key - which IS the English text. A
 * MALFORMED one is not, because LoadI18n activates whatever it is handed and
 * Lingui then passes it to Intl.NumberFormat on every i18n.number() call, and
 * Intl throws a RangeError rather than degrading.
 *
 *     ?lang=xx     -> $1,234.50   (well-formed, unknown; Intl is happy)
 *     ?lang=en_US  -> RangeError: Incorrect locale information provided
 *
 * numberToCurrencyString draws the balance, the last win, the bet display, the
 * running win, the takeover amount and every bet chip, so one underscore in a
 * URL emptied the board.
 *
 * Imported by relative path from the SDK package for the reason currency.test.ts
 * gives: the helper lives in utils-shared/language.ts precisely so a node test
 * can reach it without dragging state-shared (and SvelteKit's $app/* virtuals)
 * in behind it.
 */
import assert from 'node:assert/strict';
import { test, describe } from 'node:test';
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { LANGUAGE_ALIASES, resolveLanguage } from '../../../../../packages/utils-shared/language.ts';

const HERE = path.dirname(fileURLToPath(import.meta.url));

/**
 * What the game actually ships, read off disk rather than retyped. A catalogue
 * added or removed without this test noticing would be a locale the resolver
 * either rejects or lets through unbacked.
 */
const SHIPPED = readdirSync(path.join(HERE, '../messagesMap'))
  .filter((f) => f.endsWith('.ts') && f !== 'index.ts' && !f.endsWith('.test.ts'))
  .map((f) => f.replace(/\.ts$/, ''))
  .sort();

/** Every value the resolver can return has to survive this - it is the bug. */
const intlAccepts = (locale: string) => {
  try {
    new Intl.NumberFormat(locale, { style: 'currency', currency: 'USD' }).format(1);
    return true;
  } catch {
    return false;
  }
};

describe('the shipped locale set', () => {
  test('is the sixteen languages the RGS can request', () => {
    assert.equal(SHIPPED.length, 16, `found ${SHIPPED.length}: ${SHIPPED.join(' ')}`);
  });

  test('matches the list config-lingui declares', () => {
    // Read as text rather than imported: config-lingui/index.ts carries a type
    // import from @lingui/conf, and this test has no business resolving it.
    const src = readFileSync(
      path.join(HERE, '../../../../../packages/config-lingui/index.ts'),
      'utf8',
    );
    const block = /export const locales = \[([^\]]*)\]/.exec(src);
    assert.ok(block, 'config-lingui no longer exports a `locales` array');
    const declared = [...block[1]!.matchAll(/"([a-z-]+)"/g)].map((m) => m[1]!).sort();
    assert.deepEqual(
      declared,
      SHIPPED,
      'config-lingui and src/i18n/messagesMap disagree about which locales exist',
    );
  });

  test('every shipped locale is one Intl can format with', () => {
    for (const locale of SHIPPED) {
      assert.ok(intlAccepts(locale), `Intl rejects the shipped locale ${locale}`);
    }
  });
});

describe('resolveLanguage', () => {
  test('passes every shipped locale through unchanged', () => {
    for (const locale of SHIPPED) {
      assert.equal(resolveLanguage(locale, SHIPPED), locale);
    }
  });

  test('maps Stake own spellings onto the catalogues we ship', () => {
    // `po` is Stake's code for Polish in its supported-languages list; every
    // catalogue here is named `pl`. `br` was already special-cased in the SDK.
    assert.equal(resolveLanguage('po', SHIPPED), 'pl');
    assert.equal(resolveLanguage('br', SHIPPED), 'pt');
    // The alias table and the behaviour must not drift apart.
    for (const [from, to] of Object.entries(LANGUAGE_ALIASES)) {
      assert.equal(resolveLanguage(from, SHIPPED), to);
      assert.ok(SHIPPED.includes(to), `alias ${from} points at unshipped ${to}`);
    }
  });

  test('falls back to English on anything malformed', () => {
    // The first two are what a reviewer testing the PreCheck would actually
    // type; the rest are the shapes that make Intl throw.
    for (const raw of ['en_US', 'zz!!', 'en;a', '', '   ', '123', 'a', '-', 'en--us']) {
      assert.equal(resolveLanguage(raw, SHIPPED), 'en', `did not reject ${JSON.stringify(raw)}`);
    }
  });

  test('falls back to English on a well-formed language we do not ship', () => {
    // Harmless to Intl, but there is no catalogue behind it, and activating it
    // would leave Lingui formatting numbers for a locale the game never
    // translated. English is both safe and what LoadI18n would land on anyway.
    assert.equal(resolveLanguage('xx', SHIPPED), 'en');
    assert.equal(resolveLanguage('sv', SHIPPED), 'en');
  });

  test('falls back to English on a missing parameter', () => {
    assert.equal(resolveLanguage(null, SHIPPED), 'en');
    assert.equal(resolveLanguage(undefined, SHIPPED), 'en');
  });

  test('accepts a region subtag and a stray capital', () => {
    // Stake sends bare codes, but an operator URL carrying pt-BR should land on
    // Portuguese rather than English.
    assert.equal(resolveLanguage('pt-BR', SHIPPED), 'pt');
    assert.equal(resolveLanguage('zh-Hans', SHIPPED), 'zh');
    assert.equal(resolveLanguage('DE', SHIPPED), 'de');
    assert.equal(resolveLanguage(' fr ', SHIPPED), 'fr');
  });

  test('NEVER returns something Intl.NumberFormat would throw on', () => {
    // The actual regression. Everything above is detail; this is the contract.
    const nasty = [
      'en_US', 'zz!!', 'en;a', '', '-', '123', 'a', 'xx', 'po', 'br',
      'pt-BR', 'DE', 'en--us', '<script>', 'en ', '..', 'x'.repeat(200),
    ];
    for (const raw of [...nasty, ...SHIPPED]) {
      const resolved = resolveLanguage(raw, SHIPPED);
      assert.ok(
        intlAccepts(resolved),
        `resolveLanguage(${JSON.stringify(raw)}) returned ${JSON.stringify(resolved)}, which Intl rejects`,
      );
    }
  });
});
