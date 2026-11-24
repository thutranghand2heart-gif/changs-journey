import { createPortal } from 'react-dom';
import { useEffect, useState } from 'react';
import { LuPlus, LuFileText, LuLock, LuCopy, LuX, LuZoomIn, LuZoomOut, LuReceipt, LuExternalLink, LuLink, LuPaperclip, LuImage, LuQrCode, LuUnlink, LuTrash2 } from 'react-icons/lu';
import type { Activity, Attachment, AttachmentKind, BookingStatus, Day, PaymentStatus, WalletDoc } from '../../db/schema';
import { db, updateJourney } from '../../db/repo';
import { Confirm, Field, go, lockScroll, PageHeader, pickFiles, queryParam, Sheet, unlockScroll, useBlobUrl, useStore, useToast } from '../../ui/core';
import { useJourney } from '../journey/JourneyShell';
import { bytes, copyText, nowIso } from '../../lib/util';
import { pauseAmbienceFor } from '../../art/audio';
import { makeDocPrivate, readPrivateDoc, vaultUnlocked } from '../../lib/vault';
import { addAttachmentFromFile, attIds, deleteAttachmentEverywhere, deleteRecord, isBooking, linkAttachments, linkStandaloneInto, newRecord, orphanAttachments, referencesOf, unlinkAttachment } from '../../lib/wallet';
import { t, tr } from '../../lib/i18n';
import { FlightEditor, flightLine } from './FlightEditor';
import { Tx } from '../../ui/contentTx';

export const DOC_CATS: Record<WalletDoc['category'], string> = {
  flight: tr('Chuyến bay'), train: tr('Tàu'), hotel: tr('Khách sạn'), ticket: tr('Vé tham quan'), reservation: tr('Đặt chỗ'), qr: tr('Mã QR'), receipt: tr('Biên lai'), confirmation: tr('Xác nhận'), immigration: tr('Nhập cảnh'), other: tr('Khác'),
};
export const DOC_ICON: Record<WalletDoc['category'], string> = { flight: '✈️', train: '🚄', hotel: '🏨', ticket: '🎟️', reservation: '📅', qr: '🔳', receipt: '🧾', confirmation: '✅', immigration: '🛂', other: '📄' };
export const BOOKING_LABEL: Record<BookingStatus, string> = {
  'info-entered': tr('Mới nhập thông tin'), 'reservation-requested': tr('Đã gửi yêu cầu đặt'), confirmed: tr('Đã đặt / xác nhận'), 'payment-pending': tr('Chờ thanh toán'), 'partially-paid': tr('Đã trả một phần'), paid: tr('Đã thanh toán'), cancelled: tr('Đã hủy'),
};
export const PAYMENT_LABEL: Record<PaymentStatus, string> = {
  unknown: tr('Chưa rõ'), 'not-required': tr('Không cần thanh toán'), pending: tr('Chờ thanh toán'), 'partially-paid': tr('Đã trả một phần'), paid: tr('Đã thanh toán'), refunded: tr('Đã hoàn tiền'),
};
export const ATT_KIND: Record<AttachmentKind, string> = {
  eticket: tr('Vé điện tử (E-Ticket)'), confirmation: tr('Xác nhận đặt chỗ'), 'boarding-pass': tr('Thẻ lên máy bay'), qr: tr('Mã QR'), photo: tr('Ảnh'), screenshot: tr('Ảnh chụp màn hình'), receipt: tr('Biên lai thanh toán'), other: tr('Tài liệu khác'),
};

