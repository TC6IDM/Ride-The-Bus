/**
 * The source manifest is real.
 *
 * sources.testlib.ts is what eight grep tests read instead of a hardcoded
 * path to Game.svelte, and it has no existsSync filter on purpose: filtering
 * would turn a typo'd or stale path into a grep test that quietly stopped
 * looking at anything, which is the exact failure mode those tests exist to
 * prevent. So the manifest has to be checked, and this is the check.
 */
import assert from 'node:assert/strict';
import { test, describe } from 'node:test';
import { existsSync } from 'node:fs';
import { relative } from 'node:path';

import {
  ALL_PATHS,
  GAME_ALL,
  GAME_COMPONENT,
  GAME_MARKUP,
  GAME_SOURCES,
  MARKUP_COMPONENT_PATHS,
  SCRIPT_MODULE_PATHS,
} from '../sources.testlib.ts';

describe('the game source manifest', () => {
  test('every path it claims exists', () => {
    for (const path of ALL_PATHS) {
      assert.ok(existsSync(path), `sources.testlib.ts lists a file that is not there: ${path}`);
    }
  });

  test('nothing is listed twice', () => {
    const seen = new Set(ALL_PATHS);
    assert.equal(
      seen.size,
      ALL_PATHS.length,
      'a path appears twice in the manifest, so every counting grep double-counts it',
    );
  });

  /**
   * A script module in the markup list (or the reverse) is not a crash, it is
   * a wrong answer: the i18n greps are about strings that reach the screen,
   * and a `t('…')` in a .ts module does not.
   */
  test('the two lists are sorted into the right kind of file', () => {
    for (const path of SCRIPT_MODULE_PATHS) {
      assert.ok(
        !path.endsWith('.svelte'),
        `${relative(process.cwd(), path)} is a component but is listed as a script module`,
      );
    }
    for (const path of MARKUP_COMPONENT_PATHS) {
      assert.ok(
        path.endsWith('.svelte'),
        `${relative(process.cwd(), path)} is not a component but is listed as markup`,
      );
    }
  });

  test('the concatenations are non-trivial and all contain the component', () => {
    assert.ok(GAME_COMPONENT.length > 10_000, 'Game.svelte came back far too short to be itself');
    for (const [name, text] of [
      ['GAME_SOURCES', GAME_SOURCES],
      ['GAME_MARKUP', GAME_MARKUP],
      ['GAME_ALL', GAME_ALL],
    ] as const) {
      assert.ok(
        text.length >= GAME_COMPONENT.length,
        `${name} is shorter than the component it is supposed to include`,
      );
    }
  });
});
