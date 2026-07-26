import { stateI18nDerived } from 'state-shared';

import { i18nDerived as i18nDerivedUiPixi } from 'components-ui-pixi';
import { i18nDerived as i18nDerivedUiHtml } from 'components-ui-html';

import type en from './messagesMap/en';

/** Every key defined in messagesMap/en.ts - a typo becomes a compile error. */
export type MessageKey = keyof typeof en;

/**
 * Translate one of this game's strings.
 *
 * The SDK's UI packages expose a named accessor per string, which is fine for a
 * handful; this game has ~60, so it uses a single generic lookup keyed by the
 * English text instead. `translate` falls back to the key when a locale has no
 * entry, so an untranslated language still renders readable English.
 */
export const t = (key: MessageKey) => stateI18nDerived.translate(key);

export const i18nDerived = {
	...i18nDerivedUiPixi,
	...i18nDerivedUiHtml,
	t,
	home: () => stateI18nDerived.translate('HOME'),
	notTranslated: () => stateI18nDerived.translate('NOT TRANSLATED'),
};