export function WalletTab() {
  const { journey: j, days, activities } = useJourney();
  const docs = useStore<WalletDoc>('docs', j.id);
  const atts = useStore<Attachment>('attachments', j.id);
  const [cat, setCat] = useState('all');
  const [day, setDay] = useState('all');
  const [open, setOpen] = useState<string | null>(queryParam('d'));
  const [adding, setAdding] = useState(false);
  const [linking, setLinking] = useState<WalletDoc | null>(null);
  const [viewing, setViewing] = useState<Attachment | null>(null);
  const filt = (d: WalletDoc) => (cat === 'all' || d.category === cat) && (day === 'all' || d.dayId === day);
  const bookings = docs.filter((d) => isBooking(d) && filt(d)).sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  const standalone = docs.filter((d) => !isBooking(d) && filt(d)).sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  const orphans = orphanAttachments(atts, docs);
  const sel = docs.find((d) => d.id === open);

  const card = (d: WalletDoc) => {
    const n = attIds(d).length;
    return (
      <div key={d.id} className="doc-card glass-card">
        <button className="doc-main" onClick={() => setOpen(d.id)}>
          <span className="doc-ic">{d.privacy === 'private' ? <LuLock /> : DOC_ICON[d.category]}</span>
          <span className="grow">
            <b>{d.privacy === 'private' ? t('Giấy tờ riêng tư') : d.title}</b>
            {d.category === 'flight' && d.flight && <span className="xsmall block">{flightLine(d.flight)}</span>}
            <span className="muted xsmall block">
              {t(BOOKING_LABEL[d.bookingStatus])}
              {d.paymentStatus && d.paymentStatus !== 'unknown' ? ` · ${t(PAYMENT_LABEL[d.paymentStatus])}` : ''} · {n ? t('{0} tệp đính kèm', n) : t('chưa có tệp')}
            </span>
          </span>
        </button>
        {!isBooking(d) && (
          <button className="btn small ghost" onClick={() => setLinking(d)}><LuLink size={14} /> {t('Liên kết với hồ sơ hiện có')}</button>
        )}
      </div>
    );
  };

  return (
    <div className="page">
      <PageHeader title={t('Wallet')} sub={t('Vé, QR, đặt chỗ & giấy tờ')} right={<button className="icon-btn" aria-label={t('Thêm giấy tờ')} onClick={() => setAdding(true)}><LuPlus size={20} /></button>} />
      <div className="row gap-s">
        <button className="btn small" onClick={() => setAdding(true)}><LuPlus size={14} /> {t('Thêm giấy tờ')}</button>
        <button className="btn small ghost" onClick={() => go(`/j/${j.id}/budget`)}><LuReceipt size={14} /> {t('Ngân sách')}</button>
        <button className="btn small ghost" onClick={() => go(`/j/${j.id}/travel-doc`)}>🛂 {t('Thẻ nhập cảnh')}</button>
      </div>
      <div className="row gap-s">
        <select value={cat} onChange={(e: any) => setCat(e.target.value)} aria-label={t('Lọc theo loại')}>
          <option value="all">{t('Mọi loại')}</option>
          {Object.entries(DOC_CATS).map(([k, l]) => <option key={k} value={k}>{DOC_ICON[k as WalletDoc['category']]} {t(l)}</option>)}
        </select>
        <select value={day} onChange={(e: any) => setDay(e.target.value)} aria-label={t('Lọc theo ngày')}>
          <option value="all">{t('Mọi ngày')}</option>
          {days.map((d) => <option key={d.id} value={d.id}>{t('Ngày {0}', d.index)}</option>)}
        </select>
      </div>

      <h3 className="section-title">{t('Đặt chỗ & vé')}</h3>
      <div className="doc-list">
        {bookings.map(card)}
        {!bookings.length && <p className="muted small">{t('Chưa có hồ sơ đặt chỗ nào ở đây.')}</p>}
      </div>

      {standalone.length > 0 && (
        <>
          <h3 className="section-title">{t('Giấy tờ độc lập')}</h3>
          <p className="muted xsmall">{t('Tệp chưa gắn với chuyến bay, khách sạn hay vé nào. Dùng “Liên kết với hồ sơ hiện có” để đưa vào đúng hồ sơ mà không cần tải lại.')}</p>
          <div className="doc-list">{standalone.map(card)}</div>
        </>
      )}

      {orphans.length > 0 && (
        <>
          <h3 className="section-title">{t('Tệp chưa liên kết')}</h3>
          <div className="doc-list">
            {orphans.map((a) => (
              <AttachmentRow key={a.id} a={a} docs={docs} onOpen={() => setViewing(a)} />
            ))}
          </div>
        </>
      )}

      {sel && <RecordSheet d={sel} docs={docs} atts={atts} days={days} acts={activities} onClose={() => setOpen(null)} onView={setViewing} />}
      {adding && <AddSheet docs={docs} onClose={() => setAdding(false)} onOpenRecord={(id) => (setAdding(false), setOpen(id))} />}
      {linking && <LinkSheet src={linking} docs={docs} onClose={() => setLinking(null)} />}
      {viewing && <DocViewer att={viewing} onClose={() => setViewing(null)} />}
    </div>
  );
}

