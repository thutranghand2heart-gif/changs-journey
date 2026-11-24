// V1.3 — mixed-language user text keeps its Chinese names; language detection of mixed text.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { splitHan, translateKeepHan } from '../../src/lib/translate';
import { detectLang } from '../../src/lib/contentI18n';
import { FLIGHT, flightAt } from '../../src/features/extras/MagicalFlight';

const fake = (dict: Record<string, string>) => async (u: string) => {
  const q = decodeURIComponent(new URL(u).searchParams.get('q')!);
  return { ok: true, status: 200, json: async () => ({ responseStatus: 200, responseData: { translatedText: dict[q] ?? `<${q}>` } }) };
};

test('detectLang: mixed text takes the language of the words around the Chinese names', () => {
  assert.equal(detectLang('Tàu 北京站 → 天津站'), 'vi');
  assert.equal(detectLang('Train to 北京站'), 'en');
  assert.equal(detectLang('北京站'), 'zh');
  assert.equal(detectLang('东方航空 MU5052 航班'), 'zh'); // a code inside Chinese stays Chinese
  assert.equal(detectLang('기차 北京站'), 'ko');
});

test('splitHan keeps a run of Chinese names with arrows together', () => {
  assert.deepEqual(splitHan('Tàu 北京站 → 天津站'), [['Tàu ', false], ['北京站 → 天津站', true]]);
  assert.deepEqual(splitHan('Cài Amap (高德地图) và DiDi').map(([, h]) => h), [false, true, false]);
});

test('translateKeepHan translates only the words around Chinese names', async () => {
  const f = fake({ 'Tàu': '火车', 'Ghé studio': 'Visit the studio' });
  assert.equal(await translateKeepHan('Tàu 北京站 → 天津站', 'vi', 'zh', undefined, f as any), '火车 北京站 → 天津站');
  assert.equal(await translateKeepHan('Ghé studio 示例写真', 'vi', 'en', undefined, f as any), 'Visit the studio 示例写真');
  // whole-language text is sent as a whole
  const g = fake({ 'Xin chào': 'Hello' });
  assert.equal(await translateKeepHan('Xin chào', 'vi', 'en', undefined, g as any), 'Hello');
});

test('Magical Flight path covers the viewport, passes off-screen both ways, varies altitude and depth', () => {
  const xs = FLIGHT.map((p) => p[0]), ys = FLIGHT.map((p) => p[1]), zs = FLIGHT.map((p) => p[2]);
  assert.ok(Math.min(...xs) < -0.2 && Math.max(...xs) > 1.2, 'enters and exits off-screen');
  assert.ok(Math.max(...ys) - Math.min(...ys) > 0.5, 'altitude changes');
  assert.ok(Math.max(...zs) - Math.min(...zs) > 0.4, 'near/far');
  let turns = 0, prevDx = 0;
  for (let i = 1; i <= 400; i++) {
    const a = flightAt((i - 1) / 400, false), b = flightAt(i / 400, false);
    const dx = b[0] - a[0];
    if (Math.abs(dx) > 1e-4) { if (prevDx && Math.sign(dx) !== Math.sign(prevDx)) turns++; prevDx = dx; }
  }
  assert.ok(turns >= 4, `direction changes ${turns}`);
});
