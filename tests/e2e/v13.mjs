// V1.3 E2E: celestial sky, Chang's Magical Flight, Advent doors, snow-globe physics, Storybook paper page, timeline
// hierarchy, phrase cards, language audit. Synthetic artwork + the test ticket PNG as "sticker" — no personal images.
// Usage: BASE=http://localhost:4173/ node tests/e2e/v13.mjs
import { chromium } from 'playwright';
import { mkdirSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { deflateSync } from 'node:zlib';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import JSZip from 'jszip';

const BASE = process.env.BASE ?? 'http://localhost:4173/';
const SHOTS = 'tests/e2e/shots';
mkdirSync(SHOTS, { recursive: true });
const results = [];
const errors = [];
const assert = (c, m) => { if (!c) throw new Error(m); };

const crcT = Array.from({ length: 256 }, (_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; });
const crc = (b) => { let c = 0xffffffff; for (const x of b) c = crcT[(c ^ x) & 255] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
const chunk = (type, data) => { const len = Buffer.alloc(4); len.writeUInt32BE(data.length); const td = Buffer.concat([Buffer.from(type), data]); const c = Buffer.alloc(4); c.writeUInt32BE(crc(td)); return Buffer.concat([len, td, c]); };
function png(w, h, px) {
  const raw = Buffer.alloc((w * 4 + 1) * h);
  for (let y = 0; y < h; y++) { raw[y * (w * 4 + 1)] = 0; for (let x = 0; x < w; x++) raw.set(px(x, y), y * (w * 4 + 1) + 1 + x * 4); }
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 6;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
}
const disc = (w, h, rgb) => png(w, h, (x, y) => ((x - w / 2) ** 2 + (y - h / 2) ** 2 < (Math.min(w, h) / 2.2) ** 2 ? [...rgb, 255] : [0, 0, 0, 0]));
const solid = (w, h, rgb) => png(w, h, () => [...rgb, 255]);
async function makePack(path) {
  const z = new JSZip();
  const assets = [];
  const add = (id, group, buf, extra = {}) => {
    z.file(`orig/${id}.png`, buf);
    assets.push({ id, name: id, group, theme: 'christmas-emerald', placement: 'test', width: 120, height: 132, aspect: 0.9, alpha: true, privacy: 'private-local', files: { orig: `orig/${id}.png` }, sha256: { orig: createHash('sha256').update(buf).digest('hex') }, ...extra });
  };
  add('globe', 'globe', disc(120, 132, [40, 60, 90]), { glass: [0.5, 0.37, 0.38] });
  add('page', 'page', solid(60, 80, [255, 248, 238]), { safe: [0.1, 0.13, 0.9, 0.74] });
  z.file('manifest.json', JSON.stringify({ format: 'chang-artwork-pack', version: 1, assets }));
  writeFileSync(path, await z.generateAsync({ type: 'nodebuffer' }));
}

const browser = await chromium.launch({ executablePath: process.env.CHROME ?? '/usr/bin/google-chrome', args: ['--no-sandbox'] });
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, locale: 'vi-VN' });
const page = await ctx.newPage();
page.on('pageerror', (e) => errors.push(e.message));
// December of the demo trip's year (2031) so some Advent doors are openable and some are not
await page.clock.setFixedTime(new Date('2031-12-08T10:00:00+09:00'));
const step = async (name, fn) => {
  try { await fn(); results.push({ name, ok: true }); console.log('✔', name); }
  catch (e) { results.push({ name, ok: false }); console.log('✘', name, '—', e.message.split('\n')[0]); await page.screenshot({ path: `${SHOTS}/FAIL-${name.replace(/\W+/g, '_')}.png` }).catch(() => {}); }
};
const go = async (h) => { await page.evaluate((x) => (location.hash = x), h); await page.waitForTimeout(700); };
const pick = async (trigger, file) => { const [fc] = await Promise.all([page.waitForEvent('filechooser'), trigger()]); await fc.setFiles(file); await page.waitForTimeout(800); };
const idb = (fn) => page.evaluate(`new Promise((res, rej) => { const o = indexedDB.open('chang-journeys'); o.onsuccess = () => { const db = o.result; (${fn})(db, res); }; o.onerror = () => rej(o.error); })`);
const all = (store) => idb(`(db, res) => { const q = db.transaction('${store}').objectStore('${store}').getAll(); q.onsuccess = () => res(q.result); }`);
const lang = async (l) => { await go('#/'); await page.getByTestId('lang-button').first().click(); await page.locator(`[data-lang="${l}"]`).first().click(); await page.waitForTimeout(400); };
const packPath = join(tmpdir(), 'v13.artpack.zip');
await makePack(packPath);

