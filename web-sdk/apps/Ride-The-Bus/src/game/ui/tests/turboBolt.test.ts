/**
 * The turbo button's bolt fills in at Instant and only there (the owner's
 * call, 2026-10-18) - the one exception to "controls are lines, gauges are
 * fills" (design.md). Read as source: the bar cannot be mounted under node.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const BAR = readFileSync(resolve(import.meta.dirname, '../../../components/board/ControlBar.svelte'), 'utf8');

test('the turbo bolt is an outline, and filled at Instant', () => {
  const button = BAR.slice(BAR.indexOf('class="cb-float cb-turbo"'));
  const svg = button.slice(0, button.indexOf('</svg>'));
  assert.match(svg, /fill="none" stroke="currentColor"/, 'the bolt is no longer drawn as an outline');
  assert.match(svg, /fill=\{pacing\.turboSpeed >= 1 \? 'currentColor' : 'none'\}/, 'the bolt does not fill at Instant');
});