/** General “Add document”: 1) attach to existing booking 2) new booking 3) independent document. */
function AddSheet({ docs, onClose, onOpenRecord }: { docs: WalletDoc[]; onClose: () => void; onOpenRecord: (id: string) => void }) {
  const { journey: j } = useJourney();
  const toast = useToast();
  const [mode, setMode] = useState<'choose' | 'existing' | 'new'>('choose');
  const [target, setTarget] = useState('');
  const [newCat, setNewCat] = useState<WalletDoc['category']>('flight');
  const [title, setTitle] = useState('');
  const bookings = docs.filter((d) => isBooking(d) && !d.encrypted);

  const pickAndAttach = async (docId: string) => {
    const files = await pickFiles('image/*,application/pdf', true);
    if (!files.length) return false;
    try {
      const ids: string[] = [];
      for (const f of files) ids.push((await addAttachmentFromFile(f, j.id)).id);
      await linkAttachments(docId, ids);
      toast(t('Đã lưu {0} tệp vào hồ sơ', files.length));
      return true;
    } catch (e: any) {
      toast(e.message ?? t('Không lưu được tệp'), 'err');
      return false;
    }
  };

  return (
    <Sheet open onClose={onClose} title={t('Thêm giấy tờ')}>
      {mode === 'choose' && (
        <div className="menu-list">
          <button onClick={() => setMode('existing')} disabled={!bookings.length}>
            <LuPaperclip /> <span><b>{t('Đính kèm vào hồ sơ có sẵn')}</b><span className="muted xsmall block">{t('Ví dụ: thêm vé PDF vào chuyến bay đã có')}</span></span>
          </button>
          <button onClick={() => setMode('new')}>
            <LuPlus /> <span><b>{t('Tạo hồ sơ đặt chỗ mới')}</b><span className="muted xsmall block">{t('Chuyến bay, khách sạn, tàu, vé…')}</span></span>
          </button>
          <button
            onClick={async () => {
              const files = await pickFiles('image/*,application/pdf', true);
              if (!files.length) return;
              try {
                for (const f of files) {
                  const a = await addAttachmentFromFile(f, j.id);
                  const d = { ...newRecord(j.id, 'document', f.type.startsWith('image/') ? 'qr' : 'other', a.label), attachmentIds: [a.id] };
                  await db.put('docs', d);
                }
                toast(t('Đã lưu {0} tệp vào thiết bị', files.length));
                onClose();
              } catch (e: any) {
                toast(e.message ?? t('Không lưu được tệp'), 'err');
              }
            }}
          >
            <LuFileText /> <span><b>{t('Lưu thành giấy tờ độc lập')}</b><span className="muted xsmall block">{t('Có thể liên kết với hồ sơ sau')}</span></span>
          </button>
        </div>
      )}
      {mode === 'existing' && (
        <div className="stack">
          <Field label={t('Chọn hồ sơ')}>
            <select value={target} onChange={(e: any) => setTarget(e.target.value)} aria-label={t('Chọn hồ sơ')}>
              <option value="">—</option>
              {bookings.map((d) => <option key={d.id} value={d.id}>{DOC_ICON[d.category]} {d.title}</option>)}
            </select>
          </Field>
          <button className="btn primary" disabled={!target} onClick={async () => (await pickAndAttach(target)) && onOpenRecord(target)}><LuPaperclip size={14} /> {t('Chọn tệp để đính kèm…')}</button>
        </div>
      )}
      {mode === 'new' && (
        <div className="stack">
          <Field label={t('Loại')}>
            <select value={newCat} onChange={(e: any) => setNewCat(e.target.value)}>
              {Object.entries(DOC_CATS).map(([k, l]) => <option key={k} value={k}>{DOC_ICON[k as WalletDoc['category']]} {t(l)}</option>)}
            </select>
          </Field>
          <Field label={t('Tên hồ sơ')}><input value={title} onChange={(e: any) => setTitle(e.target.value)} placeholder={t('VD: Chuyến bay đi')} /></Field>
          {docs.some((d) => d.category === newCat && isBooking(d) && d.title.trim().toLowerCase() === title.trim().toLowerCase() && title.trim()) && (
            <p className="warn-box small">{t('Đã có hồ sơ cùng tên. Hãy đính kèm vào hồ sơ đó thay vì tạo bản trùng.')}</p>
          )}
          <button
            className="btn primary"
            disabled={!title.trim()}
            onClick={async () => {
              const d = newRecord(j.id, 'booking', newCat, title.trim());
              await db.put('docs', d);
              toast(t('Đã tạo hồ sơ'));
              onOpenRecord(d.id);
            }}
          >
            {t('Tạo hồ sơ')}
          </button>
        </div>
      )}
    </Sheet>
  );
}

