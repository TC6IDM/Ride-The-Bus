import { mergeMessagesMaps } from 'utils-shared/i18n';
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

const messagesMap = mergeMessagesMaps([messagesMapGame, messagesMapUiPixi, messagesMapUiHtml]);

export default messagesMap;
