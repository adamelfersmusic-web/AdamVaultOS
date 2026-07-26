// Escensus white-label brand seam.
// ---------------------------------------------------------------------------
// ONE registry, ONE active brand. Adding a client = adding one entry below;
// the whole app re-themes itself from it. Escensus is the default, so nothing
// changes unless a brand is explicitly selected — the live Escensus build is
// never touched by this file.
//
// The same engine wearing different skins is the point: it is the concrete
// proof that the value is the SYSTEM, not any one agency's app. The branding
// is a thin, swappable layer over a reusable core.
//
// Select a brand by (in order): ?brand=<id> in the URL (sticks via
// localStorage, handy for demos), then the hostname/path (e.g. a /peak/ deploy
// or a peak.* subdomain), then Escensus.
(function () {
  var BRANDS = {
    escensus: {
      name: 'Escensus',            // header wordmark
      appName: 'Escensus',         // used in the browser title
      accent: '#cba14b',
      accentBright: '#ddb968',
      themeColor: '#0c1b2a',
      poweredBy: false             // Escensus is the source; no attribution line
    },
    // Peak Financial — black + gold (matches their agent dashboard + site).
    // Gold hex is eyeballed from their wordmark; swap for exact brand hex + the
    // mountain/art-deco logo when provided.
    peak: {
      name: 'Peak',
      appName: 'Peak Training',
      accent: '#c6a15b',
      accentBright: '#dcc084',
      themeColor: '#000000',
      bg: '#0a0a0a', bgDeep: '#000000', panel: '#161616', panel2: '#1f1f1f',
      poweredBy: true              // licensed skin — provenance stays visible
    },
    // A second generic instance, to demonstrate the engine renders N brands.
    meridian: {
      name: 'Meridian',
      appName: 'Meridian Training',
      accent: '#1f9e8c',
      accentBright: '#35c0aa',
      themeColor: '#0c1b2a',
      poweredBy: true
    }
  };

  // A skin comes from an explicit ?brand=<id> (the demo switcher / a URL), or a
  // real client deploy (its own hostname / a /<brand>/ path). An explicit choice
  // is remembered in sessionStorage — TAB-SCOPED, so it survives clicking around
  // the demo but clears the moment the tab closes. It is NEVER written to
  // localStorage, so a fresh tab / the official site is ALWAYS Escensus and can
  // never get permanently reskinned.
  var realDeploy = false;
  function pickId() {
    try {
      var q = new URLSearchParams(location.search).get('brand');
      if (q !== null) {
        if (BRANDS[q]) { sessionStorage.setItem('esc_brand', q); return q; }
        sessionStorage.removeItem('esc_brand'); // ?brand= (empty/unknown) resets to Escensus
      }
      var s = sessionStorage.getItem('esc_brand');
      if (s && BRANDS[s]) return s;
    } catch (e) {}
    var h = (location.hostname || '').toLowerCase();
    var p = (location.pathname || '').toLowerCase();
    for (var id in BRANDS) {
      if (id === 'escensus') continue;
      if (h.indexOf(id) !== -1 || p.indexOf('/' + id) !== -1) { realDeploy = true; return id; }
    }
    return 'escensus';
  }

  var B = BRANDS[pickId()] || BRANDS.escensus;
  window.BRAND = B;

  // Theme tokens applied to <html> immediately (an inline style on the root
  // element beats the :root rule in the stylesheet, so this wins with no flash
  // for the accent color). The stylesheet's Escensus defaults still render if
  // this file ever fails to load — the default brand is bulletproof.
  var rs = document.documentElement.style;
  rs.setProperty('--gold', B.accent);
  rs.setProperty('--gold-bright', B.accentBright);
  // Optional background palette (a brand can go darker/lighter than Escensus navy).
  if (B.bg) rs.setProperty('--navy', B.bg);
  if (B.bgDeep) rs.setProperty('--navy-deep', B.bgDeep);
  if (B.panel) rs.setProperty('--panel', B.panel);
  if (B.panel2) rs.setProperty('--panel-2', B.panel2);

  function apply() {
    try {
      if (document.title) document.title = document.title.replace(/Escensus/g, B.name);
      var nm = document.querySelector('.brand .name');
      if (nm) nm.textContent = B.name;
      var tc = document.querySelector('meta[name="theme-color"]');
      if (tc) tc.setAttribute('content', B.themeColor);
      // Re-label visible "Escensus" brand text (eyebrows, body copy) to the active
      // brand. Runs BEFORE the poweredBy line is added, so provenance keeps the
      // Escensus name. No-op for the Escensus brand itself.
      if (B.name !== 'Escensus' && document.body) {
        var walk = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, null);
        var hits = [], t;
        while ((t = walk.nextNode())) {
          var pn = t.parentNode ? t.parentNode.nodeName : '';
          if (pn === 'SCRIPT' || pn === 'STYLE') continue;
          if (t.nodeValue.indexOf('Escensus') !== -1) hits.push(t);
        }
        hits.forEach(function (n) { n.nodeValue = n.nodeValue.replace(/Escensus/g, B.name); });
      }
      if (B.poweredBy && !document.getElementById('poweredBy')) {
        var pb = document.createElement('div');
        pb.id = 'poweredBy';
        pb.textContent = 'Powered by Escensus';
        pb.style.cssText = 'text-align:center;font-family:ui-monospace,Menlo,Consolas,monospace;' +
          'font-size:10.5px;letter-spacing:.14em;text-transform:uppercase;color:#4f606f;' +
          'padding:16px 0 calc(20px + env(safe-area-inset-bottom))';
        document.body.appendChild(pb);
      }
      // Demo brand switcher — flip Escensus ⇄ Peak live. Only on the demo (never
      // on a real client deploy, and never persisted to localStorage).
      if (!realDeploy && !document.getElementById('brandSwitch')) {
        var other = (B.name === 'Escensus') ? 'peak' : 'escensus';
        var otherName = other === 'peak' ? 'Peak' : 'Escensus';
        var sw = document.createElement('button');
        sw.id = 'brandSwitch';
        sw.innerHTML = '◑ ' + B.name + ' · tap for ' + otherName;
        sw.style.cssText = 'position:fixed;top:64px;right:10px;z-index:9999;' +
          'font-family:ui-monospace,Menlo,Consolas,monospace;font-size:10.5px;letter-spacing:.03em;' +
          'color:#f3eee2;background:rgba(10,18,28,.92);border:1px solid #416484;border-radius:100px;' +
          'padding:6px 12px;cursor:pointer;box-shadow:0 3px 12px rgba(0,0,0,.35)';
        sw.onclick = function () { try { var u = new URL(location.href); u.searchParams.set('brand', other); location.href = u.toString(); } catch (e) {} };
        document.body.appendChild(sw);
      }
    } catch (e) {}
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', apply);
  else apply();
})();