/** Repair: link a standalone document's files into existing booking(s) — no re-upload, bytes untouched. */
function LinkSheet({ src, docs, onClose }: { src: WalletDoc; docs: WalletDoc[]; onClose: () => void }) {
  const toast = useToast();
  const [sel, setSel] = useState<string[]>([]);
  const [remove, setRemove] = useState(true);
  const bookings = docs.filter((d) => isBooking(d) && d.id !== src.id && !d.encrypted);
  return (
    <Sheet open onClose={onClose} title={t('Liên kết với hồ sơ hiện có')}>
      <div className="stack">
        <p className="small">{t('Chọn một hoặc nhiều hồ sơ. Một vé PDF có cả chiều đi và chiều về có thể liên kết với cả hai chuyến bay — tệp chỉ được lưu một lần.')}</p>
        <div className="check-list">
          {bookings.map((d) => (
            <label key={d.id} className="toggle-row">
              <input type="checkbox" checked={sel.includes(d.id)} onChange={(e: any) => setSel(e.target.checked ? [...sel, d.id] : sel.filter((x) => x !== d.id))} />
              {DOC_ICON[d.category]} <Tx s="docs" r={d} f="title" />
            </label>
          ))}
          {!bookings.length && <p className="muted small">{t('Chưa có hồ sơ đặt chỗ nào. Hãy tạo hồ sơ trước.')}</p>}
        </div>
        <label className="toggle-row"><input type="checkbox" checked={remove} onChange={(e: any) => setRemove(e.target.checked)} /> {t('Bỏ mục độc lập sau khi liên kết (tệp vẫn được giữ trong hồ sơ)')}</label>
        <button className="btn primary" disabled={!sel.length} onClick={async () => (await linkStandaloneInto(src, sel, remove), toast(t('Đã liên kết tệp vào {0} hồ sơ', sel.length)), onClose())}>
          <LuLink size={14} /> {t('Liên kết')}
        </button>
      </div>
    </Sheet>
  );
}

function AttachmentRow({ a, docs, onOpen, onUnlink }: { a: Attachment; docs: WalletDoc[]; onOpen: () => void; onUnlink?: () => void }) {
  const toast = useToast();
  const [del, setDel] = useState(false);
  const refs = referencesOf(a.id, docs);
  return (
    <div className="att-row">
      <button className="grow text-left att-main" onClick={onOpen} aria-label={t('Mở {0}', a.label)}>
        <span className="doc-ic">{a.mime.includes('pdf') ? '📄' : '🖼️'}</span>
        <span className="grow">
          <b className="ellipsis block">{a.label}</b>
          <span className="muted xsmall block">{t(ATT_KIND[a.kind])} · {bytes(a.size)}{refs.length > 1 ? ` · ${t('dùng trong {0} hồ sơ', refs.length)}` : ''}</span>
          {a.lastOpenedOkAt && <span className="ok-text xsmall block">✓ {t('Đã mở được trên thiết bị này')}</span>}
        </span>
      </button>
      {onUnlink && <button className="icon-btn" aria-label={t('Gỡ liên kết')} onClick={onUnlink}><LuUnlink size={16} /></button>}
      <button className="icon-btn" aria-label={t('Xóa tệp')} onClick={() => setDel(true)}><LuTrash2 size={16} /></button>
      <Confirm
        open={del}
        danger
        title={t('Xóa tệp vĩnh viễn?')}
        body={<p>{refs.length > 1 ? t('Tệp này đang được dùng trong {0} hồ sơ và sẽ bị gỡ khỏi tất cả. Không thể hoàn tác.', refs.length) : t('Tệp gốc sẽ bị xóa khỏi thiết bị này. Không thể hoàn tác.')}</p>}
        confirmText={t('Xóa tệp')}
        onConfirm={async () => (await deleteAttachmentEverywhere(a, docs), toast(t('Đã xóa tệp')))}
        onClose={() => setDel(false)}
      />
    </div>
  );
}

