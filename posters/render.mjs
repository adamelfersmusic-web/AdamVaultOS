// Render a built poster to PDF.   node render.mjs <name> [--theme <t>] [--bleed]
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';

const argv  = process.argv.slice(2);
const name  = argv[0] && !argv[0].startsWith('-') ? argv[0] : 'escensus-poster';
const bleed = argv.includes('--bleed') || argv.slice(1).includes('bleed');
const ti    = argv.indexOf('--theme');
const theme = ti >= 0 ? argv[ti + 1] : null;

const stem = name + (theme ? `-${theme}` : '') + (bleed ? '-bleed' : '');
const out  = `${name}${theme ? `-${theme}` : ''}-18x24${bleed ? '-bleed' : ''}.pdf`;
const W = bleed ? '18.25in' : '18in', H = bleed ? '24.25in' : '24in';
const vw = bleed ? 1752 : 1728,       vh = bleed ? 2328 : 2304;

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: vw, height: vh } });
await page.goto(`file://${process.cwd()}/${stem}.html`, { waitUntil: 'networkidle' });
await page.evaluate(() => document.fonts.ready);

const m = await page.evaluate(() => {
  const p = document.querySelector('.poster');
  return {
    posterH:  Math.round(p.getBoundingClientRect().height),
    contentH: Math.round(p.scrollHeight),
    clipped: [...p.querySelectorAll('*')]
      .filter(el => el.scrollHeight - el.clientHeight > 2 && getComputedStyle(el).overflow !== 'visible')
      .map(el => el.className + ' +' + (el.scrollHeight - el.clientHeight)),
  };
});
console.log(out, JSON.stringify(m));

await page.pdf({ path: out, width: W, height: H, printBackground: true,
                 margin: {top:0,right:0,bottom:0,left:0}, pageRanges: '1' });
await browser.close();
