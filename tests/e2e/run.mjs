// Public E2E: first launch → import a (fictional) private journey file → persistence,
// duplicate protection, invalid files, offline use, layout. iPhone-sized headless Chrome.
// Usage: npm run serve & BASE=http://localhost:4173/ npm run e2e
import { chromium } from 'playwright';
import { mkdirSync, writeFileSync } from 'node:fs';

const BASE = process.env.BASE ?? 'http://localhost:4173/';
const FILE = process.env.JOURNEY_FILE ?? 'tests/fixtures/demo-journey.changjourney.json';
const SHOTS = 'tests/e2e/shots';
mkdirSync(SHOTS, { recursive: true });
const results = [];
const errors = [];
const assert = (c, m) => { if (!c) throw new Error(m); };

const browser = await chromium.launch({ executablePath: process.env.CHROME ?? '/usr/bin/google-chrome', args: ['--no-sandbox'] });
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true, permissions: ['clipboard-read', 'clipboard-write'], locale: 'vi-VN', timezoneId: 'Asia/Seoul' });
const page = await ctx.newPage();
page.on('pageerror', (e) => errors.push(e.message));
const step = async (name, fn) => {
  try { await fn(); results.push({ name, ok: true }); console.log('✔', name); }
  catch (e) { results.push({ name, ok: false, err: e.message.split('\n')[0] }); console.log('✘', name, '—', e.message.split('\n')[0]); await page.screenshot({ path: `${SHOTS}/FAIL-${name.replace(/\W+/g, '_')}.png` }).catch(() => {}); }
};
const go = async (h) => { await page.evaluate((x) => (location.hash = x), h); await page.waitForTimeout(350); };
const pick = async (trigger, file) => { const [fc] = await Promise.all([page.waitForEvent('filechooser'), trigger()]); await fc.setFiles(file); await page.waitForTimeout(600); };
const count = (store) => page.evaluate((s) => new Promise((res) => { const o = indexedDB.open('chang-journeys'); o.onsuccess = () => { const q = o.result.transaction(s).objectStore(s).count(); q.onsuccess = () => res(q.result); }; }), store);
const overflowOk = () => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1);