function RecordSheet({ d, docs, atts, days, acts, onClose, onView }: { d: WalletDoc; docs: WalletDoc[]; atts: Attachment[]; days: Day[]; acts: Activity[]; onClose: () => void; onView: (a: Attachment) => void }) {
  const { journey: j } = useJourney();
  const toast = useToast();
  const [f, setF] = useState(d);
  const [secret, setSecret] = useState<Awaited<ReturnType<typeof readPrivateDoc>> | null>(null);
  const [del, setDel] = useState(false);
  const [delFiles, setDelFiles] = useState(false);
  const [pickExisting, setPickExisting] = useState(false);
  const locked = d.encrypted && !vaultUnlocked();
  useEffect(() => setF(d), [d]);
  useEffect(() => {
    if (d.encrypted && vaultUnlocked()) readPrivateDoc(d).then(setSecret).catch(() => setSecret(null));
  }, [d.id]);
  if (locked)
    return (
      <Sheet open onClose={onClose} title={t('Giấy tờ riêng tư')}>
        <p>{t('Giấy tờ này được mã hóa. Mở khóa Két riêng tư để xem.')}</p>
        <button className="btn" onClick={() => go('/vault')}><LuLock size={14} /> {t('Mở Két')}</button>
      </Sheet>
    );
  const mine = attIds(d).map((id) => atts.find((a) => a.id === id)).filter(Boolean) as Attachment[];
  const ownOnly = mine.filter((a) => referencesOf(a.id, docs).length === 1);
  const title = secret?.title ?? f.title;
  const details = secret?.details ?? f.details;

  const addFiles = async (accept: string, kind?: AttachmentKind) => {
    const files = await pickFiles(accept, true);
    if (!files.length) return;
    try {
      const ids: string[] = [];
      for (const file of files) ids.push((await addAttachmentFromFile(file, j.id, kind)).id);
      await linkAttachments(d.id, ids); // attaches to THIS record; status is never changed by an upload
      toast(t('Đã lưu {0} tệp vào hồ sơ', files.length));
    } catch (e: any) {
      toast(e.message ?? t('Không lưu được tệp'), 'err');
    }
  };
  const save = async () => {
    await syncLinks(f, acts);
    await db.put('docs', f);
    toast(t('Đã lưu'));
  };

  return (
    <Sheet open onClose={onClose} title={title || t('Giấy tờ')} full>
      <div className="stack">
        <section className="card stack-s" aria-label={t('Tệp đính kèm')}>
          <h4><LuPaperclip size={14} /> {t('Tệp đính kèm')} ({mine.length})</h4>
          {mine.map((a) => <AttachmentRow key={a.id} a={a} docs={docs} onOpen={() => onView(a)} onUnlink={async () => (await unlinkAttachment(d.id, a.id), toast(t('Đã gỡ liên kết — tệp vẫn được giữ')))} />)}
          {!mine.length && <p className="muted small">{t('Chưa có tệp nào.')}</p>}
          <div className="row wrap gap-s">
            <button className="btn small" onClick={() => addFiles('application/pdf', 'eticket')}><LuFileText size={14} /> {t('Nhập PDF')}</button>
            <button className="btn small" onClick={() => addFiles('image/*', 'photo')}><LuImage size={14} /> {t('Thêm ảnh')}</button>
            <button className="btn small" onClick={() => addFiles('image/*', 'qr')}><LuQrCode size={14} /> {t('Thêm mã QR')}</button>
            <button className="btn small ghost" onClick={() => addFiles('image/*,application/pdf')}><LuPaperclip size={14} /> {t('Thêm tệp đính kèm')}</button>
            <button className="btn small ghost" onClick={() => setPickExisting(true)}><LuLink size={14} /> {t('Liên kết tệp có sẵn')}</button>
          </div>
          <p className="muted xsmall">{t('Tải tệp lên không tự đổi trạng thái thành “đã xác nhận” hay “đã thanh toán”.')}</p>
        </section>

        {!d.encrypted && (
          <>
            <Field label={t('Tên')}><input value={f.title} onChange={(e: any) => setF({ ...f, title: e.target.value })} /></Field>
            <div className="row gap">
              <Field label={t('Loại')}>
                <select value={f.category} onChange={(e: any) => setF({ ...f, category: e.target.value })}>{Object.entries(DOC_CATS).map(([k, l]) => <option key={k} value={k}>{t(l)}</option>)}</select>
              </Field>
              <Field label={t('Loại hồ sơ')}>
                <select value={f.recordType ?? 'booking'} onChange={(e: any) => setF({ ...f, recordType: e.target.value })}>
                  <option value="booking">{t('Hồ sơ đặt chỗ')}</option>
                  <option value="document">{t('Giấy tờ độc lập')}</option>
                </select>
              </Field>
            </div>
            <div className="row gap">
              <Field label={t('Trạng thái đặt chỗ')}>
                <select value={f.bookingStatus} onChange={(e: any) => setF({ ...f, bookingStatus: e.target.value })}>{Object.entries(BOOKING_LABEL).map(([k, l]) => <option key={k} value={k}>{t(l)}</option>)}</select>
              </Field>
              <Field label={t('Thanh toán')}>
                <select value={f.paymentStatus ?? 'unknown'} onChange={(e: any) => setF({ ...f, paymentStatus: e.target.value })}>{Object.entries(PAYMENT_LABEL).map(([k, l]) => <option key={k} value={k}>{t(l)}</option>)}</select>
              </Field>
            </div>
            <p className="muted xsmall">{t('Trạng thái do bạn chọn — ứng dụng không suy ra “đã xác nhận” từ tên tệp hay lịch.')}</p>

            {f.category === 'flight' && <FlightEditor d={f} onChange={setF} />}
            {f.category === 'hotel' && <HotelFields d={f} onChange={setF} />}

            <Field label={t('Ngày')}>
              <select value={f.dayId ?? ''} onChange={(e: any) => setF({ ...f, dayId: e.target.value || undefined })}>
                <option value="">—</option>
                {days.map((x) => <option key={x.id} value={x.id}>{t('Ngày {0}', x.index)}: {x.title}</option>)}
              </select>
            </Field>
            <Field label={t('Ghi chú')}><textarea rows={4} value={f.details} onChange={(e: any) => setF({ ...f, details: e.target.value })} /></Field>
            <Field label={t('Liên kết hoạt động')}>
              <select value="" onChange={(e: any) => e.target.value && setF({ ...f, activityIds: Array.from(new Set([...f.activityIds, e.target.value])) })} aria-label={t('Liên kết hoạt động')}>
                <option value="">{t('+ Thêm liên kết…')}</option>
                {acts.map((a) => <option key={a.id} value={a.id}>{a.title}</option>)}
              </select>
              <div className="row wrap gap-s">
                {f.activityIds.map((id) => <button key={id} className="chip" onClick={() => setF({ ...f, activityIds: f.activityIds.filter((x) => x !== id) })}>{acts.find((a) => a.id === id)?.title ?? t('đã xóa')} ×</button>)}
              </div>
            </Field>
          </>
        )}
        {d.encrypted && <pre className="details-box">{details}</pre>}
        {details && <button className="btn small ghost" onClick={async () => toast((await copyText(details)) ? t('Đã sao chép chi tiết') : t('Không sao chép được'))}><LuCopy size={14} /> {t('Sao chép chi tiết')}</button>}
        <div className="row gap wrap">
          <button className="btn danger ghost" onClick={() => setDel(true)}>{t('Xóa hồ sơ')}</button>
          {!d.encrypted && (
            <button
              className="btn ghost"
              onClick={async () => {
                if (!vaultUnlocked()) return toast(t('Hãy thiết lập/mở Két riêng tư trước'), 'warn'), go('/vault');
                await syncLinks(f, acts);
                await db.put('docs', await makeDocPrivate(f, mine.map((a) => a.blobId)));
                toast(t('Đã mã hóa và chuyển vào riêng tư'));
                onClose();
              }}
            >
              <LuLock size={14} /> {t('Chuyển riêng tư (mã hóa)')}
            </button>
          )}
          {!d.encrypted && <button className="btn primary" onClick={async () => (await save(), onClose())}>{t('Lưu')}</button>}
        </div>
        {f.category === 'hotel' && !d.encrypted && (
          <label className="toggle-row small">
            <input type="checkbox" checked={j.hotelDocId === d.id} onChange={(e: any) => updateJourney(j.id, { hotelDocId: e.target.checked ? d.id : undefined })} />
            {t('Dùng làm khách sạn chính của chuyến đi (Home & thẻ nhập cảnh)')}
          </label>
        )}
      </div>
      <Confirm
        open={del}
        danger
        title={t('Xóa hồ sơ?')}
        body={
          <div className="stack-s">
            <p>{t('Hồ sơ “{0}” sẽ bị xóa. Tệp đang được hồ sơ khác dùng luôn được giữ lại.', title)}</p>
            {ownOnly.length > 0 && (
              <label className="toggle-row"><input type="checkbox" checked={delFiles} onChange={(e: any) => setDelFiles(e.target.checked)} /> {t('Xóa luôn {0} tệp chỉ thuộc hồ sơ này (nếu không, chúng chuyển sang “Tệp chưa liên kết”)', ownOnly.length)}</label>
            )}
          </div>
        }
        confirmText={t('Xóa hồ sơ')}
        onConfirm={async () => {
          await deleteRecord(d, docs, atts, delFiles, acts);
          if (j.hotelDocId === d.id) await updateJourney(j.id, { hotelDocId: undefined });
          onClose();
        }}
        onClose={() => setDel(false)}
      />
      {pickExisting && <PickAttachments d={d} atts={atts} docs={docs} onClose={() => setPickExisting(false)} />}
    </Sheet>
  );
}

