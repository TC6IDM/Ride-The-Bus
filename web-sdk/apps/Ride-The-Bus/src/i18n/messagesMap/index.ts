import { mergeMessagesMaps, type MessagesMap } from 'utils-shared/i18n';
import { messagesMap as messagesMapUiPixi } from 'components-ui-pixi';
import { messagesMap as messagesMapUiHtml } from 'components-ui-html';

// All sixteen languages the RGS can request (docs/rgs_docs/RGS.md, "Language").
//
// A locale missing from this map falls back to English via LoadI18n, and a key
// missing from a locale falls back to the key - which IS the English text - so
// any gap degrades to readable English rather than a blank.
//
// Arabic is the only right-to-left locale; i18n/direction.ts sets dir on <html>.
import ar from './ar';
import de from './de';
import en from './en';
import es from './es';
import fi from './fi';
import fr from './fr';
import hi from './hi';
import id from './id';
import ja from './ja';
import ko from './ko';
import pl from './pl';
import pt from './pt';
import ru from './ru';
import tr from './tr';
import vi from './vi';
import zh from './zh';

const messagesMapGame = {
	ar,
	de,
	en,
	es,
	fi,
	fr,
	hi,
	id,
	ja,
	ko,
	pl,
	pt,
	ru,
	tr,
	vi,
	zh,
};

/**
 * The two SDK packages ship only `en` and `zh`, but MessagesMap is
 * Record<Language, Messages> over all sixteen languages - so their own maps have
 * never satisfied their own type, and mergeMessagesMaps rejects them.
 *
 * Widened rather than "fixed": the shortfall is real but harmless here, because
 * mergeMessagesMaps is a deep merge and any key those packages don't translate
 * falls back to the key, which is the English text. This game also replaced the
 * pixi UI, so most of those strings belong to components it never renders.
 *
 * Typed through Partial<MessagesMap> so a genuinely wrong shape is still caught
 * - only the missing-languages gap is waved through.
 */
const partialMap = (map: Partial<MessagesMap>) => map as MessagesMap;

const messagesMap = mergeMessagesMaps([
	messagesMapGame,
	partialMap(messagesMapUiPixi),
	partialMap(messagesMapUiHtml),
]);

export default messagesMap;
