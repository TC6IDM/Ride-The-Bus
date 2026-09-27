#!/usr/bin/env node
/**
 * Rebuild web-sdk/apps/Ride-The-Bus/static/cards/courts.svg from the twelve CC0
 * English-pattern masters in art-masters/courts/.
 *
 *   node scripts/court-art.mjs
 *
 * WHAT IT DOES, and art-masters/courts/README.md says why:
 *   1. Measures every shape of each master in headless Chromium (its bbox in the
 *      card's own units, its resolved paint, the matrix that places it). The
 *      browser does this rather than a path parser here because it is exact,
 *      transforms and all.
 *   2. Keeps the FIGURE: drops the card, the frame, the two corner indices and
 *      the big pip by bbox, which is the same on all twelve. CardFace draws those.
 *   3. Keeps only what touches the upper half. The court is point-symmetric, so
 *      the sprite draws that half clipped at the centre line and again turned
 *      180 degrees.
 *   4. Maps each paint to one of six roles and writes it as
 *      style="fill:var(--cf-x)" - inline style, not a presentation attribute
 *      (var() there is not reliable everywhere), and not a class (whether a
 *      document rule reaches a <use> clone has differed between engines).
 *   5. Rounds to whole units with svgo 3.3.2, fetched through npx rather than
 *      added to the project.
 *   6. RE-RENDERS every court against its master, twice, and exits non-zero on
 *      either:
 *      - SYMMETRY, before rounding: the half-and-turn at full precision may
 *        differ from the master by at most 1% of pixels. That is the check that
 *        the art really is symmetric about the centre it is turned on; a court
 *        that is not (three are turned about a centre a fraction off true)
 *        fails here, loudly, rather than shipping with a crooked lower half.
 *      - ROUNDING, after svgo: whole units move edges by up to half a unit, so
 *        at the 2x the check draws, 5-9% of pixels differ - all of them
 *        antialiased edges, nothing visible at the ~300 physical px a card is
 *        drawn at (compared by eye when this was chosen). The cap is a catch for
 *        svgo breaking a path, which moves far more than that.
 *
 * Output: one sprite of <symbol id="court-<R><S>"> (KS, QH, JD, ...) with a
 * viewBox of the panel inside the English-pattern frame, 30 30 300 480 in the
 * masters' 360x540 card. CardFace places it with the frame it draws itself.
 */
import { readFileSync, writeFileSync, mkdirSync, rmSync, readdirSync } from 'node:fs';
import { execFileSync, execSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/(\w:)/, '$1')), '..');
const MASTERS = path.join(ROOT, 'art-masters', 'courts');
const OUT = path.join(ROOT, 'web-sdk', 'apps', 'Ride-The-Bus', 'static', 'cards', 'courts.svg');
const TMP = path.join(tmpdir(), 'rtb-court-art');
const CHROME =
	process.env.CHROME_PATH ||
	path.join(process.env.LOCALAPPDATA || '', 'ms-playwright/chromium-1234/chrome-win64/chrome.exe');

const RANKS = { king: 'K', queen: 'Q', jack: 'J' };
const SUITS = { spades: 'S', hearts: 'H', diamonds: 'D', clubs: 'C' };

// The panel inside the frame, in the masters' 360x540 units, and its centre.
const PANEL = { x: 30, y: 30, w: 300, h: 480 };
const CY = 270;
// Where each court's lower half is turned about. True centre is (180, 270);
// these three were placed a fraction off it in the master. Found by reading the
// rotation matrices of their lower-half shapes, and proved by the pixel check.
const CENTRES = { QH: [179.47, 269.88], QS: [180.12, 269.75], KC: [179.97, 269.95] };
// A seam-hiding overlap past the centre line, in master units.
const CLIP_H = CY - PANEL.y + 0.6;