function HotelFields({ d, onChange }: { d: WalletDoc; onChange: (d: WalletDoc) => void }) {
  const h = d.hotel ?? {};
  const set = (k: keyof NonNullable<WalletDoc['hotel']>) => (e: any) => onChange({ ...d, hotel: { ...h, [k]: e.target.value || undefined } });
  return (
    <div className="card stack-s">
      <h4>🏨 {t('Thông tin khách sạn')}</h4>
      <Field label={t('Tên khách sạn')}><input value={h.name ?? ''} onChange={set('name')} /></Field>
      <Field label={t('Tên khách sạn tiếng Trung (hiện trên thẻ nhập cảnh)')}><input lang="zh-CN" value={h.nameZh ?? ''} onChange={set('nameZh')} /></Field>
      <Field label={t('Địa chỉ tiếng Trung / địa phương')}><input value={h.addressZh ?? ''} onChange={set('addressZh')} /></Field>
      <Field label={t('Địa chỉ tiếng Anh')}><input value={h.addressEn ?? ''} onChange={set('addressEn')} /></Field>
      <div className="row gap">
        <Field label={t('Điện thoại')}><input inputMode="tel" value={h.phone ?? ''} onChange={set('phone')} /></Field>
        <Field label={t('Mã đặt phòng')}><input value={h.bookingRef ?? ''} onChange={set('bookingRef')} autoCapitalize="characters" /></Field>
      </div>
      <div className="row gap">
        <Field label={t('Nhận phòng')}><input type="date" value={h.checkIn ?? ''} onChange={set('checkIn')} /></Field>
        <Field label={t('Trả phòng')}><input type="date" value={h.checkOut ?? ''} onChange={set('checkOut')} /></Field>
      </div>
    </div>
  );
}

