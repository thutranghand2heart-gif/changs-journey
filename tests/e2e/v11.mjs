// V1.1 E2E: countdown sticker, entry-card presentation, reorder, train fields, Pose Book album, translation-file import.
// Synthetic data only (fictional demo journey + public test fixtures). Usage: BASE=http://localhost:4173/ node tests/e2e/v11.mjs
import { chromium } from 'playwright';
import { mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const BASE = process.env.BASE ?? 'http://localhost:4173/';
const SHOTS = 'tests/e2e/shots';
mkdirSync(SHOTS, { recursive: true });
const results = [];
const errors = [];
const assert = (c, m) => { if (!c) throw new Error(m); };
const fnv = (s) => { let h = 0x811c9dc5; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; } return h.toString(16).padStart(8, '0'); };
const browser = await chromium.launch({ executablePath: process.env.CHROME ?? '/usr/bin/google-chrome', args: ['--no-sandbox'] });
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, locale: 'vi-VN' });
const page = await ctx.newPage();
page.on('pageerror', (e) => errors.push(e.message));
const step = async (name, fn) => {
  try { await fn(); results.push({ name, ok: true }); console.log('✔', name); }
  catch (e) { results.push({ name, ok: false }); console.log('✘', name, '—', e.message.split('\n')[0]); await page.screenshot({ path: `${SHOTS}/FAIL-${name.replace(/\W+/g, '_')}.png` }).catch(() => {}); }
};
const go = async (h) => { await page.evaluate((x) => (location.hash = x), h); await page.waitForTimeout(500); };
const pick = async (trigger, file) => { const [fc] = await Promise.all([page.waitForEvent('filechooser'), trigger()]); await fc.setFiles(file); await page.waitForTimeout(700); };
const idb = (fn) => page.evaluate(`new Promise((res, rej) => { const o = indexedDB.open('chang-journeys'); o.onsuccess = () => { const db = o.result; (${fn})(db, res); }; o.onerror = () => rej(o.error); })`);
const all = (store) => idb(`(db, res) => { const q = db.transaction('${store}').objectStore('${store}').getAll(); q.onsuccess = () => res(q.result); }`);
const tx = () => page.evaluate(() => document.querySelector('[data-testid="sleigh-thumb"]')?.style.transform);

await step('X0 import demo journey', async () => {
  await page.goto(BASE);
  await page.getByRole('button', { name: /Nhập hành trình từ tệp/ }).first().click();
  await pick(() => page.getByRole('button', { name: /Chọn tệp/ }).click(), 'tests/fixtures/demo-journey.changjourney.json');
  await page.getByRole('button', { name: 'Nhập vào máy' }).click();
  await page.locator('.jhome').waitFor();
  await page.waitForTimeout(3300); // opening animation
});

await step('X1 countdown sticker: import, stored locally as the original file, shown as the slider thumb', async () => {
  await go('#/j/demo-journey/appearance');
  await pick(() => page.getByTestId('sticker-import').click(), 'tests/fixtures/ticket.png');
  const j = (await all('journeys')).find((x) => x.id === 'demo-journey');
  const id = j.settings.countdownStickerBlobId;
  assert(id, 'sticker id not saved');
  const blob = (await all('blobs')).find((b) => b.id === id);
  assert(blob && blob.journeyId === 'demo-journey', 'sticker blob missing');
  await go('#/j/demo-journey');
  await page.locator('[data-testid="sleigh-thumb"] img').waitFor();
});

await step('X2 dragging moves the sleigh (with stardust) and it returns to the real position; dates unchanged', async () => {
  const before = (await all('journeys')).find((x) => x.id === 'demo-journey');
  await page.getByTestId('sleigh-countdown').scrollIntoViewIfNeeded();
  const t0 = await tx();
  const box = await page.getByTestId('sleigh-thumb').boundingBox();
  await page.mouse.move(box.x + 20, box.y + box.height / 2);
  await page.mouse.down();
  for (let i = 1; i <= 10; i++) { await page.mouse.move(box.x + 20 + i * 14, box.y + box.height / 2); await page.waitForTimeout(50); }
  const td = await tx();
  const dust = await page.locator('.stardust').count();
  await page.mouse.up();
  await page.waitForTimeout(900);
  const t1 = await tx();
  assert(td !== t0, 'did not move while dragging');
  assert(dust > 0, 'no stardust while dragging');
  assert(t1 === t0, `did not return: ${t0} → ${t1}`);
  const after = (await all('journeys')).find((x) => x.id === 'demo-journey');
  assert(after.startDate === before.startDate && after.endDate === before.endDate, 'dates changed');
});

await step('X3 entry card: daily sections, full-screen presentation without edit buttons, text size', async () => {
  await go('#/j/demo-journey/travel-doc');
  await page.getByRole('button', { name: 'English' }).click();
  await page.getByRole('button', { name: 'Chi tiết' }).click();
  await page.getByTestId('card-present').click();
  const ov = page.getByTestId('card-presentation');
  await ov.waitFor();
  assert((await ov.locator('.travel-doc .no-print:visible').count()) === 0, 'edit controls visible in presentation');
  const fs0 = await ov.locator('.travel-doc').evaluate((e) => parseFloat(getComputedStyle(e).fontSize));
  await ov.getByRole('button', { name: 'Chữ lớn hơn' }).click();
  const fs1 = await ov.locator('.travel-doc').evaluate((e) => parseFloat(getComputedStyle(e).fontSize));
  assert(fs1 > fs0, 'text size did not grow');
  if (await ov.locator('.itin-day').count()) assert((await ov.locator('.itin-day .itin-head').count()) > 0, 'no daily sections');
  await page.screenshot({ path: `${SHOTS}/v11-card-presentation.png` });
  await ov.getByRole('button', { name: 'Chữ nhỏ hơn' }).click();
  await ov.getByRole('button', { name: /Đóng/ }).first().click();
});