// The five inks of the 19th-century pattern as Fomin drew them. Blue as a FILL
// becomes its own role (B, a tint) so a robe does not become a block of line.
const INKS = { P: [255, 255, 255], G: [255, 255, 85], L: [85, 85, 170], T: [255, 85, 85], D: [0, 0, 0] };
const PLACEHOLDER = { P: '#0a0b0c', G: '#1a1b1c', L: '#2a2b2c', T: '#3a3b3c', D: '#4a4b4c', B: '#5a5b5c' };
const ROLE_VAR = { P: '--cf-p', G: '--cf-g', L: '--cf-l', T: '--cf-t', D: '--cf-d', B: '--cf-b' };
// For the pixel check only: every role back in its master ink.
const CHECK_INK = { P: '#ffffff', G: '#ffff55', L: '#5555aa', T: '#ff5555', D: '#000000', B: '#5555aa' };
const MAX_SYMMETRY_PCT = 1.0;
const MAX_ROUNDED_PCT = 12;

// stderr ignored: headless Chrome on Windows prints sandbox and network-service
// warnings on every launch that have nothing to do with the render.
const chrome = (args) =>
	execFileSync(CHROME, ['--headless=new', '--disable-gpu', '--allow-file-access-from-files', '--virtual-time-budget=30000', ...args], {
		encoding: 'utf8',
		maxBuffer: 1 << 28,
		stdio: ['ignore', 'pipe', 'ignore'],
	});
const fileUrl = (p) => 'file:///' + p.replace(/\\/g, '/');
const readOut = (dom) =>
	dom.match(/<pre id="out">([\s\S]*?)<\/pre>/)[1].replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');

// Shared between the measuring page and the checking page, so both drop the
// same shapes by the same rule.
const DROP_JS = `
const inside = (b, r) => b[0] >= r[0]-0.5 && b[1] >= r[1]-0.5 && b[2] <= r[2]+0.5 && b[3] <= r[3]+0.5;
const near = (b, r) => b.every((v, i) => Math.abs(v - r[i]) < 1.5);
const drop = (b) =>
  (b[2]-b[0] >= 355 && b[3]-b[1] >= 535) ||              // the card
  near(b, [60,30,330,390]) || near(b, [30,150,300,510]) || // the frame's two L's
  inside(b, [0,0,60,150]) || inside(b, [300,390,360,540]) || // corner indices
  near(b, [60,45,120,135]) || near(b, [240,405,300,495]);  // the big pip
function boxOf(el, inv) {
  const m = inv.multiply(el.getScreenCTM()), bb = el.getBBox();
  const pts = [[bb.x,bb.y],[bb.x+bb.width,bb.y],[bb.x,bb.y+bb.height],[bb.x+bb.width,bb.y+bb.height]].map(([x,y]) => [m.a*x+m.c*y+m.e, m.b*x+m.d*y+m.f]);
  return { m, b: [Math.min(...pts.map(p=>p[0])), Math.min(...pts.map(p=>p[1])), Math.max(...pts.map(p=>p[0])), Math.max(...pts.map(p=>p[1]))] };
}
const SHAPES = 'path,rect,circle,ellipse,polygon,polyline,line';
`;

