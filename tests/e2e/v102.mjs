// V1.0.2 E2E: upgrade v1.0.1 → v1.0.2, consent-gated user-content translation into 4 languages, offline reading.
// Synthetic data only. The MyMemory endpoint is mocked with page routes (no real network call is made).
// Usage: OLD_DIST=<v1.0.1 dist> NEW_DIST=dist SITE=/tmp/site BASE=http://localhost:4174/changs-journey/ node tests/e2e/v102.mjs
import { chromium } from 'playwright';
import { cpSync, mkdirSync, readFileSync, rmSync } from 'node:fs';

const { OLD_DIST, NEW_DIST = 'dist', SITE, BASE } = process.env;
const NEW_VERSION = JSON.parse(readFileSync('package.json', 'utf8')).version;
const APP = `${SITE}/changs-journey`;
const SHOTS = 'tests/e2e/shots';
mkdirSync(SHOTS, { recursive: true });
const deploy = (dir) => { rmSync(APP, { recursive: true, force: true }); mkdirSync(APP, { recursive: true }); cpSync(dir, APP, { recursive: true }); };
const results = [];
const errors = [];
const assert = (c, m) => { if (!c) throw new Error(m); };

const browser = await chromium.launch({ executablePath: process.env.CHROME ?? '/usr/bin/google-chrome', args: ['--no-sandbox'] });
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true, locale: 'vi-VN', timezoneId: 'Asia/Seoul' });
const page = await ctx.newPage();
page.on('pageerror', (e) => errors.push(e.message));

// Mocked MyMemory: "[<target>] <text>"
const sent = [];
let quotaAfter = Infinity;
const mockRoute = (route) => {
  const u = new URL(route.request().url());
  const q = u.searchParams.get('q');
  const to = u.searchParams.get('langpair').split('|')[1];
  sent.push({ q, pair: u.searchParams.get('langpair') });
  if (sent.length > quotaAfter) return route.fulfill({ status: 429, contentType: 'application/json', body: '{}' });
  route.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify({ responseStatus: 200, responseData: { translatedText: `[${to}] ${q}` } }) });
};

const step = async (name, fn) => {
  try { await fn(); results.push({ name, ok: true }); console.log('✔', name); }
  catch (e) { results.push({ name, ok: false, err: e.message.split('\n')[0] }); console.log('✘', name, '—', e.message.split('\n')[0]); await page.screenshot({ path: `${SHOTS}/FAIL-${name.replace(/\W+/g, '_')}.png` }).catch(() => {}); }
};
const go = async (h) => { await page.evaluate((x) => (location.hash = x), h); await page.waitForTimeout(500); };
const pick = async (trigger, file) => { const [fc] = await Promise.all([page.waitForEvent('filechooser'), trigger()]); await fc.setFiles(file); await page.waitForTimeout(700); };
const idb = (fn) => page.evaluate(`new Promise((res, rej) => { const o = indexedDB.open('chang-journeys'); o.onsuccess = () => { const db = o.result; (${fn})(db, res); }; o.onerror = () => rej(o.error); })`);
const all = (store) => idb(`(db, res) => { if (!db.objectStoreNames.contains('${store}')) return res(null); const q = db.transaction('${store}').objectStore('${store}').getAll(); q.onsuccess = () => res(q.result); }`);
const put = (store, val) => idb(`(db, res) => { const tx = db.transaction('${store}', 'readwrite'); tx.objectStore('${store}').put(${JSON.stringify(val)}); tx.oncomplete = () => res(true); }`);
const setLang = async (l) => {
  if (!(await page.getByTestId('lang-button').count())) await go('#/');
  await page.getByTestId('lang-button').first().click(); await page.locator(`[data-lang="${l}"]`).first().click(); await page.waitForTimeout(500);
};
const bodyText = () => page.evaluate(() => document.body.innerText);

// Fictional addresses/names are read from the fixture (the privacy guard rejects street addresses typed into source).
const FX = JSON.parse(readFileSync('tests/fixtures/demo-journey.changjourney.json', 'utf8'));
const SECRET = ['Secret diary line', 'Private feelings text', 'BOOKREF-777', FX.journey.hotel.addressZh, FX.journey.hotel.addressEn, ...FX.places.flatMap((p) => [p.nameZh, p.addressZh, p.addressEn]).filter(Boolean)];
let before;

