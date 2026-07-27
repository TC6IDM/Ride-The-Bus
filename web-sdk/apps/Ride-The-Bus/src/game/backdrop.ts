/**
 * Which backdrop the game draws behind the play area.
 *
 * Flip BACKDROP between the two values below - that single line is the whole
 * switch, nothing else needs touching:
 *
 *   'css'   - the table, chips and party cups drawn entirely in CSS
 *             (src/styles/table.css). No image download, stays sharp at any
 *             resolution, and the props reposition themselves rather than
 *             being cropped when the viewport aspect changes.
 *
 *   'image' - the shipped bitmap named by BACKDROP_IMAGE below, painted with
 *             `center/cover`. Richer looking, but ~1.9 MB and the edges get
 *             cropped away on narrow/short windows.
 */
export type BackdropMode = 'css' | 'image';

/* The `as BackdropMode` is load-bearing: without it TypeScript narrows a const
   to its literal type, and the comparison below becomes a "no overlap" error
   for whichever value is not currently selected. */
export const BACKDROP = 'image' as BackdropMode;

/**
 * Which file 'image' mode uses. Must live in static/ (served from the app
 * base path). static/ currently holds backdrop.png and backdrop3.png.
 */
export const BACKDROP_IMAGE = 'backdrop.png';

export const isCssBackdrop = BACKDROP === 'css';
