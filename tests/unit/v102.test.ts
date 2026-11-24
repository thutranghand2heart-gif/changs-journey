// V1.0.2 — user-content translation (synthetic data only; the MyMemory service is mocked).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildTxMap, CATEGORY_DEFAULTS, collectItems, detectLang, displayText, hashText, missingPairs, txId } from '../../src/lib/contentI18n';
import { chunkText, runJob, translateText, type Fetcher } from '../../src/lib/translate';
import type { ContentTranslation } from '../../src/db/schema';
import { buildDemoBundle } from '../fixtures/demoJourney';

// Fictional addresses come from the shared fixture (the privacy guard rejects street addresses typed into source).
const FX = buildDemoBundle();
const ADDR_ZH = FX.journey.hotel!.addressZh!;
const ADDR_EN = FX.journey.hotel!.addressEn!;

const J = 'j-demo';
const data = () => ({
  journeys: [{ id: J, title: 'Chuyến đi mùa đông', transportNotes: ['Mang hộ chiếu'] }],
  days: [{ id: 'd1', journeyId: J, index: 1, title: 'Ngày đầu tiên', notes: '' }],
  activities: [{ id: 'a1', journeyId: J, title: 'Đi dạo bờ sông', descriptionVi: 'Ngắm đèn buổi tối', notes: '12:30' }],
  memories: [
    { id: 'm1', journeyId: J, title: 'Bí mật', body: 'Nội dung riêng tư', privacy: 'private', encrypted: true },
    { id: 'm2', journeyId: J, title: 'Một ngày vui', body: 'Trời đẹp', privacy: 'normal' },
  ],
  docs: [{ id: 'w1', journeyId: J, title: 'Vé tàu', details: 'Mã đặt chỗ ABC123', bookingRef: 'ABC123' }],
  places: [{ id: 'p1', journeyId: J, name: 'Công viên', nameZh: '公园', addressZh: ADDR_ZH, addressEn: ADDR_EN }],
});

test('detectLang recognises the four languages', () => {
  assert.equal(detectLang('Đi dạo bờ sông'), 'vi');
  assert.equal(detectLang('外滩夜景'), 'zh');
  assert.equal(detectLang('한강 산책'), 'ko');
  assert.equal(detectLang('Walk by the river'), 'en');
});

test('hash is stable and changes with the text', () => {
  assert.equal(hashText('abc'), hashText('abc'));
  assert.notEqual(hashText('abc'), hashText('abd'));
});

test('chunkText keeps every chunk ≤ 450 UTF-8 bytes and loses nothing', () => {
  const long = 'Đây là một câu tiếng Việt khá dài có dấu. '.repeat(40);
  const chunks = chunkText(long);
  assert.ok(chunks.length > 1);
  for (const c of chunks) assert.ok(new TextEncoder().encode(c).length <= 450, `chunk ${new TextEncoder().encode(c).length} bytes`);
  assert.equal(chunks.join(' ').replace(/\s+/g, ' ').trim(), long.replace(/\s+/g, ' ').trim());
});

test('collectItems never includes private/encrypted memories, booking details, addresses or Chinese names', () => {
  const items = collectItems(data(), { ...CATEGORY_DEFAULTS, memories: true });
  const texts = items.map((i) => i.text);
  assert.ok(texts.includes('Đi dạo bờ sông'));
  assert.ok(texts.includes('Một ngày vui'));
  assert.ok(texts.includes('Mang hộ chiếu'));
  for (const bad of ['Bí mật', 'Nội dung riêng tư', 'Mã đặt chỗ ABC123', 'ABC123', '公园', ADDR_ZH, ADDR_EN]) assert.ok(!texts.includes(bad), bad);
  assert.ok(!texts.includes('12:30'), 'texts without letters are skipped');
});

test('memories are off by default (category opt-in)', () => {
  const items = collectItems(data(), CATEGORY_DEFAULTS);
  assert.ok(!items.some((i) => i.store === 'memories'));
});

