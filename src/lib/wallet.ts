// Canonical Wallet model (schema v2): booking records + attachments linked by id.
// ONE SOURCE OF TRUTH, MULTIPLE VIEWS: a file is stored once and linked from any number of records.
import * as db from '../db/idb';
import type { Activity, Attachment, AttachmentKind, Day, FlightInfo, Journey, Place, WalletDoc } from '../db/schema';
import { saveFileAsBlob } from '../db/repo';
import { guessKind } from '../db/migrate';
import { nowIso, uid } from './util';
import { t } from './i18n';

export const attIds = (d: WalletDoc) => d.attachmentIds ?? [];
export const isBooking = (d: WalletDoc) => (d.recordType ?? (d.blobId ? 'document' : 'booking')) === 'booking';

/** Records that link to an attachment. */
export function referencesOf(attId: string, docs: WalletDoc[]): WalletDoc[] {
  return docs.filter((d) => attIds(d).includes(attId));
}
/** Attachments no record links to any more (shown as "unlinked files", never silently deleted). */
export function orphanAttachments(atts: Attachment[], docs: WalletDoc[]): Attachment[] {
  const used = new Set(docs.flatMap(attIds));
  return atts.filter((a) => !used.has(a.id));
}

export async function addAttachmentFromFile(file: File, journeyId: string, kind?: AttachmentKind): Promise<Attachment> {
  const blob = await saveFileAsBlob(file, file.name, journeyId);
  const a: Attachment = { id: uid('att'), journeyId, blobId: blob.id, kind: kind ?? guessKind(blob.mime, file.name), label: file.name.replace(/\.[^.]+$/, ''), fileName: file.name, mime: blob.mime, size: blob.size, createdAt: nowIso() };
  await db.put('attachments', a);
  return a;
}

/** Link (no copy). Idempotent. Never changes booking/payment status. */
export async function linkAttachments(docId: string, ids: string[]): Promise<void> {
  const d = await db.get<WalletDoc>('docs', docId);
  if (!d) throw new db.StorageError(t('Không tìm thấy hồ sơ.'));
  const next = Array.from(new Set([...attIds(d), ...ids]));
  await db.put('docs', { ...d, attachmentIds: next });
}
export async function unlinkAttachment(docId: string, attId: string): Promise<void> {
  const d = await db.get<WalletDoc>('docs', docId);
  if (!d) return;
  await db.put('docs', { ...d, attachmentIds: attIds(d).filter((x) => x !== attId) });
}

/** Permanently deletes a file: unlinks it everywhere, then removes the bytes. Caller must confirm. */
export async function deleteAttachmentEverywhere(att: Attachment, docs: WalletDoc[]): Promise<void> {
  const entries = referencesOf(att.id, docs).map((d) => ({ store: 'docs' as const, value: { ...d, attachmentIds: attIds(d).filter((x) => x !== att.id) } }));
  await db.putMany(entries);
  await db.del('attachments', att.id);
  await db.del('blobs', att.blobId);
}

/**
 * Deletes a record. Attachments still linked from another record are always kept.
 * Attachments only this record used are deleted only if `deleteOwnFiles` (explicit choice); otherwise they become "unlinked files".
 */
export async function deleteRecord(d: WalletDoc, docs: WalletDoc[], atts: Attachment[], deleteOwnFiles: boolean, acts: Activity[]): Promise<void> {
  const others = docs.filter((x) => x.id !== d.id);
  const own = attIds(d).filter((id) => !others.some((o) => attIds(o).includes(id)));
  for (const a of acts) if (a.documentIds.includes(d.id)) await db.put('activities', { ...a, documentIds: a.documentIds.filter((x) => x !== d.id) });
  await db.del('docs', d.id);
  if (deleteOwnFiles) for (const id of own) {
    const a = atts.find((x) => x.id === id);
    if (a) {
      await db.del('attachments', a.id);
      await db.del('blobs', a.blobId);
    }
  }
  if (d.blobId && !atts.some((a) => a.blobId === d.blobId) && deleteOwnFiles) await db.del('blobs', d.blobId);
}

/**
 * Repair for v1 standalone uploads: link the document's files into existing booking(s) without re-uploading.
 * If `removeStandalone`, the now-empty standalone document record is removed (its files stay, linked to the bookings).
 */
