import { stateI18nDerived, stateUrlDerived } from 'state-shared';

import { i18nDerived as i18nDerivedUiPixi } from 'components-ui-pixi';
import { i18nDerived as i18nDerivedUiHtml } from 'components-ui-html';

import type en from './messagesMap/en';
import socialMessages from './socialMessages';

/** Every key defined in messagesMap/en.ts — a typo becomes a compile error. */
export type MessageKey = keyof typeof en;

/**
 * Translate one of this game's strings.
 *
 * The SDK's UI packages expose a named accessor per string, which is fine for a
 * handful; this game has ~60, so it uses a single generic lookup keyed by the
 * English text instead. `translate` falls back to the key when a locale has no
 * entry, so an untranslated language still renders readable English.
 *
 * When ?social=true (Stake.US), restricted gambling terms are replaced with
 * social-casino equivalents per Stake's prohibited-terms table. The social
 * override also forces English — other languages are not permitted in social
 * mode.
 */
export const t = (key: MessageKey): string => {
	if (stateUrlDerived.social()) {
		// Social mode (Stake.US) — English only, with restricted terms replaced.
		return (socialMessages as Record<string, string>)[key] ?? key;
	}
	return stateI18nDerived.translate(key);
};

export const i18nDerived = {
	...i18nDerivedUiPixi,
	...i18nDerivedUiHtml,
	t,
	home: () => stateI18nDerived.translate('HOME'),
	notTranslated: () => stateI18nDerived.translate('NOT TRANSLATED'),
};