await step('U1 v1.0.1: import demo journey + add a private memory, a normal memory and a booking ref', async () => {
  deploy(OLD_DIST);
  await page.goto(BASE);
  await page.getByRole('button', { name: /Nhập hành trình từ tệp/ }).first().click();
  await pick(() => page.getByRole('button', { name: /Chọn tệp/ }).click(), 'tests/fixtures/demo-journey.changjourney.json');
  await page.getByRole('button', { name: 'Nhập vào máy' }).click();
  await page.locator('.jhome').waitFor();
  const now = new Date().toISOString();
  const mem = { journeyId: 'demo-journey', dayId: 'demo-d1', photoBlobIds: [], layout: 'classic', keepsake: false, createdAt: now, updatedAt: now, activityIds: [] };
  await put('memories', { ...mem, id: 'mem-priv', title: 'Secret diary line', body: 'Private feelings text', privacy: 'private' });
  await put('memories', { ...mem, id: 'mem-pub', title: 'Happy evening walk', body: 'The lights were beautiful', privacy: 'normal' });
  const docs = await all('docs');
  if (docs[0]) await put('docs', { ...docs[0], details: 'BOOKREF-777', bookingRef: 'BOOKREF-777' });
  before = { acts: (await all('activities')).length, days: (await all('days')).length, docs: (await all('docs')).length, mems: (await all('memories')).length, atts: (await all('attachments'))?.length };
  assert(before.days === 3 && before.mems === 2, JSON.stringify(before));
});

await step('U2 deploy v1.0.2: app updates in place, translations store added, no data lost', async () => {
  deploy(NEW_DIST);
  await go('#/');
  for (let i = 0; i < 6; i++) {
    await page.reload(); // a same-URL goto would only change the hash, not reload
    await page.waitForTimeout(1500);
    if ((await page.evaluate(() => document.documentElement.dataset.appVersion)) === NEW_VERSION) break;
  }
  assert((await page.evaluate(() => document.documentElement.dataset.appVersion)) === NEW_VERSION, 'not on ' + NEW_VERSION);
  assert(Array.isArray(await all('translations')), 'translations store missing');
  const after = { acts: (await all('activities')).length, days: (await all('days')).length, docs: (await all('docs')).length, mems: (await all('memories')).length, atts: (await all('attachments'))?.length };
  assert(JSON.stringify(after) === JSON.stringify(before), `${JSON.stringify(before)} → ${JSON.stringify(after)}`);
});

// Route installed after the upgrade (Playwright request interception would otherwise stand in for the SW update check).
await ctx.route('https://api.mymemory.translated.net/**', mockRoute);
await step('T1 nothing is sent before consent (auto-translate stays off)', async () => {
  await go('#/translate');
  await page.getByTestId('tx-consent').waitFor();
  await page.waitForTimeout(9500);
  assert(sent.length === 0, `${sent.length} requests before consent`);
  assert(await page.getByTestId('tx-status').isVisible(), 'status block');
});

await step('T2 consent → translate missing (incl. non-private memories) → progress → saved', async () => {
  await page.getByTestId('tx-agree').click();
  await page.waitForTimeout(400);
  await page.getByText('Kỷ niệm (chỉ những kỷ niệm không riêng tư)').click();
  await page.waitForTimeout(400);
  const btn = page.getByTestId('tx-run');
  await btn.waitFor();
  await btn.click();
  await page.getByText(/Đã dịch đủ ✓/).waitFor({ timeout: 60000 });
  const rows = await all('translations');
  assert(rows.length > 20, `only ${rows.length} rows`);
  assert(rows.every((r) => r.source === 'machine' && r.srcHash && r.lang !== r.srcLang), 'bad rows');
  for (const l of ['vi', 'zh', 'ko']) assert(rows.some((r) => r.lang === l && r.recordId === 'demo-d1' && r.field === 'title'), `day title → ${l}`);
  await page.screenshot({ path: `${SHOTS}/v102-translate-page.png`, fullPage: true });
});

await step('T3 privacy: private memory, addresses, Chinese names and booking refs were never sent', async () => {
  const blob = JSON.stringify(sent);
  for (const s of SECRET) assert(!blob.includes(s), `leaked: ${s}`);
  assert(sent.some((x) => x.q === 'Happy evening walk'), 'non-private memory was not sent');
  assert(sent.every((x) => /^(en|vi|zh-CN|ko)\|(en|vi|zh-CN|ko)$/.test(x.pair)), 'bad pairs');
});

await step('T4 Korean/Chinese/Vietnamese interface shows translated user content', async () => {
  await setLang('ko');
  await go('#/j/demo-journey/journey');
  let txt = await bodyText();
  assert(txt.includes('[ko] Demo day 1'), 'ko day title missing');
  await setLang('zh');
  await go('#/j/demo-journey/journey');
  txt = await bodyText();
  assert(txt.includes('[zh-CN] Demo day 1'), 'zh day title missing');
  await setLang('vi');
  await go('#/j/demo-journey');
  txt = await bodyText();
  assert(txt.includes('[vi] '), 'vi translated content missing on journey home');
  await setLang('en');
  await go('#/j/demo-journey/journey');
  txt = await bodyText();
  assert(txt.includes('Demo day 1') && !txt.includes('[en] Demo day 1'), 'en must show the original (source is English)');
  await page.screenshot({ path: `${SHOTS}/v102-en-journey.png` });
});