await step('X4 reorder activities within a day (up/down) and persist', async () => {
  await go('#/j/demo-journey/journey/demo-d1');
  const titles = () => page.locator('.tl-title').allInnerTexts();
  const before = await titles();
  await page.getByTestId('reorder-toggle').click();
  await page.locator('.tl-move').nth(0).getByRole('button', { name: 'Xuống dưới' }).click();
  await page.waitForTimeout(500);
  const after = await titles();
  assert(after[0] === before[1] && after[1] === before[0], `${before} → ${after}`);
  await page.reload();
  await page.waitForTimeout(800);
  assert((await titles())[0] === before[1], 'order not persisted');
});

await step('X5 train booking fields are editable and shown in the Wallet', async () => {
  await go('#/j/demo-journey/wallet');
  const docs = await all('docs');
  const d = docs[0];
  await idb(`(db, res) => { const tx = db.transaction('docs', 'readwrite'); tx.objectStore('docs').put(${JSON.stringify({ ...d, id: 'demo-train', title: 'Demo train', category: 'train', recordType: 'booking', attachmentIds: [] })}); tx.oncomplete = () => res(true); }`);
  await page.reload();
  await page.waitForTimeout(800);
  await page.locator('button', { hasText: 'Demo train' }).first().click();
  await page.getByTestId('train-fields').waitFor();
  await page.getByTestId('train-fields').locator('.field', { hasText: 'Số hiệu tàu' }).locator('input').fill('G1234');
  await page.getByTestId('train-fields').locator('.field', { hasText: 'Ga đi' }).locator('input').fill('Demo Central');
  await page.locator('.sheet').last().getByRole('button', { name: /^Lưu/ }).first().click();
  await page.waitForTimeout(500);
  const tr = (await all('docs')).find((x) => x.id === 'demo-train');
  assert(tr.train?.trainNumber === 'G1234' && tr.train?.depStation === 'Demo Central', JSON.stringify(tr.train));
});

await step('X6 Pose Book: compact idea row (no fake photo), view mode with guidance, favourite toggles', async () => {
  await idb(`(db, res) => { const tx = db.transaction('poses', 'readwrite'); tx.objectStore('poses').put({ id: 'demo-pose', journeyId: 'demo-journey', category: 'night', title: 'Demo night portrait', description: 'Stand by the railing, lights behind.', favorite: false, notes: '', refBlobIds: [], activityIds: [], builtin: false, hands: 'Hands relaxed on the rail' }); tx.oncomplete = () => res(true); }`);
  await page.reload();
  await page.waitForTimeout(800);
  await go('#/j/demo-journey/pose');
  // V1.2.1: ideas without photos are compact rows (no large empty boxes, no fake sample photos)
  assert(await page.locator('[data-testid="pose-ideas"] .pose-row').first().isVisible(), 'no honest idea row');
  assert(!(await page.locator('.pose-card .pose-ph').count()), 'large empty placeholder still shown');
  const card = page.locator('.pose-row').first();
  await card.waitFor();
  await card.click();
  await page.getByTestId('pose-view').waitFor();
  assert((await page.getByTestId('pose-view').innerText()).includes('Hands relaxed on the rail'), 'guidance not shown');
  const fav0 = (await all('poses'))[0]?.favorite;
  await page.getByTestId('pose-fav').click();
  await page.waitForTimeout(400);
  const p = (await all('poses')).find((x) => x.favorite !== fav0);
  assert(p, 'favourite did not toggle');
  await page.keyboard.press('Escape');
});

await step('X7 translation file import: applied by stable IDs, edited fields skipped, user edits kept', async () => {
  const days = await all('days');
  const d1 = days.find((d) => d.id === 'demo-d1');
  const d2 = days.find((d) => d.id === 'demo-d2');
  const file = { format: 'chang-content-i18n', version: 1, entries: [
    { store: 'days', recordId: 'demo-d1', field: 'title', srcHash: fnv(d1.title.trim()), srcLang: 'en', translations: { vi: 'Ngày demo một', zh: '演示第一天', ko: '데모 첫째 날' } },
    { store: 'days', recordId: 'demo-d2', field: 'title', srcHash: fnv('an older title'), srcLang: 'en', translations: { vi: 'Không được áp dụng' } },
    { store: 'days', recordId: 'missing-day', field: 'title', srcHash: 'x', srcLang: 'en', translations: { vi: 'x' } },
  ] };
  const path = join(tmpdir(), 'demo.translations.json');
  writeFileSync(path, JSON.stringify(file));
  await go('#/translate');
  await pick(() => page.getByTestId('tx-file-pick').click(), path);
  const plan = await page.getByTestId('tx-file-plan').innerText();
  assert(plan.includes('3') && plan.includes('1'), plan);
  await page.getByRole('button', { name: 'Nhập', exact: true }).click();
  await page.waitForTimeout(500);
  const rows = await all('translations');
  assert(rows.filter((r) => r.recordId === 'demo-d1' && r.provider === 'file').length === 3, 'not applied');
  assert(!rows.some((r) => r.recordId === 'demo-d2'), 'edited field was overwritten');
  await go('#/j/demo-journey/journey');
  assert((await page.locator('.page').innerText()).includes('Ngày demo một'), 'translation not shown in Vietnamese UI');
  void d2;
});

await browser.close();
const bad = results.filter((r) => !r.ok);
console.log(`\n${results.length - bad.length}/${results.length} steps passed; page errors: ${errors.length}`);
if (errors.length) console.log(errors.slice(0, 5));
process.exit(bad.length || errors.length ? 1 : 0);
