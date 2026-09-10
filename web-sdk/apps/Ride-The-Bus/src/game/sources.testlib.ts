/**
 * Where Game.svelte's source lives, for the tests that read it as TEXT.
 *
 * Eight test files grep the game component rather than importing from it, and
 * every one of them says in its own header why: the defect it guards fails
 * SILENTLY. A forgiven card that sounds like a bust is a wrong sound, not a
 * missing one. A mode restored without its family prefix plays the right cards
 * for the wrong bet. A class renamed in a stylesheet drops its control to the
 * quietest cue in the set. None of those throw, none fail a type check, and
 * none show up in a screenshot - so they are pinned as string assertions
 * against the source.
 *
 * That worked while the whole game was one 3,789-line component. It stops
 * working the moment any of it moves: `read('../components/Game.svelte')` is
 * a path, and a grep against a file the code has left passes vacuously or
 * fails for the wrong reason.
 *
 * So the sources are a MANIFEST, and the greps run against the concatenation.
 * Every counting assertion still counts correctly (four isCleanSweep sites,
 * exactly two parseModeName restore blocks), and every negative assertion
 * still means what it said, because the manifest is deliberately NARROW - only
 * the files Game.svelte's own script and markup were split into, never all of
 * game/*.ts. A wider net would break the negatives: currencies.test.ts asserts
 * `attributes: true` appears NOWHERE, and modes.test.ts asserts the same of
 * `bustedIndex === null`. Both would start failing on an unrelated module that
 * happened to contain the string.
 *
 * ADDING A FILE. When a split moves code out of Game.svelte, add it here in
 * the same commit. There is no existsSync filter and there is no glob: a path
 * listed here must exist, which sources.test.ts checks, because a filter would
 * turn a typo into a grep test that silently stopped looking at anything.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const at = (rel: string) => resolve(import.meta.dirname, rel);

/** The component itself. Still the largest single piece, and still the view. */
export const GAME_COMPONENT_PATH = at('../components/Game.svelte');

/**
 * Modules carrying logic that used to be in Game.svelte's <script>.
 *
 * Ordered as the split happened, which is roughly outermost-first: the
 * self-contained helpers, then the state, then the round orchestration.
 */
export const SCRIPT_MODULE_PATHS: string[] = [
  at('./dev/devSession.ts'),
  at('./ui/fitValue.ts'),
  at('./bet/betFieldFont.ts'),
  at('./bet/currencySymbol.ts'),
  at('./ui/pressCues.ts'),
  at('./audio/soundSettings.svelte.ts'),
  at('./round/revealPacing.svelte.ts'),
  at('./round/autoplaySettings.svelte.ts'),
  at('./round/roundState.svelte.ts'),
  at('./celebration/celebrationState.svelte.ts'),
  at('./bet/betState.svelte.ts'),
  at('./round/roundPlace.svelte.ts'),
  at('./round/roundReveal.svelte.ts'),
  at('./round/roundRestore.svelte.ts'),
  at('./round/roundSettle.svelte.ts'),
  at('./round/autoplayLoop.svelte.ts'),
];

/**
 * Components carrying markup that used to be in Game.svelte's template.
 *
 * Separate from the script list because the i18n and RTL greps are about
 * RENDERED strings - a `t('…')` key in a .ts module is not on screen.
 */
export const MARKUP_COMPONENT_PATHS: string[] = [
  at('../components/popups/ModePopup.svelte'),
  at('../components/popups/BetPopup.svelte'),
  at('../components/popups/TurboPopup.svelte'),
  at('../components/popups/SoundPopup.svelte'),
  at('../components/popups/AutospinPopup.svelte'),
  at('../components/popups/AdvancedPopup.svelte'),
  at('../components/intro/IntroPanels.svelte'),
  at('../components/intro/ReplayDetails.svelte'),
  at('../components/board/ControlBar.svelte'),
  at('../components/board/GameBoard.svelte'),
  at('../components/board/SessionReadouts.svelte'),
];

