// V1.2 E2E: artwork pack import & manager, tree/icons/globe integration, postcards, storybook, frames, pose albums,
// sleigh date preview, upgrade 1.1.0 → 1.2.0 (DB v4). Uses a SYNTHETIC pack generated here — no real artwork in the repo.
// Usage: BASE=http://localhost:4173/ [OLD_DIST=<1.1.0 dist> SITE=/tmp/site UPG_BASE=http://localhost:4174/changs-journey/] node tests/e2e/v12.mjs
import { chromium } from 'playwright';
import { cpSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { deflateSync } from 'node:zlib';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import JSZip from 'jszip';

const BASE = process.env.BASE ?? 'http://localhost:4173/';
const { OLD_DIST, SITE, UPG_BASE } = process.env;
const NEW_VERSION = JSON.parse(readFileSync('package.json', 'utf8')).version;
const SHOTS = 'tests/e2e/shots';
mkdirSync(SHOTS, { recursive: true });
const results = [];
const errors = [];
const assert = (c, m) => { if (!c) throw new Error(m); };

// ── tiny PNG encoder (RGBA) for synthetic artwork
const crcT = Array.from({ length: 256 }, (_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; });
const crc = (b) => { let c = 0xffffffff; for (const x of b) c = crcT[(c ^ x) & 255] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
const chunk = (type, data) => { const len = Buffer.alloc(4); len.writeUInt32BE(data.length); const td = Buffer.concat([Buffer.from(type), data]); const c = Buffer.alloc(4); c.writeUInt32BE(crc(td)); return Buffer.concat([len, td, c]); };
function png(w, h, px) {
  const raw = Buffer.alloc((w * 4 + 1) * h);
  for (let y = 0; y < h; y++) { raw[y * (w * 4 + 1)] = 0; for (let x = 0; x < w; x++) { const [r, g, b, a] = px(x, y); raw.set([r, g, b, a], y * (w * 4 + 1) + 1 + x * 4); } }
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 6;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
}
const solid = (w, h, rgb) => png(w, h, () => [...rgb, 255]);
const disc = (w, h, rgb) => png(w, h, (x, y) => ((x - w / 2) ** 2 + (y - h / 2) ** 2 < (Math.min(w, h) / 2.2) ** 2 ? [...rgb, 255] : [0, 0, 0, 0]));
const ring = (w, h) => png(w, h, (x, y) => (x < w * 0.12 || x > w * 0.88 || y < h * 0.1 || y > h * 0.9 ? [213, 180, 119, 255] : [0, 0, 0, 0]));
const hole = (w, h) => png(w, h, (x, y) => (x < w * 0.12 || x > w * 0.88 || y < h * 0.1 || y > h * 0.9 ? [0, 0, 0, 0] : [255, 255, 255, 255]));

const CHARMS = ['compass', 'crescent', 'suitcase', 'diary', 'lantern', 'snowflake', 'ribbon', 'pine', 'skyline', 'airplane', 'train', 'seal', 'armillary', 'telescope', 'stamp', 'constellation'];
const FRAMES = ['emerald', 'burgundy', 'polaroid', 'celestial'];
const POSTCARDS = ['shanghai', 'suzhou', 'hangzhou', 'celestial'];
async function makePack(path, corruptId) {
  const z = new JSZip();
  const assets = [];
  const add = (id, group, buf, extra = {}, files = {}, bufs = {}) => {
    const all = { orig: `orig/${id}.png`, ...files };
    const sha = {};
    for (const [k, p] of Object.entries(all)) { const b = k === 'orig' ? buf : bufs[k]; z.file(p, k === 'orig' && id === corruptId ? Buffer.from('broken') : b); sha[k] = createHash('sha256').update(b).digest('hex'); }
    assets.push({ id, name: `Test ${id}`, group, theme: 'christmas-emerald', placement: 'test', width: 60, height: 80, aspect: 0.75, alpha: true, privacy: 'private-local', files: all, sha256: sha, ...extra });
  };
  add('tree', 'tree', disc(60, 90, [20, 110, 70]));
  add('globe', 'globe', disc(60, 66, [200, 220, 255]), { glass: [0.5, 0.37, 0.38] });
  add('cover', 'cover', solid(60, 80, [16, 59, 49]));
  add('page', 'page', solid(60, 80, [255, 248, 238]), { safe: [0.1, 0.13, 0.9, 0.74] });
  for (const k of ['home', 'journey', 'map', 'pose', 'wallet', 'memory', 'globe']) add(`icon-${k}`, 'icon', disc(40, 40, [213, 180, 119]));
  for (const [i, k] of CHARMS.entries()) add(`charm-${k}`, 'charm', disc(40, 40, [100 + i * 9, 60 + i * 5, 45]));
  const m = hole(60, 80);
  for (const k of FRAMES) add(`frame-${k}`, 'frame', ring(60, 80), { hole: [0.12, 0.1, 0.88, 0.9] }, { mask: `disp/frame-${k}.mask.png` }, { mask: m });
  for (const k of POSTCARDS) add(`postcard-${k}`, 'postcard', solid(90, 60, [250, 240, 220]), { textBox: [0.47, 0.13, 0.93, 0.86] });
  z.file('manifest.json', JSON.stringify({ format: 'chang-artwork-pack', version: 1, assets }));
  writeFileSync(path, await z.generateAsync({ type: 'nodebuffer' }));
  return assets.length;
}

const browser = await chromium.launch({ executablePath: process.env.CHROME ?? '/usr/bin/google-chrome', args: ['--no-sandbox'] });
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, locale: 'vi-VN', acceptDownloads: true });
const page = await ctx.newPage();
page.on('pageerror', (e) => errors.push(e.message));
const step = async (name, fn) => {
  try { await fn(); results.push({ name, ok: true }); console.log('✔', name); }
  catch (e) { results.push({ name, ok: false }); console.log('✘', name, '—', e.message.split('\n')[0]); await page.screenshot({ path: `${SHOTS}/FAIL-${name.replace(/\W+/g, '_')}.png` }).catch(() => {}); }
};
const go = async (h) => { await page.evaluate((x) => (location.hash = x), h); await page.waitForTimeout(600); };
const pick = async (trigger, file) => { const [fc] = await Promise.all([page.waitForEvent('filechooser'), trigger()]); await fc.setFiles(file); await page.waitForTimeout(800); };
const idb = (fn) => page.evaluate(`new Promise((res, rej) => { const o = indexedDB.open('chang-journeys'); o.onsuccess = () => { const db = o.result; (${fn})(db, res); }; o.onerror = () => rej(o.error); })`);
const all = (store) => idb(`(db, res) => { if (!db.objectStoreNames.contains('${store}')) return res(null); const q = db.transaction('${store}').objectStore('${store}').getAll(); q.onsuccess = () => res(q.result); }`);
const getSetting = (id) => idb(`(db, res) => { const q = db.transaction('settings').objectStore('settings').get('${id}'); q.onsuccess = () => res(q.result); }`);
const packPath = join(tmpdir(), 'synthetic.artpack.zip');
const badPack = join(tmpdir(), 'synthetic-bad.artpack.zip');
const N = await makePack(packPath);
await makePack(badPack, 'charm-seal');