await step('C0 import demo journey + synthetic art', async () => {
  await page.goto(BASE);
  await page.getByRole('button', { name: /Nhập hành trình từ tệp/ }).first().click();
  await pick(() => page.getByRole('button', { name: /Chọn tệp/ }).click(), 'tests/fixtures/demo-journey.changjourney.json');
  await page.getByRole('button', { name: 'Nhập vào máy' }).click();
  await page.locator('.jhome').waitFor();
  await page.waitForTimeout(3300);
  await go('#/artwork');
  await pick(() => page.getByTestId('artpack-import').click(), packPath);
  await page.waitForFunction(() => document.querySelectorAll('[data-testid="art-tile"]').length >= 2, null, { timeout: 30000 });
});

await step('C1 no sticker yet: Magic page offers to add it — never a default Santa', async () => {
  await go('#/j/demo-journey/magic');
  assert(!(await page.getByTestId('flight-once').count()), 'flight available without sticker');
  assert(await page.getByRole('button', { name: 'Thêm sticker xe tuần lộc' }).count(), 'no add-sticker prompt');
  assert(!(await page.getByText(/ông già Noel/).count()), 'Santa text still present');
});

await step('C2 celestial sky: layered canvas on Home/Journey/Magic, density & speed settings persist', async () => {
  await go('#/j/demo-journey/appearance');
  await pick(() => page.getByTestId('sticker-import').click(), 'tests/fixtures/ticket.png');
  for (const r of ['#/j/demo-journey', '#/j/demo-journey/journey', '#/j/demo-journey/magic']) {
    await go(r);
    assert(await page.getByTestId('sky-canvas').count(), `no sky on ${r}`);
  }
  const lit = await page.evaluate(() => { const c = document.querySelector('[data-testid="sky-canvas"]'); const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data; let n = 0; for (let i = 3; i < d.length; i += 16) if (d[i] > 10) n++; return n; });
  assert(lit > 200, `sky looks empty (${lit})`);
  await page.getByTestId('sky-density').evaluate((e) => { const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set; set.call(e, '1.8'); e.dispatchEvent(new Event('input', { bubbles: true })); });
  await page.getByTestId('sky-speed').evaluate((e) => { const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set; set.call(e, '0.6'); e.dispatchEvent(new Event('input', { bubbles: true })); });
  await page.reload();
  await page.waitForTimeout(800);
  const s = await page.evaluate(() => JSON.parse(localStorage.getItem('chang-sky')));
  assert(s.density === 1.8 && s.speed === 0.6, JSON.stringify(s));
  // content stays readable: the sky sits behind the page content
  const z = await page.evaluate(() => getComputedStyle(document.querySelector('.sky-layer .snow-canvas')).zIndex);
  assert(z === '0', `sky z-index ${z}`);
});

await step('C3 Chang’s Magical Flight: the personal sticker flies the whole viewport, turns, changes size, trails dust, stops', async () => {
  await go('#/j/demo-journey/magic');
  await page.getByTestId('flight-loop').click();
  await page.getByTestId('magical-flight').waitFor();
  const src = await page.locator('.flight-sleigh img').getAttribute('src');
  assert(src?.startsWith('blob:'), 'not the stored personal sticker');
  const samples = [];
  let dust = 0;
  for (let i = 0; i < 46; i++) {
    if (!dust) dust = await page.evaluate(() => { const r = document.querySelector('.flight-sleigh').getBoundingClientRect(); if (r.right < 0 || r.left > innerWidth) return 0; const c = document.querySelector('.flight-dust'); const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data; let n = 0; for (let i = 3; i < d.length; i += 16) if (d[i] > 20) n++; return n; });
    samples.push(await page.evaluate(() => { const r = document.querySelector('.flight-sleigh').getBoundingClientRect(); const m = document.querySelector('.flight-sleigh').style.transform; return { cx: r.left + r.width / 2, cy: r.top + r.height / 2, w: r.width, flip: /scaleX\(-1\)/.test(m) }; }));
    await page.waitForTimeout(500);
  }
  const xs = samples.map((s) => s.cx), ys = samples.map((s) => s.cy), ws = samples.map((s) => s.w);
  assert(Math.min(...xs) < 0 && Math.max(...xs) > 390, `x range ${Math.min(...xs)}..${Math.max(...xs)} — not across the viewport`);
  assert(Math.max(...ys) - Math.min(...ys) > 844 * 0.35, 'altitude barely changes');
  assert(Math.max(...ws) / Math.min(...ws) > 1.4, 'no near/far scaling');
  assert(samples.some((s) => s.flip) && samples.some((s) => !s.flip), 'never turns around');
  await page.getByTestId('flight-stop').click();
  assert(dust > 20, `no star-dust trail (${dust})`);
  await page.waitForTimeout(300);
  assert(!(await page.getByTestId('magical-flight').count()), 'stop did not stop');
});

