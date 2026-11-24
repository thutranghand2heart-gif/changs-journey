// Public unit tests. They use a FICTIONAL demo journey only.
// Checks against the real private itinerary run locally from the private folder, never in this repo.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildDemoBundle } from '../fixtures/demoJourney';
import { summarize, paidOf, remainingOf, payState } from '../../src/lib/budget';
import { search } from '../../src/lib/search';
import { smartToday } from '../../src/lib/today';
import { packBackup, parseBackup, remapAsNew, sliceJourney, BackupError } from '../../src/lib/backup';
import { deriveKey, encryptJson, decryptJson, randomBytes, sealBackup, openSealed } from '../../src/lib/crypto';
import { makeJourneyFile, parseJourneyFile, ImportError } from '../../src/lib/journeyFile';
import { fold } from '../../src/lib/util';
import type { Expense, Memory } from '../../src/db/schema';

const demo = buildDemoBundle();

test('import file: round trip preserves every record exactly', async () => {
  const file = await makeJourneyFile(demo, '2030-01-01T00:00:00Z');
  const back = await parseJourneyFile(JSON.stringify(file, null, 2));
  assert.deepEqual(back, demo);
});

test('import file: rejects wrong format, tampering, broken references, duplicates', async () => {
  const file = await makeJourneyFile(demo, '2030-01-01T00:00:00Z');
  await assert.rejects(parseJourneyFile('not json'), ImportError);
  await assert.rejects(parseJourneyFile(JSON.stringify({ ...file, format: 'other' })), /không phải tệp hành trình/);
  await assert.rejects(parseJourneyFile(JSON.stringify({ ...file, version: 99 })), /phiên bản/);
  const tampered = structuredClone(file);
  tampered.activities[1].start = '09:99';
  await assert.rejects(parseJourneyFile(JSON.stringify(tampered)), /mã kiểm tra/);
  // a re-signed file with a dangling day reference is still rejected
  const broken = structuredClone(demo);
  broken.activities[0].dayId = 'missing';
  await assert.rejects(parseJourneyFile(JSON.stringify(await makeJourneyFile(broken, 'x'))), /ngày không tồn tại/);
  const dup = structuredClone(demo);
  dup.places.push({ ...dup.places[0] });
  await assert.rejects(parseJourneyFile(JSON.stringify(await makeJourneyFile(dup, 'x'))), /trùng/);
  const foreign = structuredClone(demo);
  foreign.days[0].journeyId = 'someone-else';
  await assert.rejects(parseJourneyFile(JSON.stringify(await makeJourneyFile(foreign, 'x'))), /không thuộc/);
  // BOM from the Files app is tolerated
  assert.ok(await parseJourneyFile('﻿' + JSON.stringify(file)));
});

test('import as copy: fresh ids, references rewritten, original untouched', () => {
  const copy = remapAsNew({ stores: { journeys: [demo.journey], days: demo.days, activities: demo.activities, places: demo.places }, blobs: new Map() }, ' (bản sao)');
  const nj = copy.stores.journeys![0];
  assert.notEqual(nj.id, demo.journey.id);
  assert.equal(nj.title, 'Winter Lights Demo (bản sao)');
  const dayIds = new Set(copy.stores.days!.map((d: any) => d.id));
  assert.ok(copy.stores.activities!.every((a: any) => dayIds.has(a.dayId) && a.journeyId === nj.id));
  assert.equal(demo.journey.id, 'demo-journey');
});

test('budget: estimates are not spent; a deposit is part of the price, never added on top', () => {
  const e = demo.expenses[0];
  assert.equal(summarize(demo.expenses, 'JPY').paid, 0);
  const withDeposit: Expense = { ...e, payments: [{ id: 'p1', amount: 3000, kind: 'deposit', date: 'x' }] };
  assert.equal(paidOf(withDeposit), 3000);
  assert.equal(remainingOf(withDeposit), 7000);
  assert.equal(payState(withDeposit), 'deposit-paid');
  const s = summarize([withDeposit, withDeposit], 'JPY'); // same record shown in two views
  assert.equal(s.paid, 3000);
  assert.equal(s.plannedLow, 10000);
  const full = { ...withDeposit, payments: [...withDeposit.payments, { id: 'p2', amount: 7000, kind: 'payment' as const, date: 'x' }] };
  assert.equal(payState(full), 'paid');
});

test('search: Chinese, toneless pinyin, aliases; one place per alias', () => {
  const corpus = { days: demo.days, activities: demo.activities, places: demo.places, food: [], memories: [], docs: demo.docs };
  for (const q of ['演示河畔', 'yanshi hepan', 'riverside walk'])
    assert.equal(search(corpus, q).filter((h) => h.id === 'demo-pl-river').length, 1, q);
  assert.equal(fold('Đoạn Kiều'), 'doan kieu');
});

