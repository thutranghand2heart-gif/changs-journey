import { useEffect, useRef, useState } from 'react';
import JSZip from 'jszip';
import { LuPlus, LuDownload, LuShare2 } from 'react-icons/lu';
import type { Capsule, Memory, Postcard } from '../../db/schema';
import { db, readBlob, saveFileAsBlob } from '../../db/repo';
import { BlobImg, Confirm, Field, go, PageHeader, pickFiles, Sheet, useBlobUrl, useStore, useToast } from '../../ui/core';
import { useJourney } from '../journey/JourneyShell';
import { downloadBlob, nowIso, uid } from '../../lib/util';
import { todayIn } from '../../lib/time';
import { publicMemories } from '../../lib/search';
import { Markup, useVaultOpen } from './MemoryCommon';
import { readPrivateMemory } from '../../lib/vault';
import { Cinema } from './Memories';
import { useApp } from '../../ui/app-context';
import { tokensFor } from '../../lib/themes';
import { t } from '../../lib/i18n';

// ───────── Postcard Studio
export function PostcardStudio() {
  const { journey: j } = useJourney();
  const toast = useToast();
  const cards = useStore<Postcard>('postcards', j.id);
  const mems = publicMemories(useStore<Memory>('memories', j.id));
  const photos = mems.flatMap((m) => m.photoBlobIds);
  const [photo, setPhoto] = useState<string | null>(null);
  const [msg, setMsg] = useState(j.postcardDefault ?? t('Giáng sinh an lành ✨'));
  const [busy, setBusy] = useState(false);
  const tk = tokensFor(j);
  const { url } = useBlobUrl(photo ?? undefined);

  const render = async () => {
    if (!url) return;
    setBusy(true);
    try {
      const img = new Image();
      img.src = url;
      await img.decode();
      const c = document.createElement('canvas');
      c.width = 1500;
      c.height = 1000;
      const g = c.getContext('2d')!;
      g.fillStyle = '#FFF8EE';
      g.fillRect(0, 0, 1500, 1000);
      // photo on left, cover-fit
      const W = 860, H = 920, X = 40, Y = 40;
      const r = Math.max(W / img.width, H / img.height);
      g.save();
      g.beginPath();
      g.rect(X, Y, W, H);
      g.clip();
      g.drawImage(img, X + (W - img.width * r) / 2, Y + (H - img.height * r) / 2, img.width * r, img.height * r);
      g.restore();
      g.strokeStyle = tk.accent;
      g.lineWidth = 3;
      g.strokeRect(X - 10, Y - 10, W + 20, H + 20);
      g.fillStyle = tk.bg2;
      g.font = 'italic 56px Georgia, "Times New Roman", serif';
      g.fillText(j.title, 940, 140, 520);
      g.fillStyle = tk.accent2;
      g.fillRect(940, 170, 140, 4);
      g.fillStyle = '#2c2a26';
      g.font = '38px Georgia, "Times New Roman", "PingFang SC", serif';
      const words = msg.split(/\s+/);
      let line = '', y = 260;
      for (const w of words) {
        if (g.measureText(line + w).width > 500) { g.fillText(line, 940, y); line = ''; y += 54; }
        line += w + ' ';
      }
      g.fillText(line, 940, y);
      g.font = '26px Georgia, serif';
      g.fillStyle = '#8a7a60';
      g.fillText(t('Những bước chân của Chang'), 940, 940);
      const blob: Blob = await new Promise((res, rej) => c.toBlob((b) => (b ? res(b) : rej(new Error(t('Không tạo được ảnh')))), 'image/png'));
      const rec = await saveFileAsBlob(blob, `postcard-${Date.now()}.png`, j.id);
      await db.put('postcards', { id: uid('pc'), journeyId: j.id, blobId: rec.id, message: msg, createdAt: nowIso() } satisfies Postcard);
      toast(t('Đã tạo bưu thiếp'));
    } catch (e: any) {
      toast(e.message ?? t('Lỗi tạo bưu thiếp'), 'err');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="page">
      <PageHeader title={t('Christmas Postcard Studio')} back={`/j/${j.id}/memories`} />
      <p className="muted small">{t('Chọn một ảnh từ kỷ niệm (không riêng tư) hoặc tải ảnh mới.')}</p>
      <div className="thumb-row">
        {photos.map((id) => <button key={id} className={`thumb-btn ${photo === id ? 'on' : ''}`} onClick={() => setPhoto(id)}><BlobImg id={id} className="thumb" /></button>)}
        <button className="btn small" onClick={async () => { const [f] = await pickFiles('image/*'); if (f) setPhoto((await saveFileAsBlob(f, f.name, j.id)).id); }}><LuPlus /> {' '}{t('Ảnh')}</button>
      </div>
      <Field label={t('Lời nhắn')}><textarea rows={3} value={msg} onChange={(e: any) => setMsg(e.target.value)} /></Field>
      <button className="btn primary" disabled={!url || busy} onClick={render}>{busy ? t('Đang vẽ…') : t('Tạo bưu thiếp')}</button>
      <h3 className="section-title">{t('Bưu thiếp của bạn')}</h3>
      <div className="postcards">
        {cards.map((c) => <PostcardItem key={c.id} c={c} />)}
        {!cards.length && <p className="muted">{t('Chưa có bưu thiếp.')}</p>}
      </div>
    </div>
  );
}
function PostcardItem({ c }: { c: Postcard }) {
  const toast = useToast();
  const [del, setDel] = useState(false);
  const share = async () => {
    const r = await readBlob(c.blobId);
    if (!r) return toast(t('Không đọc được tệp'), 'err');
    const file = new File([r.blob], r.rec.name, { type: 'image/png' });
    if ((navigator as any).canShare?.({ files: [file] })) {
      try { await navigator.share({ files: [file], text: c.message }); } catch { /* user cancelled */ }
    } else downloadBlob(r.blob, r.rec.name);
  };
  return (
    <figure className="postcard">
      <BlobImg id={c.blobId} className="postcard-img" />
      <div className="row gap-s">
        <button className="btn small" onClick={share}><LuShare2 size={14} /> {' '}{t('Chia sẻ / lưu')}</button>
        <button className="btn small ghost danger" onClick={() => setDel(true)}>{t('Xóa')}</button>
      </div>
      <Confirm open={del} danger title={t('Xóa bưu thiếp?')} body="" onConfirm={async () => (await db.del('blobs', c.blobId), await db.del('postcards', c.id))} onClose={() => setDel(false)} />
    </figure>
  );
}

// ───────── Time Capsules
export function Capsules() {
  const { journey: j } = useJourney();
  const caps = useStore<Capsule>('capsules', j.id);
  const [edit, setEdit] = useState<Capsule | null>(null);
  const [open, setOpen] = useState<Capsule | null>(null);
  const today = todayIn(Intl.DateTimeFormat().resolvedOptions().timeZone);
  return (
    <div className="page">
      <PageHeader title={t('Hộp thời gian')} sub={t('Thư & ảnh gửi đến tương lai')} back={`/j/${j.id}/memories`} right={<button className="icon-btn" aria-label={t('Tạo hộp')} onClick={() => setEdit({ id: uid('cap'), journeyId: j.id, title: '', kind: 'capsule', letter: '', blobIds: [], unlockDate: '2027-12-24', openedEarly: false, createdAt: nowIso() })}><LuPlus size={20} /></button>} />
      <p className="warn-box small">{t('Khóa theo ngày chỉ là khóa giao diện để giữ bất ngờ — không phải mã hóa. Ai mở được ứng dụng đều có thể chọn “mở sớm”.')}</p>
      <div className="stack-s">
        {caps.map((c) => {
          const ready = today >= c.unlockDate || c.openedEarly;
          return (
            <button key={c.id} className="list-row glass-card" onClick={() => (ready ? setOpen(c) : setOpen(c))}>
              <span className="grow"><b>{c.kind === 'future-letter' ? '💌' : '⏳'} {c.title || t('Hộp thời gian')}</b><span className="muted xsmall block">{ready ? t('Có thể mở') : t('Mở vào {0}', c.unlockDate)}</span></span>
            </button>
          );
        })}
        {!caps.length && <p className="muted center">{t('Chưa có hộp thời gian nào.')}</p>}
      </div>
      {edit && <CapsuleEditor c={edit} onClose={() => setEdit(null)} />}
      {open && <CapsuleOpen c={open} today={today} onClose={() => setOpen(null)} onEdit={() => (setEdit(open), setOpen(null))} />}
    </div>
  );
}
function CapsuleEditor({ c, onClose }: { c: Capsule; onClose: () => void }) {
  const toast = useToast();
  const [f, setF] = useState(c);
  return (
    <Sheet open onClose={onClose} title={t('Hộp thời gian')} full>
      <div className="stack">
        <Field label={t('Tên')}><input value={f.title} onChange={(e: any) => setF({ ...f, title: e.target.value })} /></Field>
        <Field label={t('Loại')}>
          <select value={f.kind} onChange={(e: any) => setF({ ...f, kind: e.target.value })}><option value="capsule">{t('Hộp thời gian')}</option><option value="future-letter">{t('Thư gửi chính mình tương lai')}</option></select>
        </Field>
        <Field label={t('Ngày mở')}><input type="date" value={f.unlockDate} onChange={(e: any) => setF({ ...f, unlockDate: e.target.value })} /></Field>
        <Field label={t('Lá thư')}><textarea rows={8} value={f.letter} onChange={(e: any) => setF({ ...f, letter: e.target.value })} /></Field>
        <div className="thumb-row">{f.blobIds.map((id) => <BlobImg key={id} id={id} className="thumb" />)}</div>
        <button className="btn small" onClick={async () => {
          const fs = await pickFiles('image/*,video/*', true);
          const ids: string[] = [];
          try { for (const x of fs) ids.push((await saveFileAsBlob(x, x.name, f.journeyId)).id); } catch (e: any) { toast(e.message, 'err'); }
          setF({ ...f, blobIds: [...f.blobIds, ...ids] });
        }}>{t('Thêm ảnh / video')}</button>
        <p className="muted xsmall">{t('Video được lưu nguyên tệp; phát lại tùy định dạng iPhone hỗ trợ.')}</p>
        <button className="btn primary" onClick={async () => (await db.put('capsules', f), toast(t('Đã cất hộp thời gian')), onClose())}>{t('Lưu')}</button>
      </div>
    </Sheet>
  );
}
function CapsuleOpen({ c, today, onClose, onEdit }: { c: Capsule; today: string; onClose: () => void; onEdit: () => void }) {
  const [early, setEarly] = useState(false);
  const [del, setDel] = useState(false);
  const ready = today >= c.unlockDate || c.openedEarly;
  return (
    <Sheet open onClose={onClose} title={c.title || t('Hộp thời gian')} full>
      {!ready ? (
        <div className="stack center">
          <p className="display big-quote">{t('⏳ Chưa đến ngày mở')}</p>
          <p>{t('Hộp này sẽ mở vào')}{' '}<b>{c.unlockDate}</b>.</p>
          <button className="btn ghost" onClick={() => setEarly(true)}>{t('Mở sớm…')}</button>
          <button className="btn ghost small" onClick={onEdit}>{t('Sửa (sẽ thấy nội dung)')}</button>
        </div>
      ) : (
        <div className="stack">
          <Markup className="letter card" text={c.letter} />
          <div className="photo-stack">{c.blobIds.map((id) => <CapsuleMedia key={id} id={id} />)}</div>
          <div className="row gap"><button className="btn ghost" onClick={onEdit}>{t('Sửa')}</button><button className="btn danger ghost" onClick={() => setDel(true)}>{t('Xóa')}</button></div>
        </div>
      )}
      <Confirm open={early} title={t('Mở sớm hộp thời gian?')} body={t('Bất ngờ sẽ không còn nữa.')} confirmText={t('Mở sớm')} onConfirm={async () => { await db.put('capsules', { ...c, openedEarly: true }); onClose(); }} onClose={() => setEarly(false)} />
      <Confirm open={del} danger title={t('Xóa hộp thời gian?')} body={c.title} onConfirm={async () => (await db.del('capsules', c.id), onClose())} onClose={() => setDel(false)} />
    </Sheet>
  );
}
function CapsuleMedia({ id }: { id: string }) {
  const { url, mime } = useBlobUrl(id);
  if (!url) return null;
  return mime?.startsWith('video/') ? <video src={url} controls playsInline className="memory-photo" /> : <img src={url} className="memory-photo" alt="" />;
}

// ───────── Ending experience (only when the user chooses)
export function EndingPage() {
  const { journey: j, days, activities, places } = useJourney();
  const { reduced } = useApp();
  const mems = publicMemories(useStore<Memory>('memories', j.id));
  const [film, setFilm] = useState(false);
  const [shown, setShown] = useState(false);
  const photos = mems.flatMap((m) => m.photoBlobIds.map((id) => ({ id, caption: m.title })));
  return (
    <div className="page">
      <PageHeader title={t('Trang kết')} back={`/j/${j.id}/memories`} />
      {!shown ? (
        <div className="stack center">
          <p>{t('Trang kết chỉ được tạo khi bạn muốn. Nó dùng những kỷ niệm không riêng tư bạn đã viết.')}</p>
          <button className="btn primary" onClick={() => setShown(true)}>{t('Mở trang kết')}</button>
        </div>
      ) : (
        <div className="ending glass-card">
          <p className="display big-quote">{t('Until we meet again.')}</p>
          <h2 className="display">{j.title}</h2>
          <p>{days.length} {' '}{t('ngày ·')}{' '}{places.filter((p) => p.visitedAt).length} {' '}{t('nơi đã đóng dấu chân ·')}{' '}{activities.filter((a) => a.status === 'completed').length} {' '}{t('hoạt động đã hoàn thành ·')}{' '}{mems.length} {' '}{t('kỷ niệm')}</p>
          <div className="row gap-s wrap center">
            <button className="btn" disabled={!photos.length} onClick={() => setFilm(true)}>{t('▶︎ Memory Film (trong ứng dụng)')}</button>
            <button className="btn ghost" onClick={() => go(`/j/${j.id}/capsules`)}>{t('💌 Viết thư cho chính mình')}</button>
          </div>
          {!photos.length && <p className="muted xsmall">{t('Thêm ảnh vào kỷ niệm để xem Memory Film.')}</p>}
          <p className="muted xsmall">{t('Xuất video chưa được hỗ trợ — Memory Film chỉ phát trong ứng dụng.')}</p>
        </div>
      )}
      {film && <Cinema photos={photos} reduced={reduced} onClose={() => setFilm(false)} />}
    </div>
  );
}

// ───────── Keepsake export
export function ExportPage() {
  const { journey: j, days } = useJourney();
  const toast = useToast();
  const all = useStore<Memory>('memories', j.id);
  const vault = useVaultOpen();
  const [includePrivate, setIncludePrivate] = useState(false);
  const [printing, setPrinting] = useState(false);
  const [priv, setPriv] = useState<Record<string, { title: string; body: string }>>({});
  const chosen = all.filter((m) => m.privacy !== 'private' || (includePrivate && vault));
  useEffect(() => {
    if (!includePrivate || !vault) return;
    (async () => {
      const out: Record<string, { title: string; body: string }> = {};
      for (const m of all.filter((x) => x.encrypted)) out[m.id] = await readPrivateMemory(m);
      setPriv(out);
    })().catch(() => toast(t('Không giải mã được một số mục'), 'err'));
  }, [includePrivate, vault, all.length]);
  const printRef = useRef<HTMLDivElement | null>(null);

  const zipPhotos = async () => {
    const zip = new JSZip();
    let n = 0;
    for (const m of chosen) {
      if (m.privacy === 'private') continue; // photo zip never includes encrypted photos
      for (const id of m.photoBlobIds) {
        const r = await readBlob(id);
        if (r && !r.rec.encrypted) zip.file(`${String(++n).padStart(3, '0')}-${r.rec.name}`, await r.blob.arrayBuffer());
      }
    }
    if (!n) return toast(t('Không có ảnh để xuất'), 'warn');
    const blob = await zip.generateAsync({ type: 'blob' });
    downloadBlob(blob, `${j.title.replace(/[^\w\-]+/g, '_')}-album.zip`);
    toast(t('Đã tạo album {0} ảnh — hãy chọn nơi lưu', n));
  };

  return (
    <div className="page">
      <PageHeader title={t('Xuất kỷ niệm')} back={`/j/${j.id}/memories`} />
      <div className="stack no-print">
        <label className="toggle-row">
          <input type="checkbox" checked={includePrivate} onChange={(e: any) => setIncludePrivate(e.target.checked)} />
          {t('Bao gồm kỷ niệm riêng tư (phải chọn rõ ràng, cần mở Két)')}</label>
        {includePrivate && !vault && <p className="warn-box small">{t('Két đang khóa — nội dung riêng tư sẽ không được đưa vào.')}</p>}
        <p className="small">{t('Sẽ xuất')}{' '}{chosen.length} {' '}{t('kỷ niệm.')}</p>
        <button className="btn primary" onClick={() => { setPrinting(true); setTimeout(() => print(), 400); }}><LuDownload size={14} /> {' '}{t('Sách kỷ niệm → In / Lưu PDF')}</button>
        <button className="btn" onClick={zipPhotos}>{t('Album ảnh (.zip, chỉ ảnh không riêng tư)')}</button>
        <button className="btn" disabled title={t('Chưa hỗ trợ')}>{t('Video Memory Film — chưa hỗ trợ')}</button>
        <p className="muted xsmall">{t('PDF được tạo qua chức năng In của trình duyệt (trên iPhone: Chia sẻ → In → chụm ra để lưu PDF). Ảnh đã mã hóa không bao giờ được xuất khi Két khóa.')}</p>
      </div>
      {printing && (
        <div ref={printRef} className="print-book printable">
          <h1 className="display">{j.title}</h1>
          <p>{j.startDate} – {j.endDate}</p>
          {days.map((d) => {
            const list = chosen.filter((m) => m.dayId === d.id);
            if (!list.length) return null;
            return (
              <section key={d.id} className="print-day">
                <h2>{t('Ngày')}{' '}{d.index}: {d.title}</h2>
                {list.map((m) => {
                  const txt = m.encrypted ? priv[m.id] : { title: m.title, body: m.body };
                  if (!txt) return null;
                  return (
                    <article key={m.id}>
                      <h3>{txt.title}</h3>
                      <div className="print-photos">{m.photoBlobIds.map((id) => <BlobImg key={id} id={id} className="print-photo" />)}</div>
                      <Markup text={txt.body} />
                    </article>
                  );
                })}
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}
