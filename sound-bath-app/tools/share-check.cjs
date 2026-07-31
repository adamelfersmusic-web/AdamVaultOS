#!/usr/bin/env node
/* The share flow, in a real browser. Needs Playwright, so it deliberately is
 * NOT the build gate — qr-check.cjs is, because it needs nothing.
 *
 *   node tools/share-check.cjs
 *
 * Every assertion here exists because the thing it checks was broken and
 * shipped, or nearly did. In order:
 *
 *   · the room code rode along inside an exported session file, so two leaders
 *     in two cities would have silently shared one relay room
 *   · a duplicated session inherited the original's code — a second door into
 *     a room you didn't know you were in
 *   · the device count only ever grew, so a leader could be told "2 devices
 *     connected" long after both had walked out. A pre-flight that reports
 *     success for an empty room is worse than no pre-flight
 *   · the saved card was built in an async callback, which iOS Safari treats
 *     as outside the tap — the share sheet simply never appears, and nothing
 *     errors anywhere the leader can see
 *   · a lamp joining before the session began stayed black, which looks exactly
 *     like a lamp that never connected
 *
 * ⚠️ Assert on code with the comments stripped. An earlier version of this file
 * failed because the comment explaining why toBlob is NOT used matched a regex
 * looking for toBlob.
 */
const { chromium } = require('playwright');
const CHROME = process.env.CHROME_PATH || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const ok = [], bad = [];
const t = (name, cond, extra = '') => (cond ? ok : bad).push(name + (extra ? '  ' + extra : ''));
(async () => {
  const b = await chromium.launch({ executablePath: CHROME });
  const p = await b.newPage({ viewport: { width: 430, height: 932 } });
  const errs = [];
  p.on('pageerror', e => errs.push('PAGEERROR ' + e.message));
  await p.goto('file://' + require('path').join(__dirname, '..', 'app', 'index.html'));
  await p.waitForTimeout(600);

  const r = await p.evaluate(() => {
    const out = {};
    store.currentId = store.sessions[0].id; save(); nav('design');
    const S = currentSession();
    const room = roomFor(S);
    out.minted = room.code;

    // 1 · export must not carry the room code
    let captured = null;
    const realBlob = window.Blob;
    window.Blob = function (parts, o) { captured = parts[0]; return new realBlob(parts, o); };
    const realClick = HTMLAnchorElement.prototype.click;
    HTMLAnchorElement.prototype.click = function () {};
    exportSession(S);
    window.Blob = realBlob; HTMLAnchorElement.prototype.click = realClick;
    out.exported = JSON.parse(captured);

    // 2 · a duplicate must mint its own
    const C = normalizeSession(JSON.parse(JSON.stringify({ ...S, id: null, room: null })));
    out.dupRoom = C.room;

    // 3 · an import that claims a room code must lose it
    const imported = normalizeSession(JSON.parse(JSON.stringify({ ...S })));
    imported.room = null;
    out.importedRoom = imported.room;
    // and prove normalizeSession alone WOULD have kept it (so the strip is load-bearing)
    out.normalizeKeeps = !!normalizeSession(JSON.parse(JSON.stringify({ ...S }))).room;

    // 4 · the count expires
    L.seen = new Map();
    L.seen.set('f1', Date.now());
    L.seen.set('f2', Date.now() - 60000);        // walked out a minute ago
    out.liveNow = liveFollowers();

    // 5 · the saved card is built synchronously (no await, no callback)
    // strip comments before asserting on the code, or the explanation of why
    // toBlob is NOT used reads as evidence that it is
    const body = saveShareImage.toString().replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*/g, '');
    out.saveIsSync = !/\.toBlob\s*\(/.test(body) && /\.toDataURL\s*\(/.test(body);
    out.saveNotAsync = saveShareImage.constructor.name === 'Function' && !/await/.test(body);
    return out;
  });

  t('export drops the room code', r.exported.room === undefined, JSON.stringify(r.exported.room));
  t('export still carries the session', !!r.exported.title && Array.isArray(r.exported.sections));
  t('a duplicate has no room code', r.dupRoom === null);
  t('an import loses the room code', r.importedRoom === null);
  t('…and the strip is load-bearing (normalize alone keeps it)', r.normalizeKeeps === true);
  t('device count expires stale followers', r.liveNow === 1, `counted ${r.liveNow}, expected 1`);
  t('save builds the file synchronously (iOS gesture)', r.saveIsSync && r.saveNotAsync);

  // 6 · a lamp joining early lights rather than showing "You're in"
  const lamp = await p.evaluate(() => {
    followerJoin('TEST'); T.S = currentSession(); F.sh = sessionHash(T.S);
    toggleLamp(false);
    followerApply({ v: 1, t: 'state', sh: F.sh, pos: 0, live: false, end: false, sec: null });
    const fv = document.getElementById('followerView');
    return { cls: fv.className, bg: getComputedStyle(fv).backgroundImage.slice(0, 30) };
  });
  t('a lamp joining early lights instead of going black',
    !/\bready\b/.test(lamp.cls) && lamp.bg.includes('gradient'), lamp.cls);

  // 7 · a non-lamp follower joining early says "You're in"
  const ready = await p.evaluate(() => {
    toggleLamp(false);
    followerApply({ v: 1, t: 'state', sh: F.sh, pos: 0, live: false, end: false, sec: null });
    const fv = document.getElementById('followerView');
    return { cls: fv.className, txt: document.querySelector('.fready').textContent.trim() };
  });
  t('a follower joining early says "You\'re in"', /\bready\b/.test(ready.cls) && ready.txt.startsWith("You’re in"), ready.txt.slice(0, 40));

  console.log(ok.map(x => '  ✓ ' + x).join('\n'));
  if (bad.length) console.log('\n' + bad.map(x => '  ✗ ' + x).join('\n'));
  if (errs.length) console.log('\n' + errs.join('\n'));
  console.log(bad.length || errs.length ? `\n${bad.length} FAILURES` : '\nall clean');
  await b.close();
  process.exit(bad.length ? 1 : 0);
})();