const tr = (over: Partial<ContentTranslation>): ContentTranslation => ({
  id: txId('activities', 'a1', 'title', 'en'), journeyId: J, store: 'activities', recordId: 'a1', field: 'title', lang: 'en', text: 'River walk',
  srcHash: hashText('Đi dạo bờ sông'), srcLang: 'vi', source: 'machine', provider: 'mymemory', at: '2030-01-01T00:00:00Z', ...over,
});

test('displayText: saved translation is used; edited original falls back to the original (stale), never a wrong translation', () => {
  const map = buildTxMap([tr({})]);
  const a = data().activities[0];
  assert.deepEqual(displayText(map, 'activities', a, 'title', 'en'), { text: 'River walk', translated: true, stale: false });
  assert.equal(displayText(map, 'activities', a, 'title', 'vi').text, 'Đi dạo bờ sông');
  assert.equal(displayText(map, 'activities', a, 'title', 'ko').text, 'Đi dạo bờ sông', 'no translation → original');
  const edited = { ...a, title: 'Đi dạo bờ sông lúc tối' };
  assert.deepEqual(displayText(map, 'activities', edited, 'title', 'en'), { text: 'Đi dạo bờ sông lúc tối', translated: false, stale: true });
});

test('missingPairs skips the source language, fresh translations and manual edits', () => {
  const items = collectItems(data(), CATEGORY_DEFAULTS).filter((i) => i.recordId === 'a1' && i.field === 'title');
  const manualOld = tr({ id: txId('activities', 'a1', 'title', 'zh'), lang: 'zh', text: '河边散步', source: 'manual', srcHash: 'old' });
  const pairs = missingPairs(items, buildTxMap([tr({}), manualOld]));
  assert.deepEqual(pairs.map((p) => p.lang), ['ko']);
});

const mock = (reply: (q: string, pair: string) => { status?: number; body: any }) => {
  const calls: string[] = [];
  const f: Fetcher = async (url) => {
    calls.push(url);
    const u = new URL(url);
    const r = reply(u.searchParams.get('q')!, u.searchParams.get('langpair')!);
    return { ok: (r.status ?? 200) < 400, status: r.status ?? 200, json: async () => r.body };
  };
  return { f, calls };
};

test('translateText calls MyMemory with the right pair and decodes entities', async () => {
  const { f, calls } = mock(() => ({ body: { responseStatus: 200, responseData: { translatedText: 'It&#39;s a walk' } } }));
  assert.equal(await translateText('Đi dạo', 'vi', 'zh', 'me@example.com', f), "It's a walk");
  assert.match(calls[0], /langpair=vi(%7C|\|)zh-CN/);
  assert.match(calls[0], /de=me%40example.com/);
});

test('runJob saves each translation and stops cleanly on quota', async () => {
  const items = collectItems(data(), CATEGORY_DEFAULTS);
  const pairs = missingPairs(items, new Map());
  let n = 0;
  const { f } = mock(() => (++n > 3 ? { status: 429, body: {} } : { body: { responseStatus: 200, responseData: { translatedText: `T${n}` } } }));
  const saved: ContentTranslation[] = [];
  const r = await runJob(pairs, { save: async (t) => void saved.push(t), fetcher: f });
  assert.equal(r.stoppedBy, 'quota');
  assert.equal(r.done, 3);
  assert.equal(saved.length, 3);
  assert.ok(saved.every((s) => s.source === 'machine' && s.srcHash && s.id === txId(s.store, s.recordId, s.field, s.lang)));
});

test('runJob treats a "MYMEMORY WARNING" reply as quota, not as a translation', async () => {
  const items = collectItems(data(), CATEGORY_DEFAULTS).slice(0, 1);
  const { f } = mock(() => ({ body: { responseStatus: 200, responseData: { translatedText: 'MYMEMORY WARNING: YOU USED ALL AVAILABLE FREE TRANSLATIONS FOR TODAY' } } }));
  const saved: ContentTranslation[] = [];
  const r = await runJob(missingPairs(items, new Map()), { save: async (t) => void saved.push(t), fetcher: f });
  assert.equal(r.stoppedBy, 'quota');
  assert.equal(saved.length, 0);
});
