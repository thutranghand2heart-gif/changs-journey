// V1.0.5 E2E: user text shown in framed cards; activities, places and days can be freely edited.
// Synthetic data only. Usage: BASE=http://localhost:4173/ node tests/e2e/v105.mjs
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';

const BASE = process.env.BASE ?? 'http://localhost:4173/';
const SHOTS = 'tests/e2e/shots';
mkdirSync(SHOTS, { recursive: true });
const results = [];
const errors = [];
const assert = (c, m) => { if (!c) throw new Error(m); };
const browser = await chromium.launch({ executablePath: process.env.CHROME ?? '/usr/bin/google-chrome', args: ['--no-sandbox'] });
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true, locale: 'vi-VN' });
const page = await ctx.newPage();
page.on('pageerror', (e) => errors.push(e.message));
const step = async (name, fn) => {
  try { await fn(); results.push({ name, ok: true }); console.log('✔', name); }
  catch (e) { results.push({ name, ok: false }); console.log('✘', name, '—', e.message.split('\n')[0]); await page.screenshot({ path: `${SHOTS}/FAIL-${name.replace(/\W+/g, '_')}.png` }).catch(() => {}); }
};
const go = async (h) => { await page.evaluate((x) => (location.hash = x), h); await page.waitForTimeout(500); };
const idb = (fn) => page.evaluate(`new Promise((res, rej) => { const o = indexedDB.open('chang-journeys'); o.onsuccess = () => { const db = o.result; (${fn})(db, res); }; o.onerror = () => rej(o.error); })`);
const all = (store) => idb(`(db, res) => { const q = db.transaction('${store}').objectStore('${store}').getAll(); q.onsuccess = () => res(q.result); }`);
const put = (store, val) => idb(`(db, res) => { const tx = db.transaction('${store}', 'readwrite'); tx.objectStore('${store}').put(${JSON.stringify(val)}); tx.oncomplete = () => res(true); }`);
const field = (label) => page.locator('.sheet').last().locator('.field', { hasText: label }).first().locator('input, textarea, select').first();

await step('E0 import demo journey; give an activity a description + notes', async () => {
  await page.goto(BASE);
  await page.getByRole('button', { name: /Nhập hành trình từ tệp/ }).first().click();
  const [fc] = await Promise.all([page.waitForEvent('filechooser'), page.getByRole('button', { name: /Chọn tệp/ }).click()]);
  await fc.setFiles('tests/fixtures/demo-journey.changjourney.json');
  await page.waitForTimeout(700);
  await page.getByRole('button', { name: 'Nhập vào máy' }).click();
  await page.locator('.jhome').waitFor();
  const a = (await all('activities')).find((x) => x.id === 'demo-a3');
  await put('activities', { ...a, descriptionVi: 'Quay lại để chụp một đoạn nhảy', notes: 'Mang đèn pin' });
  await page.reload();
  await page.waitForTimeout(800);
});

await step('E1 description and notes are shown in framed cards', async () => {
  await go('#/j/demo-journey/journey/demo-d1?a=demo-a3');
  await page.getByTestId('act-desc').waitFor();
  assert(await page.locator('.card[data-testid="act-desc"]').isVisible(), 'description not in a card');
  assert(await page.locator('.card[data-testid="act-notes"]').isVisible(), 'notes not in a card');
  await page.screenshot({ path: `${SHOTS}/v105-activity.png` });
});

await step('E2 edit the place (Chinese name + address) from the activity; every linked activity shows it', async () => {
  await page.getByTestId('place-edit').click();
  await page.getByTestId('place-editor').waitFor();
  await field('Tên tiếng Trung').fill('演示新名');
  await field('Địa chỉ tiếng Anh').fill('99 Edited Road, Demo City');
  await page.locator('.sheet').last().getByRole('button', { name: 'Lưu', exact: true }).click();
  await page.waitForTimeout(500);
  const p = (await all('places')).find((x) => x.id === 'demo-pl-river');
  assert(p.nameZh === '演示新名' && p.addressEn === '99 Edited Road, Demo City', JSON.stringify(p));
  await go('#/j/demo-journey/journey/demo-d1?a=demo-a2');
  assert((await page.locator('.sheet').last().innerText()).includes('99 Edited Road'), 'other activity did not update');
  await page.keyboard.press('Escape');
});

await step('E3 edit time, move to another day, and change the place of an activity', async () => {
  await go('#/j/demo-journey/journey/demo-d1');
  await page.locator('.tl-title', { hasText: 'Riverside — visit 2' }).click();
  await page.getByTestId('act-edit-top').click();
  await field('Bắt đầu').fill('21:15');
  await page.getByTestId('act-day').selectOption('demo-d2');
  await field('Địa điểm').selectOption('demo-pl-airport');
  await page.locator('.sheet').last().getByRole('button', { name: 'Lưu', exact: true }).click();
  await page.waitForTimeout(500);
  const a = (await all('activities')).find((x) => x.id === 'demo-a3');
  assert(a.start === '21:15' && a.dayId === 'demo-d2' && a.placeId === 'demo-pl-airport', JSON.stringify(a));
  await go('#/j/demo-journey/journey/demo-d2');
  assert((await page.locator('.page').innerText()).includes('Riverside — visit 2'), 'not shown on new day');
});

await step('E4 change a day\'s date: days re-numbered in date order, trip dates widened', async () => {
  const before = await all('days');
  const d1 = before.find((d) => d.id === 'demo-d1');
  await go('#/j/demo-journey/journey/demo-d1');
  await page.getByRole('button', { name: 'Sửa ngày' }).click();
  await field('Ngày tháng').fill('2031-01-13');
  await page.locator('.sheet').last().getByRole('button', { name: 'Lưu', exact: true }).click();
  await page.waitForTimeout(600);
  const days = (await all('days')).sort((a, b) => a.index - b.index);
  assert(days[days.length - 1].id === 'demo-d1' && days[days.length - 1].date === '2031-01-13', JSON.stringify(days.map((d) => [d.id, d.index, d.date])));
  assert(days.map((d) => d.index).join() === '1,2,3', 'indexes');
  const j = (await all('journeys')).find((x) => x.id === 'demo-journey');
  assert(j.endDate >= '2031-01-13', 'end date not widened');
  void d1;
});

await browser.close();
const bad = results.filter((r) => !r.ok);
console.log(`\n${results.length - bad.length}/${results.length} steps passed; page errors: ${errors.length}`);
if (errors.length) console.log(errors.slice(0, 5));
process.exit(bad.length || errors.length ? 1 : 0);