/** Every path this manifest claims, for sources.test.ts to verify. */
export const ALL_PATHS = [
  GAME_COMPONENT_PATH,
  ...SCRIPT_MODULE_PATHS,
  ...MARKUP_COMPONENT_PATHS,
];

const readAll = (paths: string[]) =>
  paths.map((path) => readFileSync(path, 'utf8')).join('\n');

/** The component's own text. Use this only when the assertion is about the component. */
export const GAME_COMPONENT = readFileSync(GAME_COMPONENT_PATH, 'utf8');

/** The component plus every module its script was split into. */
export const GAME_SOURCES = readAll([GAME_COMPONENT_PATH, ...SCRIPT_MODULE_PATHS]);

/** The component plus every component its markup was split into. */
export const GAME_MARKUP = readAll([GAME_COMPONENT_PATH, ...MARKUP_COMPONENT_PATHS]);

/** Everything, script and markup. */
export const GAME_ALL = readAll(ALL_PATHS);

/**
 * One named source, for an assertion that SLICES between two anchors.
 *
 * sound.test.ts cuts the reveal loop out from `playRevealSequence` to the line
 * after it and greps only that region. Run against a concatenation, the end
 * anchor could land in a different file from the start anchor and the slice
 * would swallow whole modules - so a slicing test asks for its one file.
 */
export function source(rel: string): string {
  return readFileSync(at(rel), 'utf8');
}

/**
 * Two named single-file pointers, for the assertions that SLICE.
 *
 * sound.test.ts cuts a region out between two anchors and greps only that -
 * the reveal loop between `playRevealSequence` and the line after it, and the
 * body of `pressKindFor`. A slice taken from a concatenation can start in one
 * file and end in another, swallowing whole modules in between and reporting
 * on code the test was never about. So those two ask for one file each, and
 * the file they ask for is named HERE rather than in the test: when the code
 * moves, this is the line that changes.
 */
export const REVEAL_LOOP_SOURCE = source('./round/roundReveal.svelte.ts');
export const PRESS_CUES_SOURCE = source('./ui/pressCues.ts');

/**
 * The six per-panel stylesheets popups.css became.
 *
 * Same reason as the source manifest above: three tests read that file as text,
 * and a path is not a place. Concatenated they are the same surface the single
 * sheet was, so a grep against POPUP_CSS asks the question it always asked -
 * including the negative ones (`.bet-grid` must appear NOWHERE), which is why
 * the list is exhaustive rather than a glob.
 */
export const POPUP_STYLESHEET_PATHS = [
  at('../styles/popups/popup-mode.css'),
  at('../styles/popups/popup-bet.css'),
  at('../styles/popups/popup-turbo.css'),
  at('../styles/popups/popup-sound.css'),
  at('../styles/popups/popup-autospin.css'),
  at('../styles/popups/popup-advanced.css'),
];

/** Every panel sheet, joined. */
export const POPUP_CSS = readAll(POPUP_STYLESHEET_PATHS);

/**
 * The three sheets start-screen.css became.
 *
 * rtl.test.ts reads that file as text: three of its assertions are about the
 * intro screen specifically (`.ss-tip`, `.ss-step`, `.ss-help`), and one is a
 * NEGATIVE - no physical text-align, no physical margin - which has to keep
 * covering the whole surface the single sheet was, or the split would quietly
 * narrow it to a third.
 */
export const START_SCREEN_STYLESHEET_PATHS = [
  at('../styles/intro/start-screen-shell.css'),
  at('../styles/intro/intro-panels.css'),
  at('../styles/intro/replay-details.css'),
];

/** The intro screen's own sheet, for the assertions about its panels. */
export const INTRO_PANELS_CSS = source('../styles/intro/intro-panels.css');

/** All three, joined - for the negatives that must still mean "nowhere". */
export const START_SCREEN_CSS = readAll(START_SCREEN_STYLESHEET_PATHS);
