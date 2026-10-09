// For each locale, the English strings that must NOT be on screen in it: every
// English value whose translation differs and is not itself one of that
// locale's own values (so a word two languages share is not a false leak).
// Built from the game's catalogues at run time (Node runs .ts directly, as the
// unit tests do).
import { readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..', 'web-sdk', 'apps', 'Ride-The-Bus', 'src', 'i18n', 'messagesMap');
let cache = null;

export async function leakSets() {
  if (cache) return cache;
  const load = async (f) => { const m = await import(pathToFileURL(path.join(DIR, f)).href); return m.default ?? Object.values(m)[0]; };
  const en = await load('en.ts');
  cache = {};
  for (const file of readdirSync(DIR).filter(f => f.endsWith('.ts') && f !== 'index.ts' && f !== 'en.ts')) {
    const cat = await load(file);
    const own = new Set(Object.values(cat).map(v => String(v).trim()));
    cache[file.replace(/\.ts$/, '')] = new Set(Object.keys(en)
      .filter(k => cat[k] !== undefined && cat[k] !== en[k] && en[k].trim().length >= 3 && /[A-Za-z]{3}/.test(en[k]) && !own.has(en[k].trim()) && !/%/.test(en[k]))
      .map(k => en[k].trim()));
  }
  return cache;
}

/** Every visible text node and aria-label on the page. */
export const visibleTexts = (page) => page.evaluate(() => {
  const out = [];
  const walk = (n) => {
    for (const c of n.childNodes) {
      if (c.nodeType === 3) { const t = c.textContent.replace(/\s+/g, ' ').trim(); if (t) out.push(t); }
      else if (c.nodeType === 1) {
        const cs = getComputedStyle(c);
        if (cs.display === 'none' || cs.visibility === 'hidden') continue;
        const al = c.getAttribute('aria-label'); if (al) out.push(al.trim());
        walk(c);
      }
    }
  };
  walk(document.body);
  return out;
});