test('privacy: private/encrypted memories never appear in search', () => {
  const pub: Memory = { id: 'm1', journeyId: 'demo-journey', title: 'Lantern night', body: 'x', layout: 'classic', photoBlobIds: [], keepsake: false, privacy: 'normal', createdAt: '', updatedAt: '' };
  const priv: Memory = { ...pub, id: 'm2', title: '', body: '', privacy: 'private', encrypted: { iv: 'x', data: 'y' } };
  const privPlain: Memory = { ...pub, id: 'm3', title: 'Lantern private', privacy: 'private' };
  const hits = search({ days: [], activities: [], places: [], food: [], memories: [pub, priv, privPlain], docs: [] }, 'lantern');
  assert.deepEqual(hits.map((h) => h.id), ['m1']);
});

test('smart today: free day is silent; last day prioritises departure; uses journey time zone', () => {
  const { journey, days, activities, docs } = demo;
  const free = smartToday(journey, days, activities, docs, new Date('2031-01-11T01:00:00Z'));
  assert.equal(free.day?.index, 2);
  assert.equal(free.calm, true);
  assert.deepEqual([free.upcoming.length, free.reminders.length], [0, 0]);
  const last = smartToday(journey, days, activities, docs, new Date('2031-01-11T22:00:00Z')); // 07:00 Jan 12 Tokyo
  assert.ok(last.reminders.some((r) => r.priority && r.text.includes('DEMO 001')));
  assert.equal(smartToday(journey, days, activities, docs, new Date('2031-01-09T15:30:00Z')).phase, 'during'); // 00:30 Jan 10 Tokyo
  // day note reminder appears only from remindFrom
  assert.ok(smartToday(journey, days, activities, docs, new Date('2031-01-02T00:00:00Z')).reminders.some((r) => r.text.includes('demo booking')));
  assert.ok(!smartToday(journey, days, activities, docs, new Date('2030-12-20T00:00:00Z')).reminders.some((r) => r.text.includes('demo booking')));
});

test('crypto: AES-GCM round trip; wrong passphrase fails', async () => {
  const salt = randomBytes(16);
  const k = await deriveKey('correct horse', salt, 1000);
  const box = await encryptJson(k, { a: 'Đêm Giáng sinh 平安夜' });
  assert.deepEqual(await decryptJson(k, box), { a: 'Đêm Giáng sinh 平安夜' });
  await assert.rejects(decryptJson(await deriveKey('wrong', salt, 1000), box));
  const sealed = await sealBackup('pw123456', new Uint8Array([1, 2, 3]));
  assert.deepEqual(Array.from(await openSealed('pw123456', sealed)), [1, 2, 3]);
  await assert.rejects(openSealed('nope', sealed));
});

test('backup: round trip, encryption, tamper detection, restore-as-new', async () => {
  const data = {
    stores: { journeys: [demo.journey], days: demo.days, activities: demo.activities, places: demo.places, docs: [{ ...demo.docs[0], blobId: 'b1' }], blobs: [{ id: 'b1', journeyId: demo.journey.id, mime: 'image/png', name: 'qr.png', size: 4, createdAt: '' }] },
    blobs: new Map([['b1', new Uint8Array([9, 8, 7, 6])]]),
  };
  const { bytes } = await packBackup(data as any, '2030-01-01T00:00:00Z');
  const parsed = await parseBackup(bytes);
  assert.equal(parsed.integrityOk, true);
  assert.equal(parsed.manifest.journeys[0].counts.activities, demo.activities.length);
  const enc = await packBackup(data as any, 'x', 'secret-pass');
  await assert.rejects(parseBackup(enc.bytes), (e: any) => e instanceof BackupError && e.message === 'NEED_PASSPHRASE');
  assert.equal((await parseBackup(enc.bytes, 'secret-pass')).integrityOk, true);
  const JSZip = (await import('jszip')).default as any;
  const z = await JSZip.loadAsync(bytes);
  z.file('blobs/b1.bin', new Uint8Array([0, 0, 0, 0]));
  assert.equal((await parseBackup(await z.generateAsync({ type: 'uint8array' }))).integrityOk, false);
  const fresh = remapAsNew(sliceJourney(parsed.data, demo.journey.id));
  const nb = fresh.stores.blobs![0].id;
  assert.equal(fresh.stores.docs![0].blobId, nb);
  assert.ok(fresh.blobs.has(nb));
});
