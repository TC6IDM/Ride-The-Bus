import { stateUrlDerived } from 'state-shared';

import { i18nDerived as i18nDerivedUiPixi } from 'components-ui-pixi';
import { i18nDerived as i18nDerivedUiHtml } from 'components-ui-html';

import { jurisdiction } from '../game/jurisdiction.svelte';

import messagesMap from './messagesMap';
import type en from './messagesMap/en';
import socialMessages from './socialMessages';

/** Every key defined in messagesMap/en.ts — a typo becomes a compile error. */
export type MessageKey = keyof typeof en;

/** Fallback language, and the one the keys themselves are written in. */
const DEFAULT_LANG = 'en';

/**
 * Social casino (Stake.US), from EITHER signal.
 *
 * `?social=true` is the documented one and stays first. The RGS also reports
 * the same fact in the jurisdiction block it returns from
 * /wallet/authenticate, and that is read too - a session that carried the flag
 * but not the parameter would otherwise print the restricted gambling terms
 * this whole catalogue exists to replace. Redundant on purpose; the failure is
 * one-directional and expensive.
 */
export const isSocialMode = (): boolean =>
	stateUrlDerived.social() || jurisdiction.socialCasino();

/**
 * Translate one of this game's strings.
 *
 * DELIBERATELY NOT THROUGH LINGUI. The SDK's `stateI18nDerived.translate` calls
 * `i18n._()`, which expects a COMPILED catalog - Lingui's CLI turns each message
 * into a function or token array ahead of time. This game's catalogs are plain
 * TypeScript objects, so Lingui found a raw string, compiled it on the fly, and
 * logged "Uncompiled message detected!" for every string on every render. A
 * normal session filled the console with hundreds of them, which is its own
 * problem for a submission that gets its network and console tab inspected.
 *
 * The alternative was adding @lingui/cli, a macro pass and a catalog-compile
 * step to the build. That is a lot of machinery to look up a string in an object
 * this game already owns - and none of Lingui's actual features are in play
 * here: there are no plurals, no genders, and the one runtime value (%s in the
 * cooldown tooltip) is substituted with .replace() precisely because Lingui's
 * ICU braces were a problem. So the lookup is done directly.
 *
 * Degradation is unchanged: requested language, then English, then the key -
 * and the key IS the English text, so the worst case is still readable. An
 * unsupported ?lang= simply misses the map and lands on English, which is what
 * "invalid language parameters do not break game display" asks for.
 *
 * Lingui is still loaded and activated by LoadI18n, and still needed:
 * `i18n.number()` formats every currency amount off the active locale.
 *
 * When ?social=true (Stake.US), restricted gambling terms are replaced with
 * social-casino equivalents per Stake's prohibited-terms table. The social
 * override also forces English — other languages are not permitted in social
 * mode.
 */
export const t = (key: MessageKey): string => {
	if (isSocialMode()) {
		// Social mode (Stake.US) — English only, with restricted terms replaced.
		return (socialMessages as Record<string, string>)[key] ?? key;
	}

	const catalogs = messagesMap as unknown as Record<string, Record<string, string>>;
	const lang = stateUrlDerived.lang();
	return catalogs[lang]?.[key] ?? catalogs[DEFAULT_LANG]?.[key] ?? key;
};

export const i18nDerived = {
	...i18nDerivedUiPixi,
	...i18nDerivedUiHtml,
	t,
	// These two are SDK strings rather than this game's, and nothing here
	// renders them - kept only so the shape of i18nDerived still matches what
	// the SDK components expect to find.
	home: () => t('HOME' as MessageKey),
	notTranslated: () => 'NOT TRANSLATED',
};
