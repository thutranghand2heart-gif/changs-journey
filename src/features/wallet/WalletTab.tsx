import { useEffect, useState } from 'react';
import { LuPlus, LuFileText, LuLock, LuCopy, LuX, LuZoomIn, LuZoomOut, LuReceipt, LuExternalLink } from 'react-icons/lu';
import type { Activity, BookingStatus, Day, WalletDoc } from '../../db/schema';
import { db, saveFileAsBlob } from '../../db/repo';
import { Confirm, Field, go, PageHeader, pickFiles, queryParam, Sheet, useBlobUrl, useStore, useToast } from '../../ui/core';
import { useJourney } from '../journey/JourneyShell';
import { bytes, copyText, nowIso, uid } from '../../lib/util';
import { pauseAmbienceFor } from '../../art/audio';
import { makeDocPrivate, readPrivateDoc, vaultUnlocked } from '../../lib/vault';

export const DOC_CATS: Record<WalletDoc['category'], string> = {
  flight: '✈️ Chuyến bay', train: '🚄 Tàu', hotel: '🏨 Khách sạn', ticket: '🎟️ Vé tham quan', reservation: '📅 Đặt chỗ', qr: '🔳 Mã QR', receipt: '🧾 Biên lai', confirmation: '✅ Xác nhận', immigration: '🛂 Nhập cảnh', other: '📄 Khác',
};
export const BOOKING_LABEL: Record<BookingStatus, string> = {
  'info-entered': 'Mới nhập thông tin', 'reservation-requested': 'Đã gửi yêu cầu đặt', confirmed: 'Đã đặt / xác nhận', 'payment-pending': 'Chờ thanh toán', 'partially-paid': 'Đã trả một phần', paid: 'Đã thanh toán', cancelled: 'Đã hủy',
};

