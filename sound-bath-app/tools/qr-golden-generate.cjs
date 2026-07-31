#!/usr/bin/env node
/* Regenerate tools/qr-golden.json.
 *
 *   npm install qrcode          (once, anywhere — the only time it's needed)
 *   node tools/qr-golden-generate.cjs
 *
 * ⚠️ ⚠️ ⚠️  THE ONE RULE  ⚠️ ⚠️ ⚠️
 * The expected matrices in qr-golden.json MUST come from an encoder that is
 * not ours. Never regenerate them from app/index.html — not to "fix a failing
 * test", not even when our output is obviously right. The whole and only
 * purpose of that file is to be an opinion formed outside our own head.
 *
 * The bug this exists for: v1.16's first working encoder placed the format
 * bits transposed. Finders correct, timing correct, data byte-identical — and
 * unreadable by every scanner on earth. The app's own read-back check, which
 * is real and which ships, would have read those bits back from the same wrong
 * coordinates and agreed with itself. A misunderstanding cannot audit itself.
 *
 * If this disagrees with the app, the app is wrong until proven otherwise.
 * Regenerating the goldens to make the check pass is the same act as deleting
 * the check.
 *
 * ── What is pinned, and what deliberately is not ────────────────────────────
 * Pinned: module placement, for every symbol version 1–6 × every mask 0–7.
 * Not pinned: which mask the app CHOOSES. That is a heuristic — the spec's
 * penalty rules are read slightly differently by every implementation, and two
 * encoders can choose different masks and both be completely correct. Holding
 * ourselves byte-exact to another library's heuristic would turn the gate red
 * for a change that harms nothing, and a gate that cries wolf gets switched
 * off. So every mask is pinned and the choice among them is left free.
 */
const fs = require('fs'), path = require('path');
let QRCode;
try { QRCode = require('qrcode'); } catch (e) {
  console.error('This needs the independent reference encoder:\n\n    npm install qrcode\n');
  process.exit(1);
}

/* ⚠️ FORCE SINGLE-SEGMENT BYTE MODE.
   The reference is cleverer than we are: left alone it splits a string into
   numeric / alphanumeric / byte segments and emits a smaller, different — and
   equally valid — symbol. Both scan, both decode to the same text, so
   comparing against its default output compares two right answers and calls
   ours wrong. The app only ever emits one byte segment, so that is what it
   must be measured against. */
const ref = (s, mask) => QRCode.create([{ data: s, mode: 'byte' }],
  { errorCorrectionLevel: 'M', maskPattern: mask });

/* Real join links, plus the exact capacity boundary of every version in both
   directions — because the ends of the range are where the config changes
   shape (v1 has NO alignment pattern, v6 is the first with four blocks rather
   than one or two), and those are the branches that break the day the domain
   gets longer. Lowercase on purpose: uppercase is ALPHANUMERIC to a QR
   encoder, and an alphanumeric-looking payload would exercise a mode the app
   does not have. */
const CAP = { 1: 14, 2: 26, 3: 42, 4: 62, 5: 84, 6: 106 };
const strings = [
  'https://bed.app/j?c=vxzf',
  'https://bed.app/join?c=vxzf',
  'https://tender-marzipan-9c1f2a.netlify.app/join?c=vxzf',
  'https://tender-marzipan-9c1f2a.netlify.app/join?c=vxzf&lamp=1',
  'http://192.168.1.44:8080/join?c=7k2m',
  'https://deploy-preview-42--tender-marzipan-9c1f2a.netlify.app/join?c=vxzf',
];
for (const v of [1, 2, 3, 4, 5, 6]) {
  strings.push('bed'.repeat(99).slice(0, CAP[v]));        // the last byte that fits
  strings.push('bed'.repeat(99).slice(0, CAP[v] - 1));    // and the one before it
}

const hex = row => {
  let out = '';
  for (let i = 0; i < row.length; i += 4)
    out += (((row[i] || 0) << 3) | ((row[i + 1] || 0) << 2) |
            ((row[i + 2] || 0) << 1) | (row[i + 3] || 0)).toString(16);
  return out;
};

const vectors = [], seenVer = new Set();
for (const s of strings) {
  const masks = {};
  let size = 0;
  for (let mk = 0; mk < 8; mk++) {
    const q = ref(s, mk);
    if (q.maskPattern !== mk) { console.error(`✗ the reference ignored maskPattern ${mk}`); process.exit(1); }
    const N = q.modules.size;
    if (N > 41) { console.error(`✗ "${s.slice(0, 30)}" needs version ${(N - 17) / 4}, past what the app builds`); process.exit(1); }
    size = N;
    const rows = [];
    for (let r = 0; r < N; r++) {
      const row = [];
      for (let c = 0; c < N; c++) row.push(q.modules.data[r * N + c] ? 1 : 0);
      rows.push(hex(row));
    }
    masks[mk] = rows;
  }
  seenVer.add((size - 17) / 4);
  vectors.push({ s, ver: (size - 17) / 4, size, masks });
}

const missing = [1, 2, 3, 4, 5, 6].filter(v => !seenVer.has(v));
if (missing.length) { console.error(`✗ nothing reaches version(s) ${missing} — coverage is incomplete`); process.exit(1); }

const dest = path.join(__dirname, 'qr-golden.json');
fs.writeFileSync(dest, JSON.stringify({
  README: 'Expected QR matrices from an INDEPENDENT encoder (npm qrcode): byte mode, EC level M, every mask forced. NEVER regenerate these from app/index.html — see tools/qr-golden-generate.cjs.',
  generator: 'npm qrcode ' + require('qrcode/package.json').version,
  ec: 'M', mode: 'byte',
  versions: [...seenVer].sort(),
  masks: [0, 1, 2, 3, 4, 5, 6, 7],
  vectors,
}, null, 1) + '\n');
console.log(`${vectors.length} strings × 8 masks = ${vectors.length * 8} matrices → ${dest}`);
console.log(`versions ${[...seenVer].sort().join(',')} — all six`);