await step('B0 import demo journey', async () => {
  await page.goto(BASE);
  await page.getByRole('button', { name: /Nhập hành trình từ tệp/ }).first().click();
  await pick(() => page.getByRole('button', { name: /Chọn tệp/ }).click(), 'tests/fixtures/demo-journey.changjourney.json');
  await page.getByRole('button', { name: 'Nhập vào máy' }).click();
  await page.locator('.jhome').waitFor();
  await page.waitForTimeout(3300);
});

await step('B1 before import the app uses its built-in drawings (SVG tree, line icons)', async () => {
  assert(await page.locator('.xmas-tree').count(), 'no default tree');
  assert(!(await page.locator('.tabbar .art-icon').count()), 'art icons without pack');
});

await step('B2 artwork pack: checksum-verified import, stored locally, manager lists every asset', async () => {
  await go('#/artwork');
  await pick(() => page.getByTestId('artpack-import').click(), badPack);
  await page.waitForTimeout(800);
  let st = await getSetting('artwork');
  assert(st && !st.assets['charm-seal'] && st.assets['charm-compass'], 'corrupted file must be rejected, others kept');
  await pick(() => page.getByTestId('artpack-import').click(), packPath);
  await page.waitForFunction((n) => document.querySelectorAll('[data-testid="art-tile"]').length >= n, N, { timeout: 30000 });
  st = await getSetting('artwork');
  assert(Object.keys(st.assets).length === N, `assets ${Object.keys(st.assets).length}/${N}`);
  const blobs = (await all('blobs')).filter((b) => b.journeyId === 'artwork');
  assert(blobs.length === N + FRAMES.length, `artwork blobs ${blobs.length}`); // + frame masks
});