export function WalletTab() {
  const { journey: j, days, activities } = useJourney();
  const docs = useStore<WalletDoc>('docs', j.id);
  const toast = useToast();
  const [cat, setCat] = useState('all');
  const [day, setDay] = useState('all');
  const [open, setOpen] = useState<string | null>(queryParam('d'));
  const [viewing, setViewing] = useState<WalletDoc | null>(null);
  const list = docs.filter((d) => (cat === 'all' || d.category === cat) && (day === 'all' || d.dayId === day)).sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  const sel = docs.find((d) => d.id === open);

  const add = async () => {
    const files = await pickFiles('image/*,application/pdf', true);
    if (!files.length) return;
    try {
      for (const f of files) {
        const rec = await saveFileAsBlob(f, f.name, j.id);
        // category is never inferred as "confirmed" from a file name
        const d: WalletDoc = { id: uid('doc'), journeyId: j.id, title: f.name.replace(/\.[^.]+$/, ''), category: f.type.startsWith('image/') ? 'qr' : 'other', bookingStatus: 'info-entered', activityIds: [], details: '', blobId: rec.id, mime: rec.mime, fileName: f.name, size: f.size, privacy: 'normal', createdAt: nowIso() };
        await db.put('docs', d);
        if (files.length === 1) setOpen(d.id);
      }
      toast(`Đã lưu ${files.length} tệp vào thiết bị`);
    } catch (e: any) {
      toast(e.message ?? 'Không lưu được tệp', 'err');
    }
  };

  return (
    <div className="page">
      <PageHeader title="Wallet" sub="Vé, QR, đặt chỗ & giấy tờ" right={<button className="icon-btn" aria-label="Thêm giấy tờ" onClick={add}><LuPlus size={20} /></button>} />
      <div className="row gap-s">
        <button className="btn small" onClick={add}><LuPlus size={14} /> Thêm vé / ảnh / PDF</button>
        <button className="btn small ghost" onClick={() => go(`/j/${j.id}/budget`)}><LuReceipt size={14} /> Ngân sách</button>
        <button className="btn small ghost" onClick={() => go(`/j/${j.id}/travel-doc`)}>🛂 Thẻ nhập cảnh</button>
      </div>
      <div className="row gap-s">
        <select value={cat} onChange={(e: any) => setCat(e.target.value)} aria-label="Lọc theo loại">
          <option value="all">Mọi loại</option>
          {Object.entries(DOC_CATS).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
        </select>
        <select value={day} onChange={(e: any) => setDay(e.target.value)} aria-label="Lọc theo ngày">
          <option value="all">Mọi ngày</option>
          {days.map((d) => <option key={d.id} value={d.id}>Ngày {d.index}</option>)}
        </select>
      </div>
      <div className="doc-list">
        {list.map((d) => (
          <button key={d.id} className="doc-card glass-card" onClick={() => setOpen(d.id)}>
            <span className="doc-ic">{d.privacy === 'private' ? <LuLock /> : DOC_CATS[d.category].split(' ')[0]}</span>
            <span className="grow">
              <b>{d.privacy === 'private' ? 'Giấy tờ riêng tư' : d.title}</b>
              <span className="muted xsmall block">{BOOKING_LABEL[d.bookingStatus]}{d.blobId ? ` · ${d.fileName ?? 'tệp'} ${bytes(d.size)}` : ' · chưa có tệp gốc'}</span>
              {d.lastOpenedOkAt && <span className="ok-text xsmall block">✓ Đã mở được trên thiết bị này</span>}
            </span>
          </button>
        ))}
        {!list.length && <p className="muted center">Chưa có giấy tờ nào ở đây.</p>}
      </div>
      {sel && <DocSheet d={sel} days={days} acts={activities} onClose={() => setOpen(null)} onView={(d) => setViewing(d)} />}
      {viewing && <DocViewer d={viewing} onClose={() => setViewing(null)} />}
    </div>
  );
}

function DocSheet({ d, days, acts, onClose, onView }: { d: WalletDoc; days: Day[]; acts: Activity[]; onClose: () => void; onView: (d: WalletDoc) => void }) {
  const toast = useToast();
  const [f, setF] = useState(d);
  const [secret, setSecret] = useState<{ title: string; details: string } | null>(null);
  const [del, setDel] = useState(false);
  const locked = d.encrypted && !vaultUnlocked();
  useEffect(() => {
    if (d.encrypted && vaultUnlocked()) readPrivateDoc(d).then(setSecret).catch(() => setSecret(null));
  }, [d.id]);
  if (locked)
    return (
      <Sheet open onClose={onClose} title="Giấy tờ riêng tư">
        <p>Giấy tờ này được mã hóa. Mở khóa Két riêng tư để xem.</p>
        <button className="btn" onClick={() => go('/vault')}><LuLock size={14} /> Mở Két</button>
      </Sheet>
    );
  const title = secret?.title ?? f.title;
  const details = secret?.details ?? f.details;
  return (
    <Sheet open onClose={onClose} title={title || 'Giấy tờ'} full>
      <div className="stack">
        {d.blobId && <button className="btn primary big" onClick={() => onView({ ...d, title })}><LuFileText /> Mở toàn màn hình</button>}
        {!d.encrypted && (
          <>
            <Field label="Tên"><input value={f.title} onChange={(e: any) => setF({ ...f, title: e.target.value })} /></Field>
            <div className="row gap">
              <Field label="Loại">
                <select value={f.category} onChange={(e: any) => setF({ ...f, category: e.target.value })}>{Object.entries(DOC_CATS).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select>
              </Field>
              <Field label="Trạng thái đặt chỗ">
                <select value={f.bookingStatus} onChange={(e: any) => setF({ ...f, bookingStatus: e.target.value })}>{Object.entries(BOOKING_LABEL).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select>
              </Field>
            </div>
            <p className="muted xsmall">Trạng thái do bạn chọn — ứng dụng không suy ra “đã xác nhận” từ tên tệp hay lịch.</p>
            <Field label="Ngày">
              <select value={f.dayId ?? ''} onChange={(e: any) => setF({ ...f, dayId: e.target.value || undefined })}>
                <option value="">—</option>
                {days.map((x) => <option key={x.id} value={x.id}>Ngày {x.index}: {x.title}</option>)}
              </select>
            </Field>
            <Field label="Chi tiết (mã đặt chỗ, ghi chú…)"><textarea rows={4} value={f.details} onChange={(e: any) => setF({ ...f, details: e.target.value })} /></Field>
            <Field label="Liên kết hoạt động">
              <select value="" onChange={(e: any) => e.target.value && setF({ ...f, activityIds: Array.from(new Set([...f.activityIds, e.target.value])) })}>
                <option value="">+ Thêm liên kết…</option>
                {acts.map((a) => <option key={a.id} value={a.id}>{a.title}</option>)}
              </select>
              <div className="row wrap gap-s">
                {f.activityIds.map((id) => <button key={id} className="chip" onClick={() => setF({ ...f, activityIds: f.activityIds.filter((x) => x !== id) })}>{acts.find((a) => a.id === id)?.title ?? 'đã xóa'} ×</button>)}
              </div>
            </Field>
          </>
        )}
        {d.encrypted && <pre className="details-box">{details}</pre>}
        {details && <button className="btn small ghost" onClick={async () => toast((await copyText(details)) ? 'Đã sao chép chi tiết' : 'Không sao chép được')}><LuCopy size={14} /> Sao chép chi tiết</button>}
        <div className="row gap wrap">
          <button className="btn danger ghost" onClick={() => setDel(true)}>Xóa</button>
          {!d.encrypted && (
            <button
              className="btn ghost"
              onClick={async () => {
                if (!vaultUnlocked()) return toast('Hãy thiết lập/mở Két riêng tư trước', 'warn'), go('/vault');
                await syncLinks(f, acts);
                await db.put('docs', await makeDocPrivate(f));
                toast('Đã mã hóa và chuyển vào riêng tư');
                onClose();
              }}
            >
              <LuLock size={14} /> Chuyển riêng tư (mã hóa)
            </button>
          )}
          {!d.encrypted && <button className="btn primary" onClick={async () => (await syncLinks(f, acts), await db.put('docs', f), toast('Đã lưu'), onClose())}>Lưu</button>}
        </div>
      </div>
      <Confirm open={del} danger title="Xóa giấy tờ?" body="Tệp gốc sẽ bị xóa khỏi thiết bị này." onConfirm={async () => {
        if (d.blobId) await db.del('blobs', d.blobId);
        await syncLinks({ ...f, activityIds: [] }, acts);
        await db.del('docs', d.id);
        onClose();
      }} onClose={() => setDel(false)} />
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

export function DocViewer({ d, onClose }: { d: WalletDoc; onClose: () => void }) {
  const { url, state, mime } = useBlobUrl(d.blobId);
  const [zoom, setZoom] = useState(1);
  const [ok, setOk] = useState(false);
  useEffect(() => pauseAmbienceFor(), []);
  useEffect(() => {
    document.body.classList.add('no-scroll');
    return () => document.body.classList.remove('no-scroll');
  }, []);
  const markOk = async () => {
    if (ok) return;
    setOk(true);
    const cur = await db.get<WalletDoc>('docs', d.id);
    if (cur) await db.put('docs', { ...cur, lastOpenedOkAt: nowIso() });
  };
  const isPdf = (mime ?? d.mime ?? '').includes('pdf');
  return (
    <div className="viewer" role="dialog" aria-modal="true" aria-label={d.title}>
      <div className="viewer-bar">
        <button className="icon-btn" aria-label="Đóng trình xem" onClick={onClose}><LuX size={24} /></button>
        <span className="grow ellipsis">{d.title}</span>
        {!isPdf && <button className="icon-btn" aria-label="Thu nhỏ" onClick={() => setZoom((z) => Math.max(1, z - 0.5))}><LuZoomOut size={20} /></button>}
        {!isPdf && <button className="icon-btn" aria-label="Phóng to" onClick={() => setZoom((z) => Math.min(5, z + 0.5))}><LuZoomIn size={20} /></button>}
        {url && <a className="icon-btn" aria-label="Mở trong tab mới" href={url} target="_blank" rel="noopener"><LuExternalLink size={20} /></a>}
      </div>
      <div className="viewer-body">
        {state === 'loading' && <p className="center muted">Đang mở…</p>}
        {state === 'missing' && <p className="center error">Không đọc được tệp gốc trên thiết bị này. Hãy thêm lại tệp hoặc khôi phục từ bản sao lưu.</p>}
        {state === 'locked' && <p className="center">🔒 Tệp đã mã hóa — mở Két riêng tư để xem.</p>}
        {url && !isPdf && (
          <div className="zoom-wrap">
            <img src={url} alt={d.title} style={{ width: `${zoom * 100}%` }} onLoad={markOk} onError={() => setOk(false)} />
          </div>
        )}
        {url && isPdf && <iframe title={d.title} src={url} className="pdf-frame" onLoad={markOk} />}
      </div>
      {isPdf && <p className="viewer-foot muted xsmall">Nếu PDF chỉ hiện trang đầu, nhấn biểu tượng ↗ để mở bằng trình xem của iPhone.</p>}
    </div>
  );
}