export async function linkStandaloneInto(src: WalletDoc, targetIds: string[], removeStandalone: boolean): Promise<void> {
  if (!targetIds.length) return;
  for (const t of targetIds) await linkAttachments(t, attIds(src));
  if (removeStandalone) await db.del('docs', src.id);
}

export function newRecord(journeyId: string, recordType: 'booking' | 'document', category: WalletDoc['category'], title: string): WalletDoc {
  return { id: uid('doc'), journeyId, title, category, bookingStatus: 'info-entered', paymentStatus: 'unknown', activityIds: [], details: '', privacy: 'normal', createdAt: nowIso(), recordType, attachmentIds: [] };
}

/** Canonical hotel for Home / travel card: the linked Wallet record if any, else the journey's supplied hotel. */
export function hotelOf(j: Journey, docs: WalletDoc[]): { name: string; nameZh?: string; addressZh?: string; addressEn?: string; phone?: string; docId?: string } | undefined {
  const d = j.hotelDocId ? docs.find((x) => x.id === j.hotelDocId && !x.encrypted) : undefined;
  if (d?.hotel?.name || d?.hotel?.addressZh) return { name: d.hotel.name ?? d.title, nameZh: d.hotel.nameZh, addressZh: d.hotel.addressZh, addressEn: d.hotel.addressEn, phone: d.hotel.phone, docId: d.id };
  if (j.hotel) return { name: j.hotel.name, nameZh: j.hotel.nameZh, addressZh: j.hotel.addressZh, addressEn: j.hotel.addressEn };
  return undefined;
}

export interface Suggestion { field: keyof FlightInfo; value: string; source: string }
/**
 * Suggestions taken ONLY from the user's own records (linked itinerary activities, the record's own title/notes).
 * Nothing is applied until the user confirms. No external OCR.
 */
export function flightSuggestions(d: WalletDoc, acts: Activity[], days: Day[], places: Place[]): Suggestion[] {
  const out: Suggestion[] = [];
  const f = d.flight ?? {};
  const add = (field: keyof FlightInfo, value: string | undefined, source: string) => {
    if (value && !f[field]) out.push({ field, value, source });
  };
  const text = `${d.title}\n${d.details}`;
  const num = text.match(/\b([A-Z]{2}|[A-Z]\d|\d[A-Z])\s?(\d{2,4})\b/);
  if (num) add('flightNumber', num[1] + num[2], 'title');
  const airline = text.match(/([A-Z][A-Za-z]+(?: [A-Z][A-Za-z]+)?)\s+(?:[A-Z]{2}|[A-Z]\d|\d[A-Z])\s?\d{2,4}\b/);
  if (airline && !/^(Flight|Chuyến|Cất|Hạ)/.test(airline[1])) add('airline', airline[1], 'title');
  const linked = acts.filter((a) => d.activityIds.includes(a.id) && a.kind === 'flight').sort((a, b) => a.order - b.order);
  const dep = linked[0];
  if (dep) {
    const day = days.find((x) => x.id === dep.dayId);
    const pl = places.find((p) => p.id === dep.placeId);
    add('depDate', day?.date, dep.title);
    add('depTime', dep.start, dep.title);
    add('depTz', dep.timeZone, dep.title);
    add('depAirport', pl?.name, dep.title);
    const term = (pl?.addressZh ?? '').match(/(\d)号航站楼/)?.[1] ?? dep.title.match(/\bT(\d)\b/)?.[1];
    add('depTerminal', term ? `T${term}` : undefined, dep.title);
    // next flight activity on the same day = arrival of this segment
    const arr = acts.filter((a) => a.dayId === dep.dayId && a.kind === 'flight' && a.order > dep.order).sort((a, b) => a.order - b.order)[0];
    if (arr) {
      const ap = places.find((p) => p.id === arr.placeId);
      add('arrDate', day?.date, arr.title);
      add('arrTime', arr.start, arr.title);
      add('arrTz', arr.timeZone, arr.title);
      add('arrAirport', ap?.name, arr.title);
      const at = arr.title.match(/\bT(\d)\b/)?.[1];
      add('arrTerminal', at ? `T${at}` : undefined, arr.title);
    }
  }
  return out;
}