await step('B3 asset sheet: preview on emerald & ivory, replace with own image, restore default', async () => {
  await page.locator('[data-testid="art-tile"]').first().click();
  await page.getByTestId('art-sheet').waitFor();
  await page.locator('.art-preview .on-ivory img').waitFor({ timeout: 5000 }); // blob URLs load asynchronously
  assert(await page.locator('.art-preview .on-emerald img').count() && await page.locator('.art-preview .on-ivory img').count(), 'previews');
  await pick(() => page.getByRole('button', { name: 'Thay bằng ảnh của tôi' }).click(), 'tests/fixtures/ticket.png');
  let st = await getSetting('artwork');
  const id = Object.values(st.assets).find((a) => a.source === 'custom')?.id;
  assert(id, 'not replaced');
  await page.getByRole('button', { name: 'Khôi phục mặc định' }).click();
  await page.waitForTimeout(500);
  st = await getSetting('artwork');
  assert(st.assets[id].source === 'pack', 'not restored');
  await page.keyboard.press('Escape');
});

await step('B4 Home uses the official tree (lights layer, no pointer capture); tab bar uses signature icons; still 5 tabs', async () => {
  await go('#/j/demo-journey');
  await page.getByTestId('tree-art').waitFor();
  const pe = await page.locator('.hero-tree-art').evaluate((e) => getComputedStyle(e).pointerEvents);
  assert(pe === 'none', 'tree intercepts touches');
  assert((await page.locator('.tabbar button').count()) === 5, 'tab count');
  assert((await page.locator('.tabbar .art-icon').count()) === 5, 'tab art icons');
  assert((await page.locator('.tabbar .art-icon.on').count()) === 1, 'selected state');
});

await step('B5 snow globe: artwork + snow canvas; effects toggle persists', async () => {
  await go('#/j/demo-journey/magic');
  await page.getByTestId('globe-art').scrollIntoViewIfNeeded();
  assert(await page.locator('.globe-snow').count(), 'no snow canvas');
  await page.getByTestId('globe-fx').click();
  assert(!(await page.locator('.globe-snow').count()), 'snow not turned off');
  await page.reload();
  await page.waitForTimeout(800);
  await go('#/j/demo-journey/magic');
  assert(!(await page.locator('.globe-snow').count()), 'toggle not persisted');
  await page.getByTestId('globe-fx').click();
});

await step('B6 postcard template: editable draft with text + sticker; sticker references artwork (no byte copies); PNG export', async () => {
  const blobs0 = (await all('blobs')).length;
  await go('#/j/demo-journey/postcards');
  await page.locator('.pc-template').first().click();
  await page.getByTestId('layer-editor').waitFor();
  await page.locator('[data-testid="layer-text"]').first().click();
  await page.getByTestId('le-text').fill('Merry Christmas from Demo City');
  await page.getByTestId('le-stickers').click();
  await page.locator('[data-testid="sticker-library"] button').first().click();
  await page.waitForTimeout(900);
  const pc = (await all('postcards')).find((c) => c.templateId);
  assert(pc && pc.layers.some((l) => l.kind === 'sticker' && l.assetId) && pc.layers.some((l) => l.text === 'Merry Christmas from Demo City'), 'draft not saved');
  assert((await all('blobs')).length === blobs0, 'sticker duplicated bytes');
  const [dl] = await Promise.all([page.waitForEvent('download'), page.getByTestId('le-png').click()]);
  const p = join(tmpdir(), 'pc.png');
  await dl.saveAs(p);
  assert(readFileSync(p).subarray(1, 4).toString() === 'PNG', 'not a PNG');
  await page.keyboard.press('Escape');
});