await step('T5 offline: reload with no network — translations still shown in all languages', async () => {
  await ctx.setOffline(true);
  await page.goto(BASE + '#/j/demo-journey/journey');
  await page.waitForTimeout(1500);
  await setLang('ko');
  await go('#/j/demo-journey/journey');
  assert((await bodyText()).includes('[ko] Demo day 1'), 'ko offline');
  await setLang('zh');
  await go('#/j/demo-journey/journey');
  assert((await bodyText()).includes('[zh-CN] Demo day 1'), 'zh offline');
  await go('#/translate');
  assert(await page.getByTestId('tx-run').isDisabled(), 'translate button must be disabled offline');
  await page.screenshot({ path: `${SHOTS}/v102-offline-zh.png` });
});

await step('T6 manual edit offline is saved and shown; not overwritten later', async () => {
  await page.getByPlaceholder(/./).last().fill('Demo day 2');
  await page.getByTestId('tx-item').first().click();
  await page.getByTestId('tx-edit').waitFor();
  await page.locator('[data-testid="tx-edit"] textarea[data-tx-lang="zh"]').fill('第二天（手动）');
  await page.getByTestId('tx-save').click();
  await page.waitForTimeout(500);
  await go('#/j/demo-journey/journey');
  assert((await bodyText()).includes('第二天（手动）'), 'manual zh not shown');
  const r = (await all('translations')).find((x) => x.recordId === 'demo-d2' && x.field === 'title' && x.lang === 'zh');
  assert(r?.source === 'manual', 'not saved as manual');
});

await step('T7 editing the original falls back to the original until re-translated; online auto-translate fills it', async () => {
  const d1 = (await all('days')).find((d) => d.id === 'demo-d1');
  await put('days', { ...d1, title: 'Demo day 1 (edited)' });
  await page.reload();
  await page.waitForTimeout(800);
  await go('#/j/demo-journey/journey');
  let txt = await bodyText();
  assert(txt.includes('Demo day 1 (edited)') && !txt.includes('[zh-CN] Demo day 1'), 'stale translation shown');
  const n = sent.length;
  await ctx.setOffline(false);
  await page.evaluate(() => dispatchEvent(new Event('online')));
  // auto-translate is debounced (8 s); poll up to 30 s
  for (let i = 0; i < 30 && !(await bodyText()).includes('[zh-CN] Demo day 1 (edited)'); i++) await page.waitForTimeout(1000);
  txt = await bodyText();
  assert(sent.length > n, 'auto-translate did not run when back online');
  assert(txt.includes('[zh-CN] Demo day 1 (edited)'), 'auto translation not shown');
  const manual = (await all('translations')).find((x) => x.recordId === 'demo-d2' && x.field === 'title' && x.lang === 'zh');
  assert(manual?.text === '第二天（手动）', 'manual translation was overwritten');
});

await step('T8 activity detail: "show original" toggle', async () => {
  await setLang('ko');
  await go('#/j/demo-journey/journey/demo-d1');
  await page.locator('.tl-title').first().click();
  await page.waitForTimeout(500);
  const tog = page.getByTestId('tx-toggle');
  await tog.waitFor();
  const translated = await page.locator('.sheet').innerText();
  assert(translated.includes('[ko]'), 'sheet not translated');
  await tog.click();
  await page.waitForTimeout(300);
  assert(!(await page.locator('.sheet').innerText()).includes('[ko]'), 'original not shown');
  await page.getByTestId('tx-toggle').click();
  await page.keyboard.press('Escape');
});

await step('T9 quota: stops cleanly, keeps what was saved, explains it', async () => {
  await setLang('vi');
  await page.evaluate(() => new Promise((res) => { const o = indexedDB.open('chang-journeys'); o.onsuccess = () => { const tx = o.result.transaction('translations', 'readwrite'); tx.objectStore('translations').clear(); tx.oncomplete = res; }; }));
  quotaAfter = sent.length + 4;
  await page.reload();
  await page.waitForTimeout(600);
  await go('#/translate');
  const s = await page.evaluate(() => 1);
  await page.getByText('Tự động dịch nội dung mới khi có mạng').click(); // turn auto off so only the button runs
  await page.waitForTimeout(300);
  await page.getByTestId('tx-run').click();
  await page.getByText(/hết hạn mức/).waitFor({ timeout: 20000 });
  const rows = await all('translations');
  assert(rows.length === 4, `expected 4 saved before quota, got ${rows.length}`);
  quotaAfter = Infinity;
  void s;
});

await step('T10 no horizontal overflow on the translate page in all four languages', async () => {
  for (const l of ['vi', 'en', 'zh', 'ko']) {
    await setLang(l);
    await go('#/translate');
    assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), `overflow in ${l}`);
  }
  await page.screenshot({ path: `${SHOTS}/v102-translate-ko.png`, fullPage: true });
});

await browser.close();
const bad = results.filter((r) => !r.ok);
console.log(`\n${results.length - bad.length}/${results.length} steps passed; page errors: ${errors.length}`);
if (errors.length) console.log(errors.slice(0, 5));
process.exit(bad.length || errors.length ? 1 : 0);
