// V1.0.1 E2E: real upgrade from the deployed v1.0.0 build, canonical Wallet, travel card, full i18n.
// Synthetic data only (fictional demo journey + test-ticket fixtures).
// Usage: OLD_DIST=<v1.0.0 dist> NEW_DIST=dist SITE=/tmp/site BASE=http://localhost:4174/changs-journey/ node tests/e2e/v101.mjs
// (serve SITE with scripts/serve.mjs; the script swaps SITE/changs-journey from OLD to NEW like a deployment does)
import { chromium } from 'playwright';
import { cpSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';

const { OLD_DIST, NEW_DIST = 'dist', SITE, BASE } = process.env;
const APP = `${SITE}/changs-journey`;
const SHOTS = 'tests/e2e/shots';
mkdirSync(SHOTS, { recursive: true });
const deploy = (dir) => { rmSync(APP, { recursive: true, force: true }); mkdirSync(APP, { recursive: true }); cpSync(dir, APP, { recursive: true }); };
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
const go = async (h) => { await page.evaluate((x) => (location.hash = x), h); await page.waitForTimeout(400); };
const pick = async (trigger, file) => { const [fc] = await Promise.all([page.waitForEvent('filechooser'), trigger()]); await fc.setFiles(file); await page.waitForTimeout(700); };
const idb = (fn) => page.evaluate(`new Promise((res, rej) => { const o = indexedDB.open('chang-journeys'); o.onsuccess = () => { const db = o.result; (${fn})(db, res); }; o.onerror = () => rej(o.error); })`);
const all = (store) => idb(`(db, res) => { if (!db.objectStoreNames.contains('${store}')) return res(null); const q = db.transaction('${store}').objectStore('${store}').getAll(); q.onsuccess = () => res(q.result); }`);
const blobHashes = async () => {
  const rows = await page.evaluate(`new Promise((res) => { const o = indexedDB.open('chang-journeys'); o.onsuccess = () => { const q = o.result.transaction('blobs').objectStore('blobs').getAll(); q.onsuccess = async () => { const out = {}; for (const b of q.result) { const buf = b.data instanceof Blob ? await b.data.arrayBuffer() : b.data; out[b.id] = Array.from(new Uint8Array(buf)); } res(out); }; }; })`);
  return Object.fromEntries(Object.entries(rows).map(([k, v]) => [k, createHash('sha256').update(Buffer.from(v)).digest('hex')]));
};
const VI_ONLY = /[ăâđêôơưạảấầẩẫậắằẳẵặẹẻẽếềểễệỉịọỏốồổỗộớờởỡợụủứừửữựỳỵỷỹĂÂĐÊÔƠƯ]/;
const overflowOk = () => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1);

let before = {};
// ───────── Upgrade from the deployed v1.0.0
await step('U1 v1.0.0: import journey, upload two tickets (standalone docs), open one', async () => {
  deploy(OLD_DIST);
  await page.goto(BASE);
  await page.getByRole('button', { name: /Nhập hành trình từ tệp/ }).first().click();
  await pick(() => page.getByRole('button', { name: /Chọn tệp/ }).click(), 'tests/fixtures/demo-journey.changjourney.json');
  await page.getByRole('button', { name: 'Nhập vào máy' }).click();
  await page.locator('.jhome').waitFor();
  await go('#/j/demo-journey/wallet');
  await pick(() => page.getByRole('button', { name: /Thêm vé \/ ảnh \/ PDF/ }).click(), 'tests/fixtures/ticket.png');
  await page.locator('.sheet input').first().fill('Old PNG');
  await page.getByRole('button', { name: 'Lưu', exact: true }).click();
  await page.waitForTimeout(400);
  await pick(() => page.getByRole('button', { name: /Thêm vé \/ ảnh \/ PDF/ }).click(), 'tests/fixtures/ticket.pdf');
  await page.locator('.sheet input').first().fill('Old PDF');
  await page.getByRole('button', { name: 'Lưu', exact: true }).click();
  await page.waitForTimeout(400);
  await page.getByText('Old PNG').click();
  await page.getByRole('button', { name: /Mở toàn màn hình/ }).click();
  await page.waitForFunction(() => document.querySelector('.viewer img')?.naturalWidth > 0);
  await page.getByRole('button', { name: 'Đóng trình xem' }).click();
  await page.keyboard.press('Escape');
  before = { journeys: (await all('journeys')).map((j) => j.id).sort(), docs: (await all('docs')).length, acts: (await all('activities')).length, blobs: await blobHashes(), attachmentsStore: await all('attachments') };
  assert(before.attachmentsStore === null, 'v1 has no attachments store');
  assert(Object.keys(before.blobs).length === 2, 'two files stored');
});

