import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1728, height: 2304 }, deviceScaleFactor: 2 });
await page.goto('file://' + process.cwd() + '/escensus-poster.html', { waitUntil: 'networkidle' });
await page.evaluate(() => document.fonts.ready);

const m = await page.evaluate(() => {
  const p = document.querySelector('.poster');
  const kids = [...p.children].map(el => ({
    cls: el.className || el.tagName.toLowerCase(),
    h: Math.round(el.getBoundingClientRect().height),
  }));
  const overflow = [];
  p.querySelectorAll('*').forEach(el => {
    if (el.scrollHeight - el.clientHeight > 2 && getComputedStyle(el).overflow !== 'visible')
      overflow.push(el.className + ' +' + (el.scrollHeight - el.clientHeight));
  });
  return { posterH: Math.round(p.getBoundingClientRect().height),
           contentH: Math.round(p.scrollHeight), kids, overflow };
});
console.log(JSON.stringify(m, null, 1));

await page.pdf({ path: 'escensus-poster-18x24.pdf', width: '18in', height: '24in',
                 printBackground: true, margin: {top:0,right:0,bottom:0,left:0}, pageRanges: '1' });
await page.screenshot({ path: 'preview.png', fullPage: false });
await browser.close();