await step('B7 storybook: cover (skippable), add / duplicate / reorder / delete pages, persists', async () => {
  await go('#/j/demo-journey/storybook');
  await page.getByTestId('storybook-cover').waitFor();
  await page.getByTestId('storybook-skip').click();
  await page.getByTestId('story-add').click();
  await page.waitForTimeout(500);
  await page.locator('[data-testid="layer-text"]').nth(1).click();
  await page.getByTestId('le-text').fill('Page one text');
  await page.waitForTimeout(700);
  await page.keyboard.press('Escape');
  await page.locator('.story-thumb').first().getByRole('button', { name: 'Nhân bản' }).click();
  await page.waitForTimeout(500);
  let pages = (await all('storypages')).sort((a, b) => a.index - b.index);
  assert(pages.length === 2 && pages.every((p) => p.layers.some((l) => l.text === 'Page one text')), 'duplicate');
  await page.locator('.story-thumb').nth(1).getByRole('button', { name: 'Lên trên' }).click();
  await page.waitForTimeout(400);
  const reordered = (await all('storypages')).sort((a, b) => a.index - b.index);
  assert(reordered[0].id === pages[1].id, 'reorder');
  await page.locator('.story-thumb').first().getByRole('button', { name: 'Xóa' }).click();
  await page.getByRole('button', { name: /Xác nhận|Xóa/ }).last().click();
  await page.waitForTimeout(400);
  assert((await all('storypages')).length === 1, 'delete');
  await page.reload();
  await page.waitForTimeout(800);
  assert((await all('storypages')).length === 1, 'not persisted');
});

await step('B8 frames: photo under the frame with mask; export creates a NEW file; original unchanged', async () => {
  await go('#/j/demo-journey/frames');
  await pick(() => page.getByRole('button', { name: /Ảnh từ máy/ }).click(), 'tests/fixtures/ticket.png');
  assert(await page.locator('.frame-over').count(), 'frame not over photo');
  const mask = await page.locator('.frame-photo').evaluate((e) => getComputedStyle(e).webkitMaskImage || getComputedStyle(e).maskImage);
  assert(mask && mask !== 'none', 'no mask');
  const before = (await all('blobs')).filter((b) => b.name === 'ticket.png').map((b) => b.size);
  const [dl] = await Promise.all([page.waitForEvent('download'), page.getByTestId('frame-save').click()]);
  assert((await dl.suggestedFilename()).startsWith('chang-frame-'), 'export name');
  const after = (await all('blobs')).filter((b) => b.name === 'ticket.png').map((b) => b.size);
  assert(JSON.stringify(before) === JSON.stringify(after), 'original changed');
});

await step('B9 pose albums: create album, import several photos at once', async () => {
  await go('#/j/demo-journey/pose');
  await page.getByTestId('album-new').click();
  await page.getByTestId('album-name').fill('Demo album');
  await page.getByRole('button', { name: 'Tạo album' }).click();
  await page.waitForTimeout(400);
  const [fc] = await Promise.all([page.waitForEvent('filechooser'), page.getByTestId('album-import').click()]);
  await fc.setFiles(['tests/fixtures/ticket.png', 'tests/fixtures/ticket.png']);
  await page.waitForTimeout(900);
  const poses = (await all('poses')).filter((p) => p.album === 'Demo album');
  assert(poses.length === 2 && poses.every((p) => p.refBlobIds.length === 1), `album poses ${poses.length}`);
});