await step('C4 Advent doors: future / ready / opened are distinct; future cannot be opened early; opening persists', async () => {
  await go('#/j/demo-journey/magic');
  const states = await page.locator('.advent-door').evaluateAll((els) => els.map((e) => e.dataset.state));
  assert(states.length === 25, 'not 25 doors');
  assert(states.slice(0, 8).every((s) => s === 'ready') && states.slice(8).every((s) => s === 'future'), states.join(','));
  // future doors are full-opacity, readable — not a greyed-out disabled button
  const op = await page.locator('.advent-door[data-state="future"] .door-panel').first().evaluate((e) => getComputedStyle(e).opacity);
  assert(op === '1', `future opacity ${op}`);
  await page.locator('[data-testid="advent"]').scrollIntoViewIfNeeded();
  await page.locator('.advent-door').nth(19).click({ force: true }); // aria-disabled: still tappable, explains when it opens
  await page.waitForTimeout(200);
  assert(await page.getByText(/mở vào ngày 20\/12/).count(), 'no explanation toast');
  await page.waitForTimeout(300);
  assert(!(await page.getByTestId('advent-msg').count()), 'future door opened early');
  await page.locator('.advent-door').nth(2).click();
  await page.waitForTimeout(400);
  assert(await page.locator('.advent-door').nth(2).locator('.door-burst').count(), 'no light/dust burst');
  await page.waitForTimeout(900);
  assert((await page.getByTestId('advent-msg').innerText()).includes('3/12'), 'message');
  await page.reload();
  await page.waitForTimeout(800);
  assert((await page.locator('.advent-door').nth(2).getAttribute('data-state')) === 'opened', 'not persisted');
});

await step('C5 snow globe: snow stays inside the glass and never below the snow bank; stirring then settling', async () => {
  await go('#/j/demo-journey/magic');
  const g = page.getByTestId('globe-art');
  await g.scrollIntoViewIfNeeded();
  const box = await g.boundingBox();
  await page.mouse.move(box.x + box.width * 0.4, box.y + box.height * 0.3);
  await page.mouse.down();
  for (let i = 0; i < 10; i++) await page.mouse.move(box.x + box.width * (0.3 + (i % 2) * 0.4), box.y + box.height * 0.35, { steps: 3 });
  await page.mouse.up();
  const check = () => page.evaluate(() => {
    const c = document.querySelector('.globe-snow'); const ctx = c.getContext('2d'); const W = c.width, H = c.height;
    const d = ctx.getImageData(0, 0, W, H).data; let below = 0, outside = 0, inside = 0;
    for (let y = 0; y < H; y += 2) for (let x = 0; x < W; x += 2) {
      if (d[(y * W + x) * 4 + 3] < 30) continue;
      if (y > 0.6 * H + 2) below++;
      else if ((x - 0.5 * W) ** 2 + (y - 0.37 * H) ** 2 > (0.38 * W) ** 2) outside++;
      else inside++;
    }
    return { below, outside, inside };
  });
  const a = await check();
  assert(a.inside > 30 && a.below === 0 && a.outside === 0, `while stirred ${JSON.stringify(a)}`);
  await page.waitForTimeout(5000);
  const b = await check();
  assert(b.below === 0 && b.outside === 0 && b.inside > 10, `after settling ${JSON.stringify(b)}`);
});

