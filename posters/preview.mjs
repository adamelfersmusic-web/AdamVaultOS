// node preview.mjs <name> [--theme <t>]
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
const argv  = process.argv.slice(2);
const name  = argv[0] && !argv[0].startsWith('-') ? argv[0] : 'escensus-poster';
const ti    = argv.indexOf('--theme');
const theme = ti >= 0 ? argv[ti + 1] : null;
const stem  = name + (theme ? `-${theme}` : '');

const b = await chromium.launch();
const p = await b.newPage({ viewport:{width:1728,height:2304}, deviceScaleFactor:0.58 });
await p.goto(`file://${process.cwd()}/${stem}.html`,{waitUntil:'networkidle'});
await p.evaluate(()=>document.fonts.ready);
await p.screenshot({ path:`${stem}-preview.png` });
await b.close();