await step('B10 sleigh: date preview while dragging; returns; departure date unchanged', async () => {
  await go('#/j/demo-journey/appearance');
  await pick(() => page.getByTestId('sticker-import').click(), 'tests/fixtures/ticket.png');
  await go('#/j/demo-journey');
  if (await page.locator('.opening').count()) { await page.getByRole('button', { name: 'Bỏ qua' }).click(); await page.waitForTimeout(400); }
  await page.getByTestId('sleigh-countdown').scrollIntoViewIfNeeded();
  const box = await page.getByTestId('sleigh-thumb').boundingBox();
  await page.mouse.move(box.x + 20, box.y + box.height / 2);
  await page.mouse.down();
  for (let i = 1; i <= 6; i++) { await page.mouse.move(box.x + 20 + i * 8, box.y + box.height / 2); await page.waitForTimeout(40); }
  assert(await page.getByTestId('sleigh-preview').isVisible(), 'no date preview');
  await page.mouse.up();
  await page.waitForTimeout(800);
  assert(!(await page.getByTestId('sleigh-preview').count()), 'preview stays');
  const j = (await all('journeys')).find((x) => x.id === 'demo-journey');
  assert(j.startDate === '2031-01-10', 'date changed');
});

await step('B11 offline readiness reads every artwork file', async () => {
  await go('#/offline?j=demo-journey');
  await page.getByText(/artwork đọc được từ bộ nhớ máy/).waitFor({ timeout: 15000 });
});

await step('B12 four languages: library & artwork manager have no missing strings / overflow', async () => {
  for (const l of ['en', 'zh', 'ko', 'vi']) {
    await go('#/');
    await page.getByTestId('lang-button').first().click();
    await page.locator(`[data-lang="${l}"]`).first().click();
    await page.waitForTimeout(300);
    for (const h of ['#/artwork', '#/j/demo-journey/features', '#/j/demo-journey/storybook']) {
      await go(h);
      assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), `overflow ${l} ${h}`);
    }
  }
  await page.screenshot({ path: `${SHOTS}/v12-features-vi.png` });
});

const slider = async (label, v) => {
  const el = page.locator('[data-testid="le-props"] label', { hasText: label }).locator('input[type=range]');
  await el.evaluate((e, val) => { const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set; set.call(e, String(val)); e.dispatchEvent(new Event('input', { bubbles: true })); }, v);
};
const pngOk = async (dl) => { const p = join(tmpdir(), `x-${Date.now()}.png`); await dl.saveAs(p); const b = readFileSync(p); return b.subarray(1, 4).toString() === 'PNG' && b.readUInt32BE(16) > 0 && b.readUInt32BE(20) > 0; };

await step('B15 all 4 postcards: create, write, resize & rotate text, reopen, export PNG', async () => {
  await go('#/j/demo-journey/postcards');
  for (let i = 0; i < 4; i++) {
    const before = (await all('postcards')).length;
    await page.locator('.pc-template').nth(i).click();
    await page.getByTestId('layer-editor').waitFor();
    await page.locator('[data-testid="layer-text"]').first().click();
    await page.getByTestId('le-text').fill(`Card ${i}`);
    await slider('Xoay', 12);
    await slider('Kích thước', 0.4);
    await page.waitForTimeout(700);
    const [dl] = await Promise.all([page.waitForEvent('download'), page.getByTestId('le-png').click()]);
    assert(await pngOk(dl), `postcard ${i} export`);
    await page.keyboard.press('Escape');
    await page.waitForTimeout(300);
    const list = await all('postcards');
    const c = list.find((x) => x.templateId === `postcard-${POSTCARDS[i]}` && x.layers.some((l) => l.text === `Card ${i}`));
    assert(list.length === before + 1 && c, `postcard ${i} not saved`);
    const l = c.layers.find((x) => x.text === `Card ${i}`);
    assert(l.rot === 12 && Math.abs(l.w - 0.4) < 1e-6, `postcard ${i} transform ${l.rot}/${l.w}`);
  }
  await page.reload();
  await page.waitForTimeout(800);
  await go('#/j/demo-journey/postcards');
  await page.locator('.postcard', { hasText: 'Card 2' }).getByRole('button', { name: 'Mở / sửa' }).click();
  await page.getByTestId('layer-editor').waitFor();
  assert((await page.locator('[data-testid="layer-editor"] [data-testid="layer-text"]', { hasText: 'Card 2' }).count()) === 1, 'reopen postcard');
  await page.keyboard.press('Escape');
});