function measure(svgText, key) {
	const page = `<!doctype html><html><body>${svgText.replace(/<\?xml[^>]*>/, '')}<pre id="out"></pre><script>
${DROP_JS}
const root = document.querySelector('svg');
root.setAttribute('viewBox', '0 0 ' + root.getAttribute('width') + ' ' + root.getAttribute('height'));
const inv = root.getScreenCTM().inverse();
const shapes = [];
for (const el of root.querySelectorAll(SHAPES)) {
  if (el.closest('defs,clipPath,mask,pattern,symbol')) continue;
  const cs = getComputedStyle(el);
  if (cs.display === 'none' || cs.visibility === 'hidden') continue;
  const { m, b } = boxOf(el, inv);
  if (drop(b)) continue;
  shapes.push({
    tag: el.tagName, box: b, m: [m.a,m.b,m.c,m.d,m.e,m.f],
    fill: cs.fill, stroke: cs.stroke, sw: cs.strokeWidth, op: cs.opacity, fo: cs.fillOpacity, so: cs.strokeOpacity,
    rule: cs.fillRule, join: cs.strokeLinejoin, cap: cs.strokeLinecap, ml: cs.strokeMiterlimit, dash: cs.strokeDasharray,
    d: el.tagName === 'path' ? el.getAttribute('d') : null,
    attrs: el.tagName === 'path' ? null : Object.fromEntries([...el.attributes].filter(a => ['x','y','width','height','rx','ry','cx','cy','r','points','x1','y1','x2','y2'].includes(a.name)).map(a => [a.name, a.value])),
  });
}
document.getElementById('out').textContent = JSON.stringify(shapes);
</script></body></html>`;
	const file = path.join(TMP, `measure_${key}.html`);
	writeFileSync(file, page);
	return JSON.parse(readOut(chrome(['--dump-dom', fileUrl(file)])));
}

function role(css, key) {
	if (!css || css === 'none') return null;
	const m = css.match(/rgba?\(([^)]+)\)/);
	if (!m) throw new Error(`${key}: unhandled paint ${css}`);
	const [r, g, b] = m[1].split(',').map(Number);
	let best = null;
	let bd = Infinity;
	for (const [k, [R, G, B]] of Object.entries(INKS)) {
		const d = (r - R) ** 2 + (g - G) ** 2 + (b - B) ** 2;
		if (d < bd) [bd, best] = [d, k];
	}
	if (bd > 40 ** 2) throw new Error(`${key}: paint ${css} is far from every ink`);
	return best;
}

const num = (v) => +(+v).toFixed(4);

function flatHalf(shapes, key) {
	const out = [];
	for (const s of shapes) {
		if (s.box[1] >= CY + 0.5) continue; // wholly in the lower half: drawn by the turn
		const f0 = role(s.fill, key);
		const st = role(s.stroke, key);
		const f = f0 === 'L' ? 'B' : f0;
		const a = [`fill="${f ? PLACEHOLDER[f] : 'none'}"`];
		if (st) {
			a.push(`stroke="${PLACEHOLDER[st]}"`, `stroke-width="${parseFloat(s.sw)}"`);
			if (s.join !== 'miter') a.push(`stroke-linejoin="${s.join}"`);
			if (s.cap !== 'butt') a.push(`stroke-linecap="${s.cap}"`);
			if (s.ml !== '4') a.push(`stroke-miterlimit="${s.ml}"`);
			if (s.dash !== 'none') a.push(`stroke-dasharray="${s.dash}"`);
			if (s.so !== '1') a.push(`stroke-opacity="${s.so}"`);
		}
		if (s.rule === 'evenodd') a.push('fill-rule="evenodd"');
		if (s.fo !== '1') a.push(`fill-opacity="${s.fo}"`);
		if (s.op !== '1') a.push(`opacity="${s.op}"`);
		const m = s.m;
		if (!(m[0] === 1 && m[1] === 0 && m[2] === 0 && m[3] === 1 && m[4] === 0 && m[5] === 0)) a.push(`transform="matrix(${m.map(num).join(' ')})"`);
		if (s.tag === 'path') out.push(`<path d="${s.d}" ${a.join(' ')}/>`);
		else out.push(`<${s.tag} ${Object.entries(s.attrs).map(([k, v]) => `${k}="${v}"`).join(' ')} ${a.join(' ')}/>`);
	}
	return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${PANEL.x} ${PANEL.y} ${PANEL.w} ${CY - PANEL.y}">${out.join('')}</svg>`;
}

const inner = (svg) => svg.replace(/^[\s\S]*?<svg[^>]*>/, '').replace(/<\/svg>\s*$/, '');

