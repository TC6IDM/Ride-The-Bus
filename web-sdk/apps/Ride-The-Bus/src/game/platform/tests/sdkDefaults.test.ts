/**
 * No remote host in the SDK defaults this game bundles.
 *
 * state-shared's DEFAULT_BET_MODE_META and DEFAULT_GAME_RULE_META carried 53
 * asset URLs on a sample game's staging site and an S3 bucket. Nothing fetched
 * them - this game renders neither the SDK's bet-mode dialogs nor its rules
 * pages - but every one shipped in index.html, and Stake's rule is that a build
 * "cannot reach external sources". A reviewer reading the bundle cannot tell
 * dead data from a live request, so they are blanked (2026-09-22 audit).
 *
 * Read as TEXT: the file belongs to a vendored package, and an upstream update
 * that brought the URLs back would pass every other gate without a sound.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { test } from 'node:test';

const CONSTANTS = readFileSync(
  resolve(import.meta.dirname, '../../../../../../packages/state-shared/src/constants.ts'),
  'utf8',
);

test('the SDK default meta names no remote host', () => {
  const urls = CONSTANTS.match(/https?:\/\/[^\s'"`]+/g) ?? [];
  assert.deepEqual(urls, [], `remote URLs are back in state-shared's defaults: ${urls.slice(0, 3).join(', ')}`);
});

test('the defaults keep their shape, because the SDK dereferences them unguarded', () => {
  // stateBetDerived.activeBetMode().type has no null guard, and Game.svelte's
  // activeBetModeKey effect needs a mode to exist before the RGS loads its
  // own. Blanking the strings is safe; deleting the objects is not.
  for (const key of ['DEFAULT_BET_MODE_META', 'DEFAULT_GAME_RULE_META', 'BASE: {', "type: 'default'"]) {
    assert.ok(CONSTANTS.includes(key), `${key} is gone from state-shared's defaults`);
  }
});