await step('I1 first launch: empty app offers journey import (nothing preloaded)', async () => {
  await page.goto(BASE);
  await page.getByText('Chào mừng đến với cuốn nhật ký').waitFor();
  assert((await count('journeys')) === 0, 'no journeys bundled in the app');
  await page.screenshot({ path: `${SHOTS}/I1-first-launch.png` });
});
await step('I2 invalid file is rejected with a clear message', async () => {
  await page.getByRole('button', { name: /Nhập hành trình từ tệp/ }).first().click();
  await pick(() => page.getByRole('button', { name: /Chọn tệp/ }).click(), 'tests/fixtures/ticket.svg');
  await page.getByRole('alert').waitFor();
  assert((await count('journeys')) === 0, 'nothing imported');
});
let journeyId;
await step('I3 import preview then import into IndexedDB', async () => {
  await pick(() => page.getByRole('button', { name: /Chọn tệp/ }).click(), FILE);
  await page.getByText('Tệp hợp lệ, mã kiểm tra khớp').waitFor();
  await page.screenshot({ path: `${SHOTS}/I3-import-preview.png` });
  await page.getByRole('button', { name: 'Nhập vào máy' }).click();
  await page.locator('.jhome').waitFor();
  journeyId = decodeURIComponent(page.url().split('#/j/')[1]);
  await page.getByRole('button', { name: 'Bỏ qua' }).click().catch(() => {});
  const box = await page.locator('.xmas-tree').boundingBox();
  assert(box && box.height > 844 * 0.8 && box.x + box.width / 2 > 390 * 0.55, 'giant right-side tree after import');
  await page.waitForTimeout(900);
  await page.screenshot({ path: `${SHOTS}/I3-imported-home.png` });
});
await step('I4 imported data persists after reload; five tabs work', async () => {
  const n = await count('activities');
  await page.reload();
  await page.locator('.jhome').waitFor();
  assert((await count('activities')) === n && n > 0, 'activities persisted');
  assert((await page.locator('.tabbar button').count()) === 5, 'five tabs');
  for (const i of [1, 2, 3, 4, 0]) { await page.locator('.tabbar button').nth(i).click(); await page.waitForTimeout(250); assert(await overflowOk(), 'overflow tab ' + i); }
});
await step('I5 re-importing the same file never duplicates or overwrites; copy is explicit', async () => {
  await go('#/import');
  await pick(() => page.getByRole('button', { name: /Chọn tệp/ }).click(), FILE);
  await page.getByText('đã có trên máy').waitFor();
  assert(!(await page.getByRole('button', { name: 'Nhập vào máy' }).count()), 'no plain import offered');
  assert((await count('journeys')) === 1, 'still one journey');
  await page.getByRole('button', { name: 'Nhập thành bản sao' }).click();
  await page.locator('.jhome').waitFor();
  assert((await count('journeys')) === 2, 'copy added');
});
await step('I6 offline: app shell + imported journey + imported ticket work without network', async () => {
  await go(`#/j/${journeyId}/wallet`);
  await page.getByRole('button', { name: 'Thêm giấy tờ' }).first().click();
  await pick(() => page.getByRole('button', { name: /Lưu thành giấy tờ độc lập/ }).click(), 'tests/fixtures/ticket.png');
  assert(await page.evaluate(async () => !!(await navigator.serviceWorker.ready).active), 'service worker active');
  await page.reload();
  await page.waitForTimeout(800);
  await ctx.setOffline(true);
  await page.reload();
  await page.locator('.doc-card', { hasText: 'ticket' }).locator('.doc-main').click({ timeout: 6000 });
  await page.locator('.att-main').first().click();
  await page.waitForFunction(() => document.querySelector('.viewer img')?.naturalWidth > 0, null, { timeout: 5000 });
  await page.getByRole('button', { name: 'Đóng trình xem' }).click();
  await page.keyboard.press('Escape');
  await go(`#/j/${journeyId}/journey`);
  await page.locator('.day-card').first().waitFor();
  await go(`#/offline?j=${journeyId}`);
  await page.locator('.check-item').first().waitFor();
  const t = await page.locator('.page').innerText();
  assert(t.includes('Service worker hoạt động') && t.includes('1/1 tệp gốc đọc được'), 'readiness');
  await page.screenshot({ path: `${SHOTS}/I6-offline-readiness.png` });
  await ctx.setOffline(false);
});
await step('I7 deployed bundle contains no journey data and no import file is cached', async () => {
  const js = await (await page.request.get(BASE + 'app.js')).text();
  assert(!js.includes('Winter Lights Demo') && !js.includes('"chang-journey-import",'), 'no journey in bundle');
  const sw = await (await page.request.get(BASE + 'sw.js')).text();
  assert(!/changjourney|\.json'/.test(sw), 'no import file in SW cache list');
  assert((await page.request.get(BASE + 'tests/fixtures/demo-journey.changjourney.json')).status() === 404, 'fixture not deployed');
});
await step('I8 reduced motion + landscape', async () => {
  const c2 = await browser.newContext({ viewport: { width: 844, height: 390 }, isMobile: true, hasTouch: true, reducedMotion: 'reduce' });
  const p2 = await c2.newPage();
  await p2.goto(BASE);
  await p2.getByText('Chào mừng').waitFor(); // fresh context = fresh storage
  assert(await p2.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), 'landscape overflow');
  await c2.close();
});

console.log('\nJS errors:', errors.length ? errors : 'none');
const pass = results.filter((r) => r.ok).length;
console.log(`${pass}/${results.length} steps passed`);
writeFileSync('tests/e2e/results.json', JSON.stringify({ results, errors }, null, 2));
await browser.close();
process.exit(pass === results.length && !errors.length ? 0 : 1);