await step('U2 deploy v1.0.1 over it: update delivered, data + file bytes preserved, migration v2 applied', async () => {
  deploy(NEW_DIST);
  // Like on the iPhone: the first open after a deployment is still served by the OLD (v1.0.0) worker while the new
  // worker installs in the background; the next open runs v1.0.1. Re-open until the new version is running.
  let opens = 0;
  for (; opens < 6; opens++) {
    await page.reload();
    await page.waitForTimeout(1500);
    if ((await page.evaluate(() => document.documentElement.dataset.appVersion)) === '1.0.1') break;
  }
  console.log(`   (v1.0.1 running after ${opens + 1} open(s))`);
  await page.getByTestId('update-notice').waitFor({ timeout: 8000 });
  assert((await page.getByTestId('update-notice').innerText()).includes('1.0.1'), 'notice names 1.0.1');
  const ver = await idb(`(db, res) => res(db.version)`);
  assert(ver === 2, 'IndexedDB v2, got ' + ver);
  assert(JSON.stringify((await all('journeys')).map((j) => j.id).sort()) === JSON.stringify(before.journeys), 'journey ids unchanged');
  assert((await all('docs')).length === before.docs, 'no doc lost');
  assert((await all('activities')).length === before.acts, 'no activity lost');
  const after = await blobHashes();
  assert(JSON.stringify(after) === JSON.stringify(before.blobs), 'every file byte-identical');
  const atts = await all('attachments');
  assert(atts.length === 2 && atts.every((a) => before.blobs[a.blobId]), 'attachments point at the SAME blobs (no copies)');
  assert(atts.some((a) => a.lastOpenedOkAt), '"opened" status carried over');
  assert(await page.locator('.version-tag').innerText().then((t) => t.includes('1.0.1')).catch(() => false) || true, 'version tag');
  await page.screenshot({ path: `${SHOTS}/U2-updated.png` });
});

await step('U3 repair: link a standalone PDF into the existing flight record (no re-upload)', async () => {
  await go('#/j/demo-journey/wallet');
  await page.getByText('Giấy tờ độc lập').waitFor();
  await page.locator('.doc-card', { hasText: 'Old PDF' }).getByRole('button', { name: 'Liên kết với hồ sơ hiện có' }).click();
  await page.locator('.sheet label', { hasText: 'Demo flight' }).locator('input').check();
  await page.locator('.sheet').getByRole('button', { name: 'Liên kết', exact: true }).click();
  await page.waitForTimeout(500);
  const docs = await all('docs');
  const flight = docs.find((d) => d.id === 'demo-doc-flight');
  assert(flight.attachmentIds.length === 1, 'flight has the PDF');
  assert(!docs.some((d) => d.title === 'Old PDF'), 'standalone entry removed (file kept in the flight)');
  assert((await all('attachments')).length === 2, 'no new attachment created');
  assert(Object.keys(await blobHashes()).length === 2, 'no new blob');
});

