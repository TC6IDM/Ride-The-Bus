/**
 * The error dialog says one thing, in the player's language.
 *
 * Pinned as source because each rule failed silently on the live build, where
 * the only way to see it is to provoke an RGS error in a given language:
 *   - a recognised code printed its translated sentence AND the RGS's English
 *     statusMessage under it - the only English on screen in fifteen languages
 *     (live pass, 2026-10-06);
 *   - a network failure printed the browser's raw "Failed to fetch";
 *   - a launch failure (authenticate or the replay fetch) offered Close over a
 *     board that could not work, where Reload is the only way out (F-4).
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';

const MODAL = readFileSync(new URL('../../../components/popups/ErrorModal.svelte', import.meta.url), 'utf8');
const detailBody = MODAL.slice(MODAL.indexOf('const detail = $derived.by('), MODAL.indexOf('const canReload'));

test('a recognised code shows its translated sentence and no English detail under it', () => {
  assert.match(detailBody, /if \(!e \|\| network \|\| \(code && MESSAGES\[code\]\)\) return '';/);
});

test('a network failure reads as one, not as the browser\'s raw text', () => {
  assert.match(MODAL, /t\('Could not reach the game server\. Check your connection, then reload\.'\)/);
  assert.match(MODAL, /failed to fetch\|load failed\|networkerror/);
});

test('a failure it cannot name offers Reload beside Close', () => {
  assert.match(MODAL, /const unknown = \$derived\(stateModal\.modal\?\.name === 'error' && !code && !network && !launch\)/);
  assert.match(MODAL, /\{:else if unknown\}[\s\S]{0,200}t\('Close'\)[\s\S]{0,120}t\('Reload'\)/);
});

test('dead sessions and launch failures offer Reload, never Close', () => {
  assert.match(MODAL, /const RELOADABLE = new Set\(\['ERR_IS', 'ERR_ATE'\]\)/);
  assert.match(MODAL, /const canReload = \$derived\(Boolean\(\(code && RELOADABLE\.has\(code\)\) \|\| launch\)\)/);
});