function PickAttachments({ d, atts, docs, onClose }: { d: WalletDoc; atts: Attachment[]; docs: WalletDoc[]; onClose: () => void }) {
  const toast = useToast();
  const [sel, setSel] = useState<string[]>([]);
  const candidates = atts.filter((a) => !attIds(d).includes(a.id));
  return (
    <Sheet open onClose={onClose} title={t('Liên kết tệp có sẵn')}>
      <div className="stack">
        {candidates.map((a) => (
          <label key={a.id} className="toggle-row">
            <input type="checkbox" checked={sel.includes(a.id)} onChange={(e: any) => setSel(e.target.checked ? [...sel, a.id] : sel.filter((x) => x !== a.id))} />
            <span>{a.label} <span className="muted xsmall">· {referencesOf(a.id, docs).map((x) => x.title).join(', ') || t('chưa liên kết')}</span></span>
          </label>
        ))}
        {!candidates.length && <p className="muted small">{t('Không có tệp nào khác trong chuyến đi này.')}</p>}
        <button className="btn primary" disabled={!sel.length} onClick={async () => (await linkAttachments(d.id, sel), toast(t('Đã liên kết {0} tệp (không tạo bản sao)', sel.length)), onClose())}>{t('Liên kết')}</button>
      </div>
    </Sheet>
  );
}