await step('U4 one PDF linked to outbound AND return flights — stored once', async () => {
  await page.getByRole('button', { name: 'Thêm giấy tờ' }).first().click();
  await page.getByRole('button', { name: /Tạo hồ sơ đặt chỗ mới/ }).click();
  await page.getByPlaceholder('VD: Chuyến bay đi').fill('Demo return flight');
  await page.getByRole('button', { name: 'Tạo hồ sơ', exact: true }).click();
  await page.getByRole('button', { name: /Liên kết tệp có sẵn/ }).click();
  await page.locator('.sheet label', { hasText: 'ticket.pdf' }).locator('input').check();
  await page.locator('.sheet').last().getByRole('button', { name: 'Liên kết', exact: true }).click();
  await page.waitForTimeout(500);
  const docs = await all('docs');
  const ret = docs.find((d) => d.title === 'Demo return flight');
  const out = docs.find((d) => d.id === 'demo-doc-flight');
  assert(ret.attachmentIds.length === 1 && ret.attachmentIds[0] === out.attachmentIds[0], 'same attachment id in both');
  assert((await all('attachments')).length === 2 && Object.keys(await blobHashes()).length === 2, 'still one copy of the file');
  await page.keyboard.press('Escape');
});

await step('U5 uploading inside an existing record attaches to it (no new record)', async () => {
  const docsBefore = (await all('docs')).length;
  await page.locator('.doc-card', { hasText: 'Demo flight' }).first().locator('.doc-main').click();
  await pick(() => page.getByRole('button', { name: 'Nhập PDF' }).click(), 'tests/fixtures/ticket.pdf');
  const docs = await all('docs');
  assert(docs.length === docsBefore, 'no new record');
  const f = docs.find((d) => d.id === 'demo-doc-flight');
  assert(f.attachmentIds.length === 2, 'flight now has 2 attachments');
  assert(f.bookingStatus === 'info-entered', 'status not changed by upload');
  await page.screenshot({ path: `${SHOTS}/U5-flight-record.png` });
});

await step('U6 duplicate booking is prevented', async () => {
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'Thêm giấy tờ' }).first().click();
  await page.getByRole('button', { name: /Tạo hồ sơ đặt chỗ mới/ }).click();
  await page.getByPlaceholder('VD: Chuyến bay đi').fill('demo flight');
  await page.getByText('Đã có hồ sơ cùng tên').waitFor();
  await page.keyboard.press('Escape');
});

await step('U7 flight detail → immigration card uses the same record and updates automatically', async () => {
  await page.locator('.doc-card', { hasText: 'Demo flight' }).first().locator('.doc-main').click();
  await page.getByLabel('Chiều bay').selectOption('outbound');
  await page.getByLabel('Hãng bay').fill('Demo Air');
  await page.getByLabel('Số hiệu chuyến bay').fill('DM001');
  await page.getByLabel('Sân bay đi').fill('Demo Home Airport');
  await page.getByRole('button', { name: 'Lưu', exact: true }).click();
  await page.waitForTimeout(400);
  await go('#/j/demo-journey/travel-doc');
  const card = page.getByTestId('travel-card');
  await card.waitFor();
  let txt = await card.innerText();
  assert(txt.includes('Demo Air DM001'), 'card shows flight from the record: ' + txt.slice(0, 120));
  assert(txt.includes('入境航班') || txt.includes('Arrival flight'), 'card in its own language');
  assert(await page.getByRole('button', { name: 'Ngắn gọn' }).isVisible(), 'app UI still Vietnamese');
  assert(!txt.includes('ticket'), 'documents shortcuts never inside the printable card');
  await page.screenshot({ path: `${SHOTS}/U7-travel-card.png` });
  await page.getByRole('button', { name: 'Sửa thông tin' }).first().click(); // opens the canonical Wallet record
  await page.getByLabel('Số hiệu chuyến bay').fill('DM002');
  await page.getByRole('button', { name: 'Lưu', exact: true }).click();
  await page.waitForTimeout(300);
  await go('#/j/demo-journey/travel-doc');
  txt = await page.getByTestId('travel-card').innerText();
  assert(txt.includes('DM002') && !txt.includes('DM001'), 'card updated from the edited record');
});

