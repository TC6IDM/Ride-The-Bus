/**
 * Text direction for the active locale.
 *
 * Of the sixteen languages the RGS can request (RGS.md, "Language") only
 * Arabic is written right-to-left. Without setting `dir` the page keeps LTR and
 * Arabic renders with punctuation and numbers in the wrong places, so shipping
 * the translation without this would be worse than not shipping it.
 */

const RTL_LANGUAGES = new Set(['ar']);

export const isRtl = (lang: string) => RTL_LANGUAGES.has(lang);

/**
 * Apply the direction to <html>. Set on the document element rather than a
 * wrapper so it also reaches the popups and the error dialog, which are
 * position:fixed and therefore not inside any game container.
 */
export function applyDirection(lang: string) {
  if (typeof document === 'undefined') return;
  document.documentElement.setAttribute('dir', isRtl(lang) ? 'rtl' : 'ltr');
  document.documentElement.setAttribute('lang', lang);
}