async function syncLinks(d: WalletDoc, acts: Activity[]) {
  for (const a of acts) {
    const has = a.documentIds.includes(d.id);
    const want = d.activityIds.includes(a.id);
    if (has !== want) await db.put('activities', { ...a, documentIds: want ? [...a.documentIds, d.id] : a.documentIds.filter((x) => x !== d.id) });
  }
}

/** Fullscreen viewer for an attachment (decrypts when the vault is open). Marks it as opened only after it rendered. */
export function DocViewer({ att, onClose }: { att: Attachment; onClose: () => void }) {
  const { url, state, mime } = useBlobUrl(att.blobId);
  const [zoom, setZoom] = useState(1);
  const [ok, setOk] = useState(false);
  useEffect(() => pauseAmbienceFor(), []);
  useEffect(() => {
    lockScroll();
    return () => unlockScroll();
  }, []);
  const markOk = async () => {
    if (ok) return;
    setOk(true);
    const cur = await db.get<Attachment>('attachments', att.id);
    if (cur) await db.put('attachments', { ...cur, lastOpenedOkAt: nowIso() });
  };
  const isPdf = (mime ?? att.mime ?? '').includes('pdf');
  // portalled to <body> so it always covers sheets (which are portalled too)
  return createPortal(
    <div className="viewer" role="dialog" aria-modal="true" aria-label={att.label}>
      <div className="viewer-bar">
        <button className="icon-btn" aria-label={t('Đóng trình xem')} onClick={onClose}><LuX size={24} /></button>
        <span className="grow ellipsis">{att.label}</span>
        {!isPdf && <button className="icon-btn" aria-label={t('Thu nhỏ')} onClick={() => setZoom((z) => Math.max(1, z - 0.5))}><LuZoomOut size={20} /></button>}
        {!isPdf && <button className="icon-btn" aria-label={t('Phóng to')} onClick={() => setZoom((z) => Math.min(5, z + 0.5))}><LuZoomIn size={20} /></button>}
        {url && <a className="icon-btn" aria-label={t('Mở trong tab mới')} href={url} target="_blank" rel="noopener"><LuExternalLink size={20} /></a>}
      </div>
      <div className="viewer-body">
        {state === 'loading' && <p className="center muted">{t('Đang mở…')}</p>}
        {state === 'missing' && <p className="center error">{t('Không đọc được tệp gốc trên thiết bị này. Hãy thêm lại tệp hoặc khôi phục từ bản sao lưu.')}</p>}
        {state === 'locked' && <p className="center">🔒 {t('Tệp đã mã hóa — mở Két riêng tư để xem.')}</p>}
        {url && !isPdf && (
          <div className="zoom-wrap">
            <img src={url} alt={att.label} style={{ width: `${zoom * 100}%` }} onLoad={markOk} onError={() => setOk(false)} />
          </div>
        )}
        {url && isPdf && <iframe title={att.label} src={url} className="pdf-frame" onLoad={markOk} />}
      </div>
      {isPdf && <p className="viewer-foot muted xsmall">{t('Nếu PDF chỉ hiện trang đầu, nhấn biểu tượng ↗ để mở bằng trình xem của iPhone.')}</p>}
    </div>,
    document.body,
  );
}

