/**
 * Every currency the RGS can send, with the name Stake's own dashboard shows.
 *
 * WHY THIS EXISTS. The game formats through Intl and therefore "supports" any
 * ISO code without a list - but three things do need one: the dev replay page's
 * picker (which had fourteen of them), the decimals table in
 * utils-shared/currency, and a test that can actually walk the set and prove
 * none of them throws, renders as a raw code, or produces a figure the control
 * bar cannot hold.
 *
 * The names are the ones on the Stake Engine site's currency dropdown, so this
 * file can be diffed against it by eye.
 *
 * XGC / XSC / XEC are the social-casino currencies. Intl has no symbol for
 * them and they are displayed as a SUFFIX ("10.00 SC") - see
 * NO_LOCALISATION_CURRENCY_MAP in utils-shared/amount.
 */
export type CurrencyInfo = { code: string; name: string };

export const CURRENCIES: readonly CurrencyInfo[] = [
  { code: 'USD', name: 'United States Dollar' },
  { code: 'CAD', name: 'Canadian Dollar' },
  { code: 'JPY', name: 'Japanese Yen' },
  { code: 'EUR', name: 'Euro' },
  { code: 'RUB', name: 'Russian Ruble' },
  { code: 'CNY', name: 'Chinese Yuan' },
  { code: 'PHP', name: 'Philippine Peso' },
  { code: 'INR', name: 'Indian Rupee' },
  { code: 'IDR', name: 'Indonesian Rupiah' },
  { code: 'KRW', name: 'South Korean Won' },
  { code: 'BRL', name: 'Brazilian Real' },
  { code: 'MXN', name: 'Mexican Peso' },
  { code: 'DKK', name: 'Danish Krone' },
  { code: 'PLN', name: 'Polish Zloty' },
  { code: 'VND', name: 'Vietnamese Dong' },
  { code: 'TRY', name: 'Turkish Lira' },
  { code: 'CLP', name: 'Chilean Peso' },
  { code: 'ARS', name: 'Argentine Peso' },
  { code: 'PEN', name: 'Peruvian Sol' },
  { code: 'NGN', name: 'Nigerian Naira' },
  { code: 'SAR', name: 'Saudi Riyal' },
  { code: 'ILS', name: 'Israeli New Shekel' },
  { code: 'AED', name: 'UAE Dirham' },
  { code: 'TWD', name: 'Taiwan New Dollar' },
  { code: 'NOK', name: 'Norwegian Krone' },
  { code: 'KWD', name: 'Kuwaiti Dinar' },
  { code: 'JOD', name: 'Jordanian Dinar' },
  { code: 'CRC', name: 'Costa Rican Colon' },
  { code: 'TND', name: 'Tunisian Dinar' },
  { code: 'SGD', name: 'Singapore Dollar' },
  { code: 'MYR', name: 'Malaysian Ringgit' },
  { code: 'OMR', name: 'Omani Rial' },
  { code: 'QAR', name: 'Qatari Riyal' },
  { code: 'BHD', name: 'Bahraini Dinar' },
  { code: 'PKR', name: 'Pakistani Rupee' },
  { code: 'EGP', name: 'Egyptian Pound' },
  { code: 'NZD', name: 'New Zealand Dollar' },
  { code: 'BOB', name: 'Bolivian Boliviano' },
  { code: 'GHS', name: 'Ghanaian Cedi' },
  { code: 'KES', name: 'Kenyan Shilling' },
  { code: 'MAD', name: 'Moroccan Dirham' },
  { code: 'BAM', name: 'Bosnia and Herzegovina Convertible Mark' },
  { code: 'ISK', name: 'Icelandic Krona' },
  { code: 'TZS', name: 'Tanzanian Shilling' },
  { code: 'UGX', name: 'Ugandan Shilling' },
  { code: 'XOF', name: 'West African CFA Franc' },
  { code: 'XGC', name: 'Gold Coins (social)' },
  { code: 'XSC', name: 'Stake Cash (social)' },
  { code: 'XEC', name: 'Stake Euro Cash (social)' },
];

export const CURRENCY_CODES: readonly string[] = CURRENCIES.map((c) => c.code);
