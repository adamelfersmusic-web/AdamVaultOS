import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
const name  = process.argv[2] || 'escensus-poster';
const bleed = process.argv[3] === 'bleed';

const W = bleed ? '18.25in' : '18in', H = bleed ? '24.25in' : '24in';
const vw = bleed ? 1752 : 1728,       vh = bleed ? 2328 : 2304;
const src = bleed ? `${name}-bleed` : name;
const out = bleed ? `${name}-18x24-bleed.pdf` : `${name}-18x24.pdf`;

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: vw, height: vh } });
await page.goto(`file://${process.cwd()}/${src}.html`, { waitUntil: 'networkidle' });
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
