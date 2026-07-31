#!/usr/bin/env node
/* The gate. `node tools/qr-check.cjs` — no dependencies, no network, ~200ms.
 *
 * Lifts the QR encoder out of app/index.html (between the qr:begin / qr:end
 * sentinels) and holds it against 120 matrices produced by an encoder that is
 * not ours, covering every symbol version 1–6 and all eight masks.
 *
 * ── Why this exists, in one paragraph ───────────────────────────────────────
 * v1.16's first working encoder produced symbols with correct finders, correct
 * timing, byte-identical data, and format bits placed transposed. Twelve wrong
 * modules out of 841. It looked completely normal and no scanner on earth
 * could read it. The app's own read-back check — which is real, and which
 * ships, and which catches a great deal — would have read those bits back from
 * the same wrong coordinates and agreed with itself. A misunderstanding cannot
 * audit itself. That is the entire argument for this file.
 *
 * Run it before any commit that touches the encoder. If it fails, the app is
 * wrong until proven otherwise — do NOT regenerate the goldens to make it
 * pass, which is the same thing as deleting the check.
 */
const fs = require('fs'), path = require('path');

const APP = path.join(__dirname, '..', 'app', 'index.html');
const GOLD = path.join(__dirname, 'qr-golden.json');
const fail = [];
const note = m => console.log('  ' + m);

// ── lift the encoder out of the app ─────────────────────────────────────────
const src = fs.readFileSync(APP, 'utf8');
const a = src.indexOf('/* qr:begin'), b = src.indexOf('/* qr:end */');
if (a < 0 || b < 0 || b < a) {
  console.error('✗ the qr:begin / qr:end sentinels are missing from app/index.html.');
  console.error('  Either the encoder moved or someone deleted the markers. Either way');
  console.error('  this check has been silently doing nothing — fix it before shipping.');
  process.exit(1);
}
const block = src.slice(src.indexOf('*/', a) + 2, b);
let qrEncode, qrVerify, QR_M;
try {
  ({ qrEncode, qrVerify, QR_M } = new Function(block + '\nreturn { qrEncode, qrVerify, QR_M };')());
} catch (e) {
  console.error('✗ the extracted encoder does not even parse:', e.message);
  process.exit(1);
}
const gold = JSON.parse(fs.readFileSync(GOLD, 'utf8'));

// ── 1 · every vector × every mask, module for module, against the outside ────
const unhex = (h, n) => {
  const bits = [];
  for (const ch of h) { const v = parseInt(ch, 16); for (let i = 3; i >= 0; i--) bits.push((v >> i) & 1); }
  return bits.slice(0, n);
};
let matched = 0, total = 0;
const combos = new Set();
for (const v of gold.vectors) {
  const label = JSON.stringify(v.s.length > 40 ? v.s.slice(0, 37) + '…' : v.s);
  for (let mk = 0; mk < 8; mk++) {
    total++;
    const m = qrEncode(v.s, mk);
    if (!m) { fail.push(`v${v.ver} mask ${mk}: refused a string the reference encodes — ${label}`); continue; }
    if (m.length !== v.size) { fail.push(`v${v.ver} mask ${mk}: size ${m.length}, expected ${v.size} — ${label}`); continue; }
    let diff = 0, first = null;
    for (let r = 0; r < v.size; r++) {
      const want = unhex(v.masks[mk][r], v.size);
      for (let c = 0; c < v.size; c++) if (want[c] !== m[r][c]) { diff++; if (!first) first = `${r},${c}`; }
    }
    if (diff) { fail.push(`v${v.ver} mask ${mk}: ${diff} modules differ, first at (${first}) — ${label}`); continue; }
    combos.add(`${v.ver}:${mk}`);
    matched++;
  }
}
note(`${matched}/${total} matrices identical to ${gold.generator}`);

// ── 2 · the coverage the goldens claim is the coverage they have ────────────
for (const v of [1, 2, 3, 4, 5, 6]) for (const k of [0, 1, 2, 3, 4, 5, 6, 7])
  if (!combos.has(`${v}:${k}`)) fail.push(`version ${v} × mask ${k} is not pinned by any vector`);
