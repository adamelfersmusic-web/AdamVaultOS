import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
const name = process.argv[2] || 'escensus-poster';
const b = await chromium.launch();
const p = await b.newPage({ viewport:{width:1728,height:2304}, deviceScaleFactor:0.58 });
await p.goto(`file://${process.cwd()}/${name}.html`,{waitUntil:'networkidle'});
await p.evaluate(()=>document.fonts.ready);
await p.screenshot({ path:`${name}-preview.png` });
await b.close();
