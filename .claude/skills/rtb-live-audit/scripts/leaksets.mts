// For each locale: the English strings that must NOT appear on screen in it -
// every English value whose translation differs and is not itself some value in
// that locale's catalogue.
import { readdirSync, writeFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

const dir = 'C:/Users/tcand/Desktop/Ride-The-Bus-monorepo/web-sdk/apps/Ride-The-Bus/src/i18n/messagesMap/';
const load = async (f: string) => { const m = await import(pathToFileURL(dir + f).href); return (m.default ?? Object.values(m)[0]) as Record<string, string>; };
const en = await load('en.ts');
const out: Record<string, string[]> = {};
for (const file of readdirSync(dir).filter((f) => f.endsWith('.ts') && f !== 'index.ts' && f !== 'en.ts')) {
  const cat = await load(file);
  const own = new Set(Object.values(cat).map((v) => v.trim()));
  out[file.slice(0, 2)] = Object.keys(en)
    .filter((k) => cat[k] !== undefined && cat[k] !== en[k] && en[k].trim().length >= 3 && /[A-Za-z]{3}/.test(en[k]) && !own.has(en[k].trim()) && !/%/.test(en[k]))
    .map((k) => en[k].trim());
}
writeFileSync('C:/Users/tcand/AppData/Local/Temp/rtb-live/leaksets.json', JSON.stringify(out));
console.log(Object.fromEntries(Object.entries(out).map(([k, v]) => [k, v.length])));