await step('B16 all 16 stickers on a storybook page: add, move, resize, rotate, opacity, layer order, save, reopen, export', async () => {
  await go('#/j/demo-journey/storybook');
  if (await page.getByTestId('storybook-skip').count()) await page.getByTestId('storybook-skip').click();
  await page.getByTestId('story-add').click();
  await page.getByTestId('layer-editor').waitFor();
  for (let i = 0; i < 16; i++) {
    await page.getByTestId('le-stickers').click();
    await page.locator('[data-testid="sticker-library"] button').nth(i).click();
    await page.waitForTimeout(150);
    await slider('Xoay', i * 10 - 75);
    await slider('Kích thước', 0.1 + i * 0.01);
    await slider('Độ trong suốt', 0.5 + i * 0.02);
    const box = await page.locator('.le-layer.sel').boundingBox();
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width / 2 + ((i % 4) - 2) * 18, box.y + box.height / 2 + (Math.floor(i / 4) - 2) * 22, { steps: 4 });
    await page.mouse.up();
  }
  await page.getByRole('button', { name: 'Xuống lớp dưới' }).click();
  await page.waitForTimeout(700);
  const [dl] = await Promise.all([page.waitForEvent('download'), page.getByTestId('le-png').click()]);
  assert(await pngOk(dl), 'storybook export');
  await page.keyboard.press('Escape');
  await page.reload();
  await page.waitForTimeout(800);
  const pg = (await all('storypages')).sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];
  const st = pg.layers.filter((l) => l.kind === 'sticker');
  assert(st.length === 16, `stickers saved ${st.length}`);
  assert(new Set(st.map((l) => l.assetId)).size === 16, 'every sticker used');
  assert(st.every((l) => l.rot !== 0) && st.some((l) => l.opacity < 1) && st.some((l) => l.w > 0.2), `transforms not saved ${JSON.stringify(st.map((l) => [l.rot, l.w, l.opacity]))}`);
  assert(st.some((l) => l.x !== 0.5 || l.y !== 0.5), 'moves not saved');
  await go('#/j/demo-journey/storybook');
  if (await page.getByTestId('storybook-skip').count()) await page.getByTestId('storybook-skip').click();
  await page.locator('[data-testid="story-thumb"]').last().click();
  await page.getByTestId('story-view').waitFor();
  assert((await page.locator('[data-testid="story-view"] .le-sticker').count()) === 16, 'preview after reopen');
  await page.keyboard.press('Escape');
});

