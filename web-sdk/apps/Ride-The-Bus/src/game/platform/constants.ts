/**
 * Layout sizing constants shared between the CSS and the game components.
 *
 * Everything slot-specific (SYMBOL_INFO_MAP, INITIAL_BOARD, spin options, etc.)
 * has been removed — this game has no reels. The background and main-size ratios
 * feed the responsive layout system via stateLayout.ts.
 */
export const BACKGROUND_RATIO = 2039 / 1000;
export const PORTRAIT_BACKGROUND_RATIO = 1242 / 2208;

export const DESKTOP_MAIN_SIZES = { width: 1422, height: 800 };
export const LANDSCAPE_MAIN_SIZES = { width: 1600, height: 900 };
export const PORTRAIT_MAIN_SIZES = { width: 800, height: 1422 };
