import { useRef, useState } from 'react';
import { LuDownload, LuShare2, LuImage } from 'react-icons/lu';
import type { Memory } from '../../db/schema';
import { PageHeader, pickFiles, useBlobUrl, useStore, useToast } from '../../ui/core';
import { useJourney } from '../journey/JourneyShell';
import { ArtImg, useArtwork } from '../../ui/art';
import { artBlob } from '../../lib/artwork';
import { readBlob, saveFileAsBlob } from '../../db/repo';
import { publicMemories } from '../../lib/search';
import { t } from '../../lib/i18n';

const FRAME_IDS = ['frame-emerald', 'frame-burgundy', 'frame-polaroid', 'frame-celestial'];

/**
 * Memory frames: the photo sits UNDER the frame and is clipped by a mask shaped like the frame's opening.
 * Drag to move, zoom and rotate with sliders; export a NEW image (the original photo is never changed).
 */
export function FramesPage() {
  const { journey: j } = useJourney();
  const art = useArtwork();
  const toast = useToast();
  const photos = publicMemories(useStore<Memory>('memories', j.id)).flatMap((m) => m.photoBlobIds);
  const [frameSel, setFrame] = useState<string | null | undefined>(undefined); // undefined = first available frame
  const [photo, setPhoto] = useState<string | null>(null);
  const [tf, setTf] = useState({ x: 0, y: 0, zoom: 1, rot: 0 });
  const avail = FRAME_IDS.filter((f) => art.assets[f]);
  const frame = frameSel === undefined ? avail[0] ?? null : frameSel;
  const { url: photoUrl } = useBlobUrl(photo ?? undefined);
  const fa = frame ? art.assets[frame] : undefined;
  const { url: maskUrl } = useBlobUrl(artBlob(fa, 'mask'));
  const box = useRef<HTMLDivElement | null>(null);
  const drag = useRef<{ sx: number; sy: number; x: number; y: number } | null>(null);
  const aspect = fa ? fa.height / fa.width : 4 / 3;

  const pickOwn = async () => {
    const [f] = await pickFiles('image/*');
    if (f) { setPhoto((await saveFileAsBlob(f, f.name, j.id)).id); setTf({ x: 0, y: 0, zoom: 1, rot: 0 }); }
  };
  const render = async (): Promise<Blob | null> => {
    if (!photo) return null;
    const ph = await readBlob(photo);
    const fr = frame ? await readBlob(artBlob(fa, 'orig')!) : null;
    const mk = frame ? await readBlob(artBlob(fa, 'mask')!) : null;
    if (!ph) return null;
    const load = async (b: Blob) => { const u = URL.createObjectURL(b); const im = new Image(); im.src = u; await im.decode(); return im; };
    const pImg = await load(ph.blob);
    const W = fr ? (await load(fr.blob)).naturalWidth : 1200;
    const H = Math.round(W * aspect);
    const c = document.createElement('canvas'); c.width = W; c.height = H;
    const g = c.getContext('2d')!;
    // photo: cover-fit into the frame box, then user's pan/zoom/rotate (pan is relative to box size)
    const base = Math.max(W / pImg.naturalWidth, H / pImg.naturalHeight) * tf.zoom;
    g.save();
    g.translate(W / 2 + tf.x * W, H / 2 + tf.y * H);
    g.rotate((tf.rot * Math.PI) / 180);
    g.drawImage(pImg, (-pImg.naturalWidth * base) / 2, (-pImg.naturalHeight * base) / 2, pImg.naturalWidth * base, pImg.naturalHeight * base);
    g.restore();
    if (mk) { g.globalCompositeOperation = 'destination-in'; g.drawImage(await load(mk.blob), 0, 0, W, H); g.globalCompositeOperation = 'source-over'; }
    if (fr) g.drawImage(await load(fr.blob), 0, 0, W, H);
    return await new Promise((res) => c.toBlob((b) => res(b), 'image/png'));
  };
  const save = async (share: boolean) => {
    const b = await render();
    if (!b) return toast(t('Hãy chọn ảnh trước.'));
    const name = `chang-frame-${Date.now()}.png`;
    const file = new File([b], name, { type: 'image/png' });
    const nav: any = navigator;
    if (share && nav.canShare?.({ files: [file] })) { try { await nav.share({ files: [file] }); } catch { /* cancelled */ } return; }
    const a = document.createElement('a'); a.href = URL.createObjectURL(b); a.download = name; a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 4000);
    toast(t('Đã tạo ảnh mới — ảnh gốc không bị thay đổi.'));
  };

  const maskStyle = maskUrl ? { WebkitMaskImage: `url(${maskUrl})`, maskImage: `url(${maskUrl})`, WebkitMaskSize: '100% 100%', maskSize: '100% 100%' } : {};
  return (
    <div className="page">
      <PageHeader title={t('Khung ảnh kỷ niệm')} back={`/j/${j.id}/memories`} />
      {!avail.length && <p className="muted">{t('Khung ảnh Christmas Collection xuất hiện sau khi bạn nhập gói artwork (Cài đặt → Artwork).')}</p>}
      <div className="frame-choices" data-testid="frame-choices">
        {avail.map((f) => <button key={f} className={frame === f ? 'on' : ''} onClick={() => setFrame(f)} aria-label={art.assets[f].name}><ArtImg id={f} v="thumb" /></button>)}
        <button className={!frame ? 'on' : ''} onClick={() => setFrame(null)}>{t('Không khung')}</button>
      </div>
      <div ref={box} className="frame-stage" data-testid="frame-stage" style={{ aspectRatio: `1 / ${aspect}` }}
        onPointerDown={(e: any) => { (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId); drag.current = { sx: e.clientX, sy: e.clientY, x: tf.x, y: tf.y }; }}
        onPointerMove={(e: any) => { const d = drag.current; const r = box.current?.getBoundingClientRect(); if (!d || !r) return; setTf((v) => ({ ...v, x: d.x + (e.clientX - d.sx) / r.width, y: d.y + (e.clientY - d.sy) / r.height })); }}
        onPointerUp={() => (drag.current = null)} onPointerCancel={() => (drag.current = null)}>
        <div className="frame-photo" style={maskStyle}>
          {photoUrl ? <img src={photoUrl} alt="" draggable={false} style={{ transform: `translate(${tf.x * 100}%, ${tf.y * 100}%) rotate(${tf.rot}deg) scale(${tf.zoom})` }} /> : <span className="muted small">{t('Chọn ảnh bên dưới')}</span>}
        </div>
        {frame && <ArtImg id={frame} className="frame-over" />}
      </div>
      <div className="thumb-row">
        {photos.map((id) => <PhotoPick key={id} id={id} on={photo === id} onPick={() => { setPhoto(id); setTf({ x: 0, y: 0, zoom: 1, rot: 0 }); }} />)}
        <button className="btn small" onClick={pickOwn}><LuImage size={14} /> {t('Ảnh từ máy')}</button>
      </div>
      {photo && (
        <div className="card stack-s">
          <label className="small">{t('Phóng to')} <input type="range" min="0.5" max="3" step="0.02" value={tf.zoom} onChange={(e: any) => setTf({ ...tf, zoom: +e.target.value })} /></label>
          <label className="small">{t('Xoay')} <input type="range" min="-180" max="180" step="1" value={tf.rot} onChange={(e: any) => setTf({ ...tf, rot: +e.target.value })} /></label>
          <div className="row gap-s wrap">
            <button className="btn small ghost" onClick={() => setTf({ x: 0, y: 0, zoom: 1, rot: 0 })}>{t('Đặt lại')}</button>
            <button className="btn small primary" data-testid="frame-save" onClick={() => save(false)}><LuDownload size={14} /> {t('Lưu ảnh mới (PNG)')}</button>
            <button className="btn small" onClick={() => save(true)}><LuShare2 size={14} /> {t('Chia sẻ')}</button>
          </div>
        </div>
      )}
    </div>
  );
}
function PhotoPick({ id, on, onPick }: { id: string; on: boolean; onPick: () => void }) {
  const { url } = useBlobUrl(id);
  return <button className={`thumb-btn ${on ? 'on' : ''}`} onClick={onPick}>{url && <img className="thumb" src={url} alt="" />}</button>;
}