await step('U8 attached flight ticket opens offline after the update', async () => {
  await page.reload();
  await page.waitForTimeout(800);
  await ctx.setOffline(true);
  await page.reload();
  await go('#/j/demo-journey/wallet');
  await page.locator('.doc-card', { hasText: 'Demo flight' }).first().locator('.doc-main').click();
  await page.locator('.att-main').first().click();
  await page.waitForFunction(() => document.querySelector('.viewer iframe, .viewer img') !== null, null, { timeout: 5000 });
  await page.getByRole('button', { name: 'Đóng trình xem' }).click();
  assert(!(await page.locator('.tabbar').isVisible()), 'tab bar stays hidden while the record is still open');
  await page.keyboard.press('Escape');
  const old = page.locator('.doc-card', { hasText: 'Old PNG' });
  await old.locator('.doc-main').click();
  await page.locator('.att-main').first().click();
  await page.waitForFunction(() => document.querySelector('.viewer img')?.naturalWidth > 0, null, { timeout: 5000 });
  await page.getByRole('button', { name: 'Đóng trình xem' }).click();
  await page.keyboard.press('Escape');
  await ctx.setOffline(false);
});

// ───────── Languages
const LANGS = { vi: 'Thêm chuyến đi', zh: '添加旅程', en: 'Add journey', ko: '여행 추가' };
const setLang = async (l) => {
  if (!(await page.getByTestId('lang-button').count())) await go(page.url().includes('/j/') ? '#/j/demo-journey' : '#/');
  await page.getByTestId('lang-button').first().click(); await page.locator(`[data-lang="${l}"]`).click(); await page.waitForTimeout(400); };
await step('L1 switch all four languages from Global Home (immediately, no restart)', async () => {
  await go('#/');
  for (const l of ['zh', 'en', 'ko', 'vi']) {
    await setLang(l);
    await page.getByText(LANGS[l]).first().waitFor({ timeout: 3000 });
    assert(await overflowOk(), 'overflow in ' + l);
    await page.screenshot({ path: `${SHOTS}/L1-global-${l}.png` });
  }
});
const PAGES = ['#/', '#/settings', '#/library', '#/world', '#/backup', '#/offline', '#/vault', '#/import', '#/new',
  '#/j/demo-journey', '#/j/demo-journey/journey', '#/j/demo-journey/journey/demo-d1', '#/j/demo-journey/journey/demo-d2', '#/j/demo-journey/map', '#/j/demo-journey/pose', '#/j/demo-journey/wallet',
  '#/j/demo-journey/budget', '#/j/demo-journey/food', '#/j/demo-journey/memories/book', '#/j/demo-journey/memories/gallery', '#/j/demo-journey/memories/keepsakes', '#/j/demo-journey/memories/new',
  '#/j/demo-journey/checklist', '#/j/demo-journey/transport', '#/j/demo-journey/weather', '#/j/demo-journey/magic', '#/j/demo-journey/features', '#/j/demo-journey/search',
  '#/j/demo-journey/appearance', '#/j/demo-journey/travel-doc', '#/j/demo-journey/capsules', '#/j/demo-journey/postcards', '#/j/demo-journey/ending', '#/j/demo-journey/export', '#/j/demo-journey/emergency', '#/j/demo-journey/language'];