/** Placeholder paints -> one style attribute per element, in CSS variables. */
function toVars(body) {
	const byHex = Object.fromEntries(Object.entries(PLACEHOLDER).map(([k, v]) => [v, k]));
	return body.replace(/<(path|rect|circle|ellipse|polygon|polyline|line)\b([^>]*?)(\/?)>/g, (_, tag, attrs, close) => {
		const style = [];
		attrs = attrs.replace(/\s(fill|stroke)="(#[0-9a-f]{6})"/g, (m, prop, hex) => {
			const r = byHex[hex];
			if (!r) throw new Error(`unmapped paint ${hex}`);
			style.push(`${prop}:var(${ROLE_VAR[r]})`);
			return '';
		});
		return `<${tag}${attrs}${style.length ? ` style="${style.join(';')}"` : ''}${close}>`;
	});
}

function symbolFor(key, body) {
	const c = CENTRES[key] ?? [180, CY];
	// The half lives in <defs> so the sprite itself draws nothing; only the
	// symbol's two <use>s put it on a card.
	return (
		`<defs><clipPath id="court-${key}-c"><rect x="${PANEL.x}" y="${PANEL.y}" width="${PANEL.w}" height="${CLIP_H}"/></clipPath>` +
		`<g id="court-${key}-h" clip-path="url(#court-${key}-c)">${body}</g></defs>` +
		`<symbol id="court-${key}" viewBox="${PANEL.x} ${PANEL.y} ${PANEL.w} ${PANEL.h}">` +
		`<use href="#court-${key}-h"/><use href="#court-${key}-h" transform="rotate(180 ${c[0]} ${c[1]})"/>` +
		`</symbol>`
	);
}

function check(items) {
	// Draw each master's figure (the same shapes dropped) and each rebuilt court
	// into canvases at 2x and count differing pixels.
	const page = `<!doctype html><html><body><div id="host"></div><pre id="out"></pre><script type="module">
${DROP_JS}
const items = ${JSON.stringify(items)};
const S = 2, W = 300 * S, H = 480 * S;
async function draw(t) {
  const img = new Image();
  img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(t);
  await img.decode();
  const c = new OffscreenCanvas(W, H), x = c.getContext('2d');
  x.fillStyle = '#fff'; x.fillRect(0, 0, W, H); x.drawImage(img, 0, 0, W, H);
  return x.getImageData(0, 0, W, H).data;
}
const res = {};
const host = document.getElementById('host');
for (const it of items) {
  host.innerHTML = it.master;
  const svg = host.querySelector('svg');
  svg.setAttribute('viewBox', '0 0 ' + svg.getAttribute('width') + ' ' + svg.getAttribute('height'));
  const inv = svg.getScreenCTM().inverse();
  for (const el of [...svg.querySelectorAll(SHAPES)]) { if (!el.closest('defs') && drop(boxOf(el, inv).b)) el.remove(); }
  svg.setAttribute('viewBox', '30 30 300 480'); svg.setAttribute('width', 300); svg.setAttribute('height', 480);
  const a = await draw(new XMLSerializer().serializeToString(svg)), b = await draw(it.rebuilt);
  let n = 0;
  for (let i = 0; i < a.length; i += 4) if (Math.abs(a[i]-b[i]) + Math.abs(a[i+1]-b[i+1]) + Math.abs(a[i+2]-b[i+2]) > 120) n++;
  res[it.key] = +(100 * n / (W * H)).toFixed(3);
}
document.getElementById('out').textContent = JSON.stringify(res);
</script></body></html>`;
	const file = path.join(TMP, 'check.html');
	writeFileSync(file, page);
	return JSON.parse(readOut(chrome(['--dump-dom', fileUrl(file)])));
}

// ---------------------------------------------------------------------------

rmSync(TMP, { recursive: true, force: true });
mkdirSync(path.join(TMP, 'flat'), { recursive: true });
mkdirSync(path.join(TMP, 'opt'), { recursive: true });

