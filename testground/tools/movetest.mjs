// Movement checks in practice: range, facing, behind, cast interrupts. Screenshots along the way.
//   node testground/tools/movetest.mjs <spec> <out-prefix>
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const { chromium } = createRequire(path.join(repo, 'package.json'))('playwright');
const [spec = 'warrior/dps', out = '/tmp/move'] = process.argv.slice(2);
const browser = await chromium.launch({ args: ['--use-gl=angle', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
page.on('pageerror', e => console.log('pageerror', String(e)));
page.on('console', m => m.type() === 'error' && !m.text().includes('404') && console.log('console', m.text().slice(0, 200)));
await page.goto(`http://127.0.0.1:8090/forever/${spec}/`, { waitUntil: 'load' });
await page.waitForTimeout(12000);
await page.goto('http://127.0.0.1:8090/#mode=practice', { waitUntil: 'load' });
await page.waitForTimeout(20000);
await page.selectOption('#practice-length', '0');
await page.click('#practice-start');
await page.waitForFunction(() => tgPractice.live, null, { timeout: 240000 });
const st = () => page.evaluate(() => { const p = tgPractice, w = p.where(); return `t=${p.state.time.toFixed(1)} engine ${p.state.distance.toFixed(1)}yd page ${w.distance.toFixed(1)}yd moving=${p.state.moving} facing=${w.facing} behind=${w.behind} swinging=${!!p.state.swing.mh || !!p.state.swing.ranged} dmg=${Math.round(p.total)}`; });
const err = () => page.evaluate(() => (document.getElementById('practice-error').style.opacity === '1' ? document.getElementById('practice-error').textContent : '-'));
const hold = async (key, ms) => { await page.keyboard.down(key); await page.waitForTimeout(ms); await page.keyboard.up(key); };
await page.mouse.move(800, 400);
console.log('start:', await st());
await page.keyboard.press('t');
await page.waitForTimeout(4000);
console.log('attacking 4s:', await st());
await page.screenshot({ path: `${out}-0.png` });
await hold('KeyS', 2000);
await page.waitForTimeout(500);
const dmgA = await page.evaluate(() => tgPractice.total);
await page.waitForTimeout(3000);
const dmgB = await page.evaluate(() => tgPractice.total);
console.log('backed off 2s:', await st(), '| damage while out of range:', Math.round(dmgB - dmgA));
await page.keyboard.press('1'); await page.waitForTimeout(200); console.log('  pressing 1 out of range:', await err());
await page.screenshot({ path: `${out}-1.png` });
await hold('KeyW', 1500);
await page.waitForTimeout(300);
console.log('walked back in:', await st());
await hold('KeyA', 1000); // half a turn: back to the dummy
await page.waitForTimeout(300);
console.log('turned around:', await st());
await page.keyboard.press('1'); await page.waitForTimeout(200); console.log('  pressing 1 facing away:', await err());
await hold('KeyD', 1000);
// Run around to the back: strafe while turning
for (let i = 0; i < 14; i++) { await page.keyboard.down('KeyE'); await page.keyboard.down('KeyA'); await page.waitForTimeout(110); await page.keyboard.up('KeyA'); await page.keyboard.up('KeyE'); }
await page.waitForTimeout(400);
console.log('circled:', await st());
await page.keyboard.down('KeyW'); await page.waitForTimeout(600);
await page.keyboard.press('Space');
await page.waitForTimeout(250);
await page.screenshot({ path: `${out}-2.png` });
await page.keyboard.up('KeyW');
await page.waitForTimeout(1500);
await page.screenshot({ path: `${out}-3.png` });
console.log('end:', await st());
await browser.close();
