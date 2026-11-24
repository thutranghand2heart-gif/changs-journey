// Schema v1 → v2 migration (app 1.0.0 → 1.0.1). Pure functions so they can be unit-tested.
// Rules: never delete, never copy file bytes, keep every original field.
import type { Attachment, AttachmentKind, Journey, WalletDoc } from './schema';

export function guessKind(mime: string | undefined, name: string | undefined): AttachmentKind {
  const n = (name ?? '').toLowerCase();
  if (/boarding/.test(n)) return 'boarding-pass';
  if (/e-?ticket|itinerary|vé|ticket/.test(n)) return 'eticket';
  if (/receipt|hóa đơn|biên lai/.test(n)) return 'receipt';
  if (/qr/.test(n)) return 'qr';
  if (/screenshot|ảnh chụp màn hình/.test(n)) return 'screenshot';
  if ((mime ?? '').includes('pdf')) return 'confirmation';
  if ((mime ?? '').startsWith('image/')) return 'photo';
  return 'other';
}

/**
 * v1 docs that carry a file (blobId) were created by "upload" → they become standalone *documents* whose file is
 * now an Attachment (same blob, no copy). v1 docs without a file were booking records → recordType 'booking'.
 */
export function migrateDocV2(doc: WalletDoc): { doc: WalletDoc; attachment?: Attachment } {
  if (doc.attachmentIds) return { doc }; // already v2
  if (!doc.blobId) return { doc: { ...doc, recordType: doc.recordType ?? 'booking', attachmentIds: [] } };
  const attachment: Attachment = {
    id: `att-${doc.id}`, // deterministic → re-running the migration can never create a duplicate
    journeyId: doc.journeyId,
    blobId: doc.blobId,
    kind: guessKind(doc.mime, doc.fileName),
    label: doc.fileName ?? doc.title,
    fileName: doc.fileName ?? doc.title,
    mime: doc.mime ?? 'application/octet-stream',
    size: doc.size ?? 0,
    createdAt: doc.createdAt,
    lastOpenedOkAt: doc.lastOpenedOkAt,
  };
  return { doc: { ...doc, recordType: doc.recordType ?? 'document', attachmentIds: [attachment.id] }, attachment };
}

/**
 * Connect the journey's supplied hotel info to its matching Wallet hotel record (same name), so the record becomes
 * the single source of truth. Copies only the user's own values; never invents fields.
 */
export function linkHotelV2(j: Journey, docs: WalletDoc[]): { journey?: Journey; doc?: WalletDoc } {
  if (!j.hotel || j.hotelDocId) return {};
  const d = docs.find((x) => x.journeyId === j.id && x.category === 'hotel' && !x.encrypted && x.title.trim() === j.hotel!.name.trim());
  if (!d) return {};
  const hotel = d.hotel ?? { name: j.hotel.name, addressZh: j.hotel.addressZh, addressEn: j.hotel.addressEn };
  return { journey: { ...j, hotelDocId: d.id }, doc: { ...d, hotel } };
}