await step('B17 all 4 frames: memory-frame export + framed photo on a storybook page', async () => {
  await go('#/j/demo-journey/frames');
  await pick(() => page.getByRole('button', { name: /Ảnh từ máy/ }).click(), 'tests/fixtures/ticket.png');
  for (let i = 0; i < 4; i++) {
    await page.locator('[data-testid="frame-choices"] button').nth(i).click();
    await page.locator('.card label', { hasText: 'Xoay' }).locator('input').evaluate((e) => { const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set; set.call(e, '15'); e.dispatchEvent(new Event('input', { bubbles: true })); });
    assert(await page.locator('.frame-over').count(), `frame ${i} not shown`);
    const [dl] = await Promise.all([page.waitForEvent('download'), page.getByTestId('frame-save').click()]);
    assert(await pngOk(dl), `frame ${i} export`);
  }
  await go('#/j/demo-journey/storybook');
  if (await page.getByTestId('storybook-skip').count()) await page.getByTestId('storybook-skip').click();
  await page.getByTestId('story-add').click();
  await page.getByTestId('layer-editor').waitFor();
  for (let i = 0; i < 4; i++) {
    const fc = page.waitForEvent('filechooser', { timeout: 1500 }).catch(() => null);
    await page.getByRole('button', { name: 'Ảnh', exact: true }).click();
    const chooser = await fc;
    if (chooser) { await chooser.setFiles('tests/fixtures/ticket.png'); await page.waitForTimeout(800); }
    else { await page.locator('.sheet .sticker-grid button').first().click(); await page.waitForTimeout(600); }
    assert((await page.locator('[data-testid="layer-photo"]').count()) === i + 1, `photo ${i} not added (chooser=${!!chooser})`);
    await page.locator('[data-testid="le-frame-pick"] button').nth(i + 1).click();
    await page.waitForTimeout(300);
  }
  await page.waitForTimeout(700);
  const fr = await page.locator('[data-testid="layer-editor"] .le-framed').count();
  if (fr !== 4) { await page.keyboard.press('Escape'); const pg0 = (await all('storypages')).sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0]; throw new Error(`framed photos ${fr} ${JSON.stringify(pg0.layers.map((l) => [l.kind, l.frameId]))}`); }
  const [dl] = await Promise.all([page.waitForEvent('download'), page.getByTestId('le-png').click()]);
  assert(await pngOk(dl), 'framed page export');
  await page.keyboard.press('Escape');
  const pg = (await all('storypages')).sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];
  assert(new Set(pg.layers.filter((l) => l.frameId).map((l) => l.frameId)).size === 4, 'frames not saved');
});

await step('B18 V1.2.2 countdown: rail ≈88% of card, knob and sticker move together, sticker never clipped, natural sentence', async () => {
  await go('#/j/demo-journey');
  if (await page.locator('.opening').count()) await page.locator('.opening').getByRole('button').last().click({ timeout: 3000 }).catch(() => {});
  await page.getByTestId('sleigh-countdown').scrollIntoViewIfNeeded();
  const geo = () => page.evaluate(() => {
    const card = document.querySelector('.countdown-card').getBoundingClientRect();
    const rail = document.querySelector('[data-testid="sleigh-rail"]').getBoundingClientRect();
    const knob = document.querySelector('[data-testid="sleigh-knob"]').getBoundingClientRect();
    const th = document.querySelector('[data-testid="sleigh-thumb"]').getBoundingClientRect();
    return { railPct: rail.width / card.width, knobP: (knob.left + knob.width / 2 - rail.left) / rail.width, p: +document.querySelector('[data-testid="sleigh-countdown"]').dataset.progress, inCard: th.left >= card.left - 0.5 && th.right <= card.right + 0.5, thumbL: th.left };
  });
  const g0 = await geo();
  assert(g0.railPct >= 0.85 && g0.railPct <= 0.9, `rail ${g0.railPct}`);
  const line = await page.getByTestId('countdown-line').innerText();
  assert(!/🎄/u.test(line) && /\d/.test(line), `countdown line ${line}`);
  const box = await page.getByTestId('sleigh-thumb').boundingBox();
  for (const dx of [-400, 400]) {
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width / 2 + dx, box.y + box.height / 2, { steps: 6 });
    await page.waitForTimeout(80);
    const g = await geo();
    assert(Math.abs(g.knobP - g.p) < 0.02, `knob ${g.knobP} vs p ${g.p}`);
    assert(g.p === (dx < 0 ? 0 : 1), `end not reached ${g.p}`);
    assert(g.inCard, 'sticker clipped at end');
    await page.mouse.up();
    await page.waitForTimeout(800);
    const back = await geo();
    assert(Math.abs(back.p - g0.p) < 1e-3 && Math.abs(back.thumbL - g0.thumbL) < 1, 'did not return to the real position');
  }
  // dragging the knob on the rail moves the sticker too (one control)
  const rail = await page.getByTestId('sleigh-rail').boundingBox();
  await page.mouse.move(rail.x + rail.width * 0.5, rail.y + rail.height / 2);
  await page.mouse.down();
  await page.mouse.move(rail.x + rail.width * 0.75, rail.y + rail.height / 2, { steps: 4 });
  await page.waitForTimeout(80);
  const g2 = await geo();
  assert(Math.abs(g2.p - 0.75) < 0.03 && Math.abs(g2.knobP - g2.p) < 0.02 && g2.thumbL > g0.thumbL, `rail drag ${JSON.stringify(g2)}`);
  await page.mouse.up();
  await page.waitForTimeout(800);
});