const courts = [];
for (const [rName, R] of Object.entries(RANKS)) {
	for (const [sName, S] of Object.entries(SUITS)) {
		const key = R + S;
		const master = readFileSync(path.join(MASTERS, `English_pattern_${rName}_of_${sName}.svg`), 'utf8');
		const shapes = measure(master, key);
		writeFileSync(path.join(TMP, 'flat', `${key}.svg`), flatHalf(shapes, key));
		courts.push({ key, master: master.replace(/<\?xml[^>]*>/, '') });
		process.stdout.write(`measured ${key} (${shapes.length} shapes kept)\n`);
	}
}

writeFileSync(
	path.join(TMP, 'svgo.config.mjs'),
	`export default { multipass: true, floatPrecision: 0, plugins: [
  { name: 'preset-default', params: { overrides: { convertColors: false, removeViewBox: false,
    convertPathData: { floatPrecision: 0, transformPrecision: 4 }, cleanupNumericValues: { floatPrecision: 0 } } } },
  'convertStyleToAttrs', 'removeDimensions' ] };\n`,
);
// One command string through the shell: npx is npx.cmd on Windows, which Node
// will only spawn through a shell, and handing it an argument array there is
// deprecated (DEP0190). Every path is our own temp dir, quoted.
execSync(`npx -y svgo@3.3.2 --config "${path.join(TMP, 'svgo.config.mjs')}" -f "${path.join(TMP, 'flat')}" -o "${path.join(TMP, 'opt')}" -q`, {
	stdio: 'inherit',
});

const bodies = Object.fromEntries(readdirSync(path.join(TMP, 'opt')).map((f) => [f.slice(0, -4), inner(readFileSync(path.join(TMP, 'opt', f), 'utf8'))]));

// The two pixel checks, in the master's own inks: the flat half at full
// precision (symmetry), then the svgo output (rounding).
const rebuiltFor = (key, body) => {
	for (const [r, hex] of Object.entries(PLACEHOLDER)) body = body.split(hex).join(CHECK_INK[r]);
	const c = CENTRES[key] ?? [180, CY];
	return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="30 30 300 480" width="300" height="480"><clipPath id="c"><rect x="30" y="30" width="300" height="${CLIP_H}"/></clipPath><g id="h" clip-path="url(#c)">${body}</g><use href="#h" transform="rotate(180 ${c[0]} ${c[1]})"/></svg>`;
};
const flatBodies = Object.fromEntries(courts.map(({ key }) => [key, inner(readFileSync(path.join(TMP, 'flat', `${key}.svg`), 'utf8'))]));
const symmetry = check(courts.map(({ key, master }) => ({ key, master, rebuilt: rebuiltFor(key, flatBodies[key]) })));
const rounded = check(courts.map(({ key, master }) => ({ key, master, rebuilt: rebuiltFor(key, bodies[key]) })));
let failed = false;
for (const { key } of courts) {
	const bad = symmetry[key] > MAX_SYMMETRY_PCT || rounded[key] > MAX_ROUNDED_PCT;
	failed ||= bad;
	process.stdout.write(`${bad ? 'FAIL' : 'ok  '} ${key}  symmetry ${symmetry[key]}% (max ${MAX_SYMMETRY_PCT})  rounded ${rounded[key]}% (max ${MAX_ROUNDED_PCT})\n`);
}
if (failed) {
	console.error('\nA rebuilt court strays from its master past a limit above. Nothing written.');
	process.exit(1);
}

const sprite =
	`<svg xmlns="http://www.w3.org/2000/svg">` +
	`<!-- Court card figures for Ride The Bus. Generated by scripts/court-art.mjs from the CC0 1.0 English-pattern ` +
	`cards by Dmitry Fomin (Wikimedia Commons); art-masters/courts/README.md has the provenance. Do not edit by hand. -->` +
	courts.map(({ key }) => symbolFor(key, toVars(bodies[key]))).join('') +
	`</svg>\n`;
mkdirSync(path.dirname(OUT), { recursive: true });
writeFileSync(OUT, sprite);
process.stdout.write(`\nwrote ${path.relative(ROOT, OUT)}: ${sprite.length} bytes\n`);