await step('C6 Storybook: book opens onto a cream paper page that creates the first page directly', async () => {
  await go('#/j/demo-journey/storybook');
  await page.getByTestId('storybook-cover').click();
  await page.waitForTimeout(1300);
  assert(await page.locator('.book-opened').count(), 'no opening transition');
  const empty = page.getByTestId('story-empty');
  await empty.waitFor();
  const bg = await empty.evaluate((e) => getComputedStyle(e).backgroundColor);
  assert(bg === 'rgb(255, 248, 238)', `paper ${bg}`);
  await empty.click();
  await page.getByTestId('layer-editor').waitFor();
  await page.keyboard.press('Escape');
  await page.waitForTimeout(600);
  assert((await all('storypages')).length === 1, 'first page not created');
  assert(!(await page.getByTestId('story-empty').count()), 'empty invitation still shown');
});

await step('C7 Journey day: part-of-day headings, time/place/activity hierarchy, key moments accented, reorder kept', async () => {
  await go('#/j/demo-journey/journey/demo-d1');
  const per = await page.locator('.tl-period').allInnerTexts();
  assert(per.length >= 2, `periods ${per}`);
  assert(await page.locator('.tl-item.key').count(), 'no key accent');
  assert(await page.locator('.tl-clock').count() && await page.locator('.tl-title').count(), 'hierarchy');
  await page.getByTestId('reorder-toggle').click();
  assert(await page.locator('.tl-move').count(), 'reorder lost');
  assert(!(await page.locator('.tl-period').count()), 'period headings during reorder');
  await page.getByTestId('reorder-toggle').click();
});

await step('C8 language assistant: big hanzi, champagne pinyin with tones, meaning in UI language, speak/copy/present', async () => {
  await go('#/j/demo-journey/language');
  const c = page.getByTestId('phrase').first();
  const fs = await c.locator('.phrase-zh').evaluate((e) => parseFloat(getComputedStyle(e).fontSize));
  const col = await c.locator('.phrase-py').evaluate((e) => getComputedStyle(e).color);
  assert(fs >= 26, `hanzi ${fs}`);
  assert(col === 'rgb(233, 207, 150)', `pinyin ${col}`);
  assert(/[āáǎàēéěèīíǐìōóǒòūúǔùǖǘǚǜ]/.test(await c.locator('.phrase-py').innerText()), 'tone marks');
  assert((await c.locator('.phrase-meaning').innerText()) === 'Xin chào', 'vi meaning');
  for (const n of ['Sao chép', 'Trình chiếu']) assert(await c.getByRole('button', { name: n }).count(), n);
  await c.getByRole('button', { name: 'Trình chiếu' }).click();
  assert(await page.locator('.bigtext').count(), 'present');
  await page.locator('.bigtext').click();
  await lang('ko');
  await go('#/j/demo-journey/language');
  assert((await page.getByTestId('phrase').first().locator('.phrase-meaning').innerText()) === '안녕하세요', 'ko meaning');
  await lang('zh');
  await go('#/j/demo-journey/language');
  assert(!(await page.getByTestId('phrase').first().locator('.phrase-meaning').count()), 'zh: no second language');
});

await step('C9 language audit: no Vietnamese interface text in zh / ko / en (brand name & language names excepted)', async () => {
  const VI = /[ăâđêôơưạảấầẩẫậắằẳẵặẹẻẽếềểễệỉịọỏốồổỗộớờởỡợụủứừửữựỳỵỷỹ]/i;
  const ALLOWED = /^(Những bước chân của Chang.*|Tiếng Việt)$/;
  const routes = ['#/', '#/settings', '#/j/demo-journey', '#/j/demo-journey/journey', '#/j/demo-journey/journey/demo-d1', '#/j/demo-journey/wallet', '#/j/demo-journey/features', '#/j/demo-journey/storybook', '#/j/demo-journey/magic', '#/j/demo-journey/language', '#/j/demo-journey/emergency', '#/j/demo-journey/food'];
  const bad = [];
  for (const l of ['zh', 'ko', 'en']) {
    await lang(l);
    for (const r of routes) {
      await go(r);
      const lines = (await page.evaluate(() => document.body.innerText)).split('\n').map((s) => s.trim()).filter((s) => s && VI.test(s) && !ALLOWED.test(s) && !/^Những bước chân của Chang/.test(s));
      for (const x of lines) bad.push(`${l} ${r}: ${x}`);
    }
  }
  assert(!bad.length, bad.slice(0, 6).join(' | '));
  await lang('vi');
});

await browser.close();
const bad = results.filter((r) => !r.ok);
console.log(`\n${results.length - bad.length}/${results.length} steps passed; page errors: ${errors.length}`);
if (errors.length) console.log(errors.slice(0, 5));
process.exit(bad.length || errors.length ? 1 : 0);
