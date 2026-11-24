// V1.0.1 regression tests (synthetic data only).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { buildDemoBundle } from '../fixtures/demoJourney';
import { linkHotelV2, migrateDocV2 } from '../../src/db/migrate';
import { flightSuggestions, hotelOf, orphanAttachments, referencesOf } from '../../src/lib/wallet';
import { setLang, t } from '../../src/lib/i18n';
import type { Attachment, WalletDoc } from '../../src/db/schema';

const demo = buildDemoBundle();
const v1Doc = (over: Partial<WalletDoc> = {}): WalletDoc => ({
  id: 'd-up', journeyId: demo.journey.id, title: 'E-ticket', category: 'other', bookingStatus: 'info-entered', activityIds: [], details: '', privacy: 'normal',
  createdAt: '2030-01-01T00:00:00Z', blobId: 'blob-1', mime: 'application/pdf', fileName: 'e-ticket.pdf', size: 1234, lastOpenedOkAt: '2030-01-02T00:00:00Z', ...over,
});

test('migration v1→v2: uploaded file becomes an attachment of a standalone document — same bytes (blob id), nothing deleted', () => {
  const orig = v1Doc();
  const { doc, attachment } = migrateDocV2(orig);
  assert.ok(attachment);
  assert.equal(attachment.blobId, 'blob-1'); // no copy of the file
  assert.equal(attachment.id, 'att-d-up'); // deterministic → can never duplicate
  assert.equal(attachment.size, 1234);
  assert.equal(attachment.fileName, 'e-ticket.pdf');
  assert.equal(attachment.lastOpenedOkAt, orig.lastOpenedOkAt);
  assert.equal(doc.recordType, 'document');
  assert.deepEqual(doc.attachmentIds, ['att-d-up']);
  for (const k of Object.keys(orig) as (keyof WalletDoc)[]) assert.deepEqual(doc[k], orig[k], `field ${k} preserved`);
  // idempotent
  assert.equal(migrateDocV2(doc).doc, doc);
  assert.equal(migrateDocV2(doc).attachment, undefined);
  // booking record without file stays a booking, status untouched
  const b = migrateDocV2(v1Doc({ id: 'flight', blobId: undefined, category: 'flight', bookingStatus: 'payment-pending' }));
  assert.equal(b.doc.recordType, 'booking');
  assert.deepEqual(b.doc.attachmentIds, []);
  assert.equal(b.doc.bookingStatus, 'payment-pending');
});

test('migration v1→v2: journey hotel links to the matching Wallet hotel record using only the user\'s own values', () => {
  const hotelDoc = v1Doc({ id: 'h', category: 'hotel', title: 'Demo Hotel', blobId: undefined });
  const r = linkHotelV2(demo.journey, [hotelDoc]);
  assert.equal(r.journey?.hotelDocId, 'h');
  assert.deepEqual(r.doc?.hotel, { name: 'Demo Hotel', addressZh: demo.journey.hotel!.addressZh, addressEn: demo.journey.hotel!.addressEn });
  assert.deepEqual(linkHotelV2({ ...demo.journey, hotelDocId: 'h' }, [hotelDoc]), {}); // already linked
  assert.deepEqual(linkHotelV2(demo.journey, [{ ...hotelDoc, title: 'Other Hotel' }]), {}); // no guessing
  assert.equal(hotelOf({ ...demo.journey, hotelDocId: 'h' }, [{ ...hotelDoc, hotel: { name: 'Demo Hotel', addressZh: 'X', phone: '+00 1' } }])?.phone, '+00 1');
  assert.equal(hotelOf(demo.journey, [])?.name, 'Demo Hotel'); // falls back to journey info
});

test('one PDF linked to outbound AND return flights: one file, two references; unlinking never orphans while still used', () => {
  const att: Attachment = { id: 'a1', journeyId: 'demo-journey', blobId: 'b1', kind: 'eticket', label: 'eticket', fileName: 'e.pdf', mime: 'application/pdf', size: 10, createdAt: '' };
  const out = v1Doc({ id: 'out', blobId: undefined, category: 'flight', recordType: 'booking', attachmentIds: ['a1'] });
  const ret = v1Doc({ id: 'ret', blobId: undefined, category: 'flight', recordType: 'booking', attachmentIds: ['a1'] });
  assert.deepEqual(referencesOf('a1', [out, ret]).map((d) => d.id), ['out', 'ret']);
  assert.deepEqual(orphanAttachments([att], [out, ret]), []);
  const retUnlinked = { ...ret, attachmentIds: [] };
  assert.deepEqual(orphanAttachments([att], [out, retUnlinked]), []);
  assert.deepEqual(orphanAttachments([att], [{ ...out, attachmentIds: [] }, retUnlinked]).map((a) => a.id), ['a1']);
});

test('flight suggestions come only from the user\'s own records and never overwrite filled fields', () => {
  const flightAct = demo.activities.find((a) => a.title.includes('DEMO 001'))!;
  const d = v1Doc({ id: 'f', blobId: undefined, category: 'flight', title: 'Return — Demo Air DM123', activityIds: [flightAct.id] });
  const s = flightSuggestions(d, demo.activities, demo.days, demo.places);
  const get = (f: string) => s.find((x) => x.field === f)?.value;
  assert.equal(get('flightNumber'), 'DM123');
  assert.equal(get('airline'), 'Demo Air');
  assert.equal(get('depTime'), '12:00');
  assert.equal(get('depDate'), '2031-01-12');
  assert.equal(get('depAirport'), 'Demo Airport');
  assert.equal(get('depTz'), 'Asia/Tokyo');
  assert.equal(get('arrTime'), undefined); // no arrival activity exists → nothing invented
  const filled = flightSuggestions({ ...d, flight: { depTime: '11:11' } }, demo.activities, demo.days, demo.places);
  assert.equal(filled.find((x) => x.field === 'depTime'), undefined);
});

test('i18n: four languages, placeholders, fallback to the original (never invented)', () => {
  setLang('en');
  assert.equal(t('Lưu'), 'Save');
  assert.equal(t('Ngày {0}', 3), 'Day 3');
  setLang('zh');
  assert.equal(t('Ngày {0}', 3), '第3天');
  setLang('ko');
  assert.equal(t('Ngày {0}', 3), '3일차');
  assert.equal(t('Giờ Trung Quốc (UTC+8)'), '중국 시간 (UTC+8)');
  assert.equal(t('Some user text not in the dictionary'), 'Some user text not in the dictionary');
  setLang('vi');
  assert.equal(t('Lưu'), 'Lưu');
});

test('i18n: every interface string in the source has en/zh/ko translations with matching placeholders', () => {
  // throws (non-zero exit) if any key is missing or a {n} placeholder was lost
  const out = execFileSync('node', ['scripts/i18n-keys.mjs', '--missing'], { encoding: 'utf8' });
  assert.match(out, /en: (\d+)\/\1 translated, 0 missing/);
  assert.match(out, /zh: (\d+)\/\1 translated, 0 missing/);
  assert.match(out, /ko: (\d+)\/\1 translated, 0 missing/);
});