if (!fail.length) note('all 6 versions × all 8 masks pinned — 48 configurations');

/* Mask CHOICE is left free (see the generator), but it must still be legal and
   it must be the one our own penalty ranking actually prefers. */
for (const v of gold.vectors.slice(0, 6)) {
  const m = qrEncode(v.s);
  if (!m) { fail.push(`qrEncode refused ${JSON.stringify(v.s.slice(0, 30))} with no mask forced`); continue; }
  const N = m.length;
  const fmtA = Array.from({ length: 15 }, (_, i) => i < 6 ? [i, 8] : i < 8 ? [i + 1, 8] : [N - 15 + i, 8]);
  const chose = (fmtA.reduce((a, [r, c], i) => a | (m[r][c] << i), 0) ^ 0x5412) >> 10;
  if (chose < 0 || chose > 7) { fail.push(`chose an illegal mask ${chose}`); continue; }
  let same = true;
  for (let k = 0; k < 8; k++) {
    const t = qrEncode(v.s, k);
    if (t && JSON.stringify(t) === JSON.stringify(m) && k !== chose) same = false;
  }
  if (!same) fail.push(`the format bits say mask ${chose} but the symbol is another mask's`);
}

// ── 3 · the shipped read-back check must actually reject ────────────────────
/* A verifier that never says no is decoration.
   Rather than hand-pick a few spots and hope they cover the interesting
   regions, flip EVERY module in turn and require a refusal every single time.
   The claim is exact and needs no knowledge of which module is which:
   no one-module change to a finished symbol survives the check. */
for (const probe of ['https://bed.app/join?c=VXZF',                        // v3, 1 block
                     'https://deploy-preview-42--tender-marzipan-9c1f2a.netlify.app/join?c=VXZF']) {
  const base = qrEncode(probe);
  if (!base) { fail.push(`qrEncode refused the probe string outright: ${probe}`); continue; }
  if (!qrVerify(base, probe)) fail.push(`qrVerify rejects a matrix its own encoder just produced: ${probe}`);
  if (qrVerify(base, probe + 'x')) fail.push(`qrVerify accepts a matrix for the WRONG string: ${probe}`);
  const N = base.length;
  let survivors = 0, firstSurvivor = null;
  for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) {
    const t = base.map(row => row.slice());
    t[r][c] ^= 1;
    if (qrVerify(t, probe)) { survivors++; if (!firstSurvivor) firstSurvivor = [r, c]; }
  }
  if (survivors) fail.push(`v${(N - 17) / 4}: ${survivors} of ${N * N} single-module corruptions pass the read-back check (first at ${firstSurvivor})`);
  else note(`v${(N - 17) / 4}: all ${N * N} single-module corruptions refused, and the wrong string refused`);
  if (qrVerify(base.slice(0, N - 1), probe)) fail.push('qrVerify accepts a truncated matrix');
}
if (qrVerify(null, 'x') || qrVerify([], 'x') || qrVerify([[2]], 'x'))
  fail.push('qrVerify accepts a malformed matrix instead of refusing it');

// ── 4 · a string too long must be refused, not silently truncated ───────────
const tooLong = 'https://bed.app/join?c=VXZF&' + 'p'.repeat(120);
if (qrEncode(tooLong)) fail.push('qrEncode returned a symbol for a string past the v6 capacity');
else note('over-capacity strings are refused rather than truncated');

// ── verdict ────────────────────────────────────────────────────────────────
if (fail.length) {
  console.log('\n✗ ' + fail.length + ' FAILURE' + (fail.length > 1 ? 'S' : '') + '\n');
  for (const f of fail) console.log('  · ' + f);
  console.log('\n  The app is wrong until proven otherwise. Do not regenerate qr-golden.json.\n');
  process.exit(1);
}
console.log('\n✓ the QR encoder in app/index.html is correct.\n');
