import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
const b = await chromium.launch();
const p = await b.newPage({ viewport:{width:1728,height:2304}, deviceScaleFactor:0.58 });
await p.goto('file://'+process.cwd()+'/escensus-poster.html',{waitUntil:'networkidle'});
await p.evaluate(()=>document.fonts.ready);
await p.screenshot({ path:'preview-small.png' });
await b.close();