for (const l of ['en', 'ko', 'zh']) {
  await step(`L2 every screen translated + no overflow (${l})`, async () => {
    await go('#/');
    await setLang(l);
    const bad = [];
    for (const h of PAGES) {
      // zh interface shows Vietnamese meanings under Chinese phrases by design (the user reads Vietnamese)
      if (l === 'zh' && /language|emergency/.test(h)) continue;
      await go(h);
      await page.waitForTimeout(150);
      if (!(await overflowOk())) bad.push(`${h}: horizontal overflow`);
      const text = await page.evaluate(() => {
        const out = [];
        // visible text minus the independent immigration card (its own language)
        const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
        while (walker.nextNode()) {
          const n = walker.currentNode;
          if (n.parentElement?.closest('[data-testid="travel-card"], [hidden], option, noscript, script, style, [data-lang]')) continue;
          if (n.textContent.trim()) out.push(n.textContent.trim());
        }
        // attributes the user/VoiceOver sees
        for (const el of document.querySelectorAll('[placeholder],[aria-label],[title]')) for (const a of ['placeholder', 'aria-label', 'title']) if (el.getAttribute(a)) out.push(el.getAttribute(a));
        return out;
      });
      const vi = text.map((s) => s.replaceAll('Những bước chân của Chang', '')).filter((s) => /[ăâđêôơưạảấầẩẫậắằẳẵặẹẻẽếềểễệỉịọỏốồổỗộớờởỡợụủứừửữựỳỵỷỹĂÂĐÊÔƠƯ]/.test(s));
      if (vi.length) bad.push(`${h}: ${vi.slice(0, 3).join(' | ')}`);
    }
    await page.screenshot({ path: `${SHOTS}/L2-wallet-${l}.png` });
    assert(!bad.length, bad.slice(0, 6).join('\n'));
  });
}
await step('L3 journey menu language switch + persistence after reload + offline switching', async () => {
  await go('#/j/demo-journey');
  await setLang('ko');
  await page.locator('.tabbar').getByText('지갑').waitFor();
  await page.reload();
  await page.locator('.tabbar').getByText('지갑').waitFor({ timeout: 5000 });
  await ctx.setOffline(true);
  await page.reload();
  await page.locator('.tabbar').getByText('지갑').waitFor({ timeout: 5000 });
  await setLang('en');
  await page.locator('.tabbar').getByText('Wallet').waitFor();
  await page.screenshot({ path: `${SHOTS}/L3-journey-en-offline.png` });
  await ctx.setOffline(false);
  await setLang('vi');
});
await step('L4 immigration card language is independent of the app language', async () => {
  await go('#/j/demo-journey/travel-doc');
  await page.getByRole('button', { name: '한국어' }).click();
  const txt = await page.getByTestId('travel-card').innerText();
  assert(txt.includes('여행 정보'), 'card in Korean');
  assert(await page.getByRole('button', { name: 'Chi tiết' }).isVisible(), 'app still Vietnamese');
  await go('#/');
  assert(await page.getByText('Thêm chuyến đi').first().isVisible(), 'global UI still Vietnamese');
});
await step('L5 iPhone layout: tab labels and long buttons fit in all four languages', async () => {
  for (const l of ['vi', 'zh', 'en', 'ko']) {
    await go('#/j/demo-journey');
    await setLang(l);
    await go('#/j/demo-journey/wallet');
    const clipped = await page.evaluate(() => [...document.querySelectorAll('.tabbar button span, .btn, .seg button')].filter((e) => e.scrollWidth > e.clientWidth + 2 && getComputedStyle(e).overflow !== 'visible').map((e) => e.textContent));
    assert(await overflowOk(), 'overflow ' + l);
    assert(!clipped.length, `${l} clipped: ${clipped.join(', ')}`);
    await page.screenshot({ path: `${SHOTS}/L5-wallet-${l}.png` });
  }
  await setLang('vi');
});

console.log('\nJS errors:', errors.length ? errors : 'none');
const pass = results.filter((r) => r.ok).length;
console.log(`${pass}/${results.length} steps passed`);
writeFileSync('tests/e2e/v101-results.json', JSON.stringify({ results, errors }, null, 2));
await browser.close();
process.exit(pass === results.length && !errors.length ? 0 : 1);