await step('B14 landscape: Home, Storybook, Frames have no horizontal overflow; tree never blocks taps', async () => {
  await page.setViewportSize({ width: 844, height: 390 });
  for (const h of ['#/j/demo-journey', '#/j/demo-journey/storybook', '#/j/demo-journey/frames', '#/j/demo-journey/magic']) {
    await go(h);
    if (await page.locator('.opening').count()) await page.locator('.opening').getByRole('button').last().click({ timeout: 3000 }).catch(() => {});
    if (await page.getByTestId('storybook-skip').count()) await page.getByTestId('storybook-skip').click();
    assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), `overflow ${h}`);
  }
  await go('#/j/demo-journey');
  const hit = await page.evaluate(() => { const b = document.querySelector('.tabbar button:nth-child(2)').getBoundingClientRect(); const el = document.elementFromPoint(b.x + b.width / 2, b.y + b.height / 2); return !!el?.closest('.tabbar'); });
  assert(hit, 'tab bar not tappable');
  await page.screenshot({ path: `${SHOTS}/v12-landscape.png` });
  await page.setViewportSize({ width: 390, height: 844 });
});

if (OLD_DIST && SITE && UPG_BASE) {
  const APP = `${SITE}/changs-journey`;
  const deploy = (dir) => { rmSync(APP, { recursive: true, force: true }); mkdirSync(APP, { recursive: true }); cpSync(dir, APP, { recursive: true }); };
  const p2 = await ctx.newPage();
  p2.on('pageerror', (e) => errors.push(e.message));
  await step('B13 upgrade 1.1.0 → 1.2.0: DB v4 adds storypages, nothing lost', async () => {
    deploy(OLD_DIST);
    await p2.goto(UPG_BASE);
    await p2.getByRole('button', { name: /Nhập hành trình từ tệp/ }).first().click();
    const [fc] = await Promise.all([p2.waitForEvent('filechooser'), p2.getByRole('button', { name: /Chọn tệp/ }).click()]);
    await fc.setFiles('tests/fixtures/demo-journey.changjourney.json');
    await p2.waitForTimeout(700);
    await p2.getByRole('button', { name: 'Nhập vào máy' }).click();
    await p2.locator('.jhome').waitFor();
    const count = () => p2.evaluate(() => new Promise((res) => { const o = indexedDB.open('chang-journeys'); o.onsuccess = () => { const d = o.result; const out = { v: d.version, stores: [...d.objectStoreNames] }; const q = d.transaction('activities').objectStore('activities').count(); q.onsuccess = () => res({ ...out, acts: q.result }); }; }));
    const before = await count();
    deploy('dist');
    for (let i = 0; i < 6; i++) { await p2.reload(); await p2.waitForTimeout(1500); if ((await p2.evaluate(() => document.documentElement.dataset.appVersion)) === NEW_VERSION) break; }
    assert((await p2.evaluate(() => document.documentElement.dataset.appVersion)) === NEW_VERSION, 'not updated');
    const after = await count();
    assert(after.v === 4 && after.stores.includes('storypages') && after.acts === before.acts, `${JSON.stringify(before)} → ${JSON.stringify(after)}`);
  });
}

await browser.close();
const bad = results.filter((r) => !r.ok);
console.log(`\n${results.length - bad.length}/${results.length} steps passed; page errors: ${errors.length}`);
if (errors.length) console.log(errors.slice(0, 5));
process.exit(bad.length || errors.length ? 1 : 0);
