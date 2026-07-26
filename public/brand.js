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
    // ---- PLACEHOLDER colors — swap for Peak's real brand kit (hex + logo) ----
    peak: {
      name: 'Peak',
      appName: 'Peak Training',
      accent: '#c8342f',
      accentBright: '#e0574a',
      themeColor: '#0c1b2a',
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

  function pickId() {
    try {
      var q = new URLSearchParams(location.search).get('brand');
      if (q && BRANDS[q]) { localStorage.setItem('brand', q); return q; }
      var s = localStorage.getItem('brand');
      if (s && BRANDS[s]) return s;
    } catch (e) {}
    var h = (location.hostname || '').toLowerCase();
    var p = (location.pathname || '').toLowerCase();
    for (var id in BRANDS) {
      if (id === 'escensus') continue;
      if (h.indexOf(id) !== -1 || p.indexOf('/' + id) !== -1) return id;
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

  function apply() {
    try {
      if (document.title) document.title = document.title.replace(/Escensus/g, B.name);
      var nm = document.querySelector('.brand .name');
      if (nm) nm.textContent = B.name;
      var tc = document.querySelector('meta[name="theme-color"]');
      if (tc) tc.setAttribute('content', B.themeColor);
      if (B.poweredBy && !document.getElementById('poweredBy')) {
        var pb = document.createElement('div');
        pb.id = 'poweredBy';
        pb.textContent = 'Powered by Escensus';
        pb.style.cssText = 'text-align:center;font-family:ui-monospace,Menlo,Consolas,monospace;' +
          'font-size:10.5px;letter-spacing:.14em;text-transform:uppercase;color:#4f606f;' +
          'padding:16px 0 calc(20px + env(safe-area-inset-bottom))';
        document.body.appendChild(pb);
      }
    } catch (e) {}
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', apply);
  else apply();
})();
