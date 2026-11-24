import { useEffect, useMemo, useRef, useState } from 'react';
import { LuType, LuImage, LuSticker, LuCopy, LuArrowUp, LuArrowDown, LuTrash2, LuUndo2, LuDownload, LuShare2, LuPrinter } from 'react-icons/lu';
import { Sheet, pickFiles, useBlobUrl, useToast } from './core';
import { ArtImg, useArtwork } from './art';
import { artBlob } from '../lib/artwork';
import { readBlob, saveFileAsBlob } from '../db/repo';
import { t, tr } from '../lib/i18n';
import { uid } from '../lib/util';

export type LayerKind = 'text' | 'photo' | 'sticker';
export interface Layer {
  id: string;
  kind: LayerKind;
  x: number; // centre, relative 0..1
  y: number;
  w: number; // width relative to page width
  rot: number; // degrees
  opacity: number;
  text?: string;
  font?: FontKey;
  color?: string;
  size?: number; // font size relative to page width
  align?: 'left' | 'center' | 'right';
  blobId?: string; // photo (user's own, stored once)
  assetId?: string; // sticker from the library (artwork referenced, never copied)
  aspect?: number; // h / w for images
  frameId?: string; // photo shown inside one of the memory frames (artwork referenced, photo untouched)
}
export type FontKey = 'serif' | 'sans' | 'script' | 'cjk';
export const FONTS: Record<FontKey, { label: string; css: string }> = {
  serif: { label: tr('Serif cổ điển'), css: '"Cormorant Garamond", "Iowan Old Style", Georgia, "PingFang SC", "Apple SD Gothic Neo", serif' },
  sans: { label: tr('Không chân'), css: '-apple-system, "SF Pro Text", "Helvetica Neue", "PingFang SC", "Apple SD Gothic Neo", sans-serif' },
  script: { label: tr('Viết tay'), css: '"Snell Roundhand", "Bradley Hand", "Segoe Script", "PingFang SC", cursive' },
  cjk: { label: tr('Trung / Hàn'), css: '"PingFang SC", "Hiragino Sans GB", "Apple SD Gothic Neo", "Noto Sans CJK SC", sans-serif' },
};
const COLORS = ['#3a2a1a', '#103B31', '#8B1E2D', '#8a6a2f', '#D5B477', '#FFF8EE', '#1c1c1c'];

/** Background: an artwork id (e.g. 'postcard-shanghai', 'page') or a stored blob. */
export interface EditorBg { assetId?: string; blobId?: string; aspect: number; safe?: [number, number, number, number] }

export function newTextLayer(safe: [number, number, number, number] | undefined, text = ''): Layer {
  const [x0, y0, x1] = safe ?? [0.1, 0.12, 0.9, 0.85];
  return { id: uid('l'), kind: 'text', x: (x0 + x1) / 2, y: y0 + 0.12, w: x1 - x0, rot: 0, opacity: 1, text, font: 'serif', color: '#3a2a1a', size: 0.045, align: 'left' };
}

function LayerImg({ l }: { l: Layer }) {
  const art = useArtwork();
  const id = l.kind === 'sticker' ? artBlob(art.assets[l.assetId!], 'disp') : l.blobId;
  const { url } = useBlobUrl(id);
  const fa = l.kind === 'photo' && l.frameId ? art.assets[l.frameId] : undefined;
  const { url: frameUrl } = useBlobUrl(artBlob(fa, 'disp'));
  const { url: maskUrl } = useBlobUrl(artBlob(fa, 'mask'));
  if (!url) return <span className="layer-missing">?</span>;
  if (fa && frameUrl) {
    const m = maskUrl ? { WebkitMaskImage: `url(${maskUrl})`, maskImage: `url(${maskUrl})`, WebkitMaskSize: '100% 100%', maskSize: '100% 100%' } : {};
    return (
      <div className="le-framed" style={{ aspectRatio: `${fa.width} / ${fa.height}` }}>
        <div className="le-framed-photo" style={m}><img src={url} alt="" draggable={false} /></div>
        <img className="le-frame-over" src={frameUrl} alt="" draggable={false} />
      </div>
    );
  }
  return <img src={url} alt="" draggable={false} />;
}

/** Read-only rendering of a page (thumbnails & full-screen preview) — same layout as the editor. */
export function LayerPreview({ bg, layers, className = '' }: { bg: EditorBg; layers: Layer[]; className?: string }) {
  const art = useArtwork();
  const ref = useRef<HTMLDivElement | null>(null);
  const bgBlob = bg.assetId ? artBlob(art.assets[bg.assetId], 'disp') : bg.blobId;
  const { url } = useBlobUrl(bgBlob);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(() => el.style.setProperty('--le-w', `${el.clientWidth / 100}px`));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return (
    <div ref={ref} className={`le-stage le-preview ${className}`} style={{ aspectRatio: `1 / ${bg.aspect}` }}>
      {url ? <img className="le-bg" src={url} alt="" draggable={false} /> : <div className="le-bg le-bg-plain" />}
      {layers.map((l) => (
        <div key={l.id} className={`le-layer le-${l.kind}`} style={{ left: `${l.x * 100}%`, top: `${l.y * 100}%`, width: `${l.w * 100}%`, transform: `translate(-50%, -50%) rotate(${l.rot}deg)`, opacity: l.opacity }}>
          {l.kind === 'text' ? (l.text ? <div className="le-text" style={{ fontFamily: FONTS[l.font ?? 'serif'].css, color: l.color, fontSize: `calc(${(l.size ?? 0.045) * 100} * var(--le-w, 3.5px))`, textAlign: l.align }}>{l.text}</div> : null) : <LayerImg l={l} />}
        </div>
      ))}
    </div>
  );
}

/**
 * Layered page editor shared by Postcard Studio and Storybook. Every element (text, photo, sticker) stays editable;
 * the background artwork is never altered. Undo keeps the last 40 states.
 */
export function LayerEditor({ bg, layers, onChange, photoChoices = [], fileName, ownerJourneyId }: { bg: EditorBg; layers: Layer[]; onChange: (l: Layer[]) => void; photoChoices?: string[]; fileName: string; ownerJourneyId: string }) {
  const toast = useToast();
  const art = useArtwork();
  const stage = useRef<HTMLDivElement | null>(null);
  const [sel, setSel] = useState<string | null>(null);
  const [undo, setUndo] = useState<Layer[][]>([]);
  const [stickers, setStickers] = useState(false);
  const [photos, setPhotos] = useState(false);
  const drag = useRef<{ id: string; sx: number; sy: number; x: number; y: number; moved: boolean } | null>(null);
  const bgBlob = bg.assetId ? artBlob(art.assets[bg.assetId], 'disp') : bg.blobId;
  const { url: bgUrl } = useBlobUrl(bgBlob);
  const cur = layers.find((l) => l.id === sel);
  const charms = useMemo(() => Object.values(art.assets).filter((a) => a.group === 'charm'), [art]);
  const frames = useMemo(() => Object.values(art.assets).filter((a) => a.group === 'frame'), [art]);
  useEffect(() => {
    const el = stage.current;
    if (!el) return;
    const ro = new ResizeObserver(() => el.style.setProperty('--le-w', `${el.clientWidth / 100}px`));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const commit = (next: Layer[], record = true) => {
    if (record) setUndo((u) => [...u.slice(-39), layers]);
    onChange(next);
  };
  const patch = (p: Partial<Layer>, record = true) => cur && commit(layers.map((l) => (l.id === cur.id ? { ...l, ...p } : l)), record);
  const add = (l: Layer) => { commit([...layers, l]); setSel(l.id); };

  const onDown = (e: any, l: Layer) => {
    e.stopPropagation();
    setSel(l.id);
    (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
    drag.current = { id: l.id, sx: e.clientX, sy: e.clientY, x: l.x, y: l.y, moved: false };
  };
  const onMove = (e: any) => {
    const d = drag.current;
    const r = stage.current?.getBoundingClientRect();
    if (!d || !r) return;
    const nx = Math.min(1, Math.max(0, d.x + (e.clientX - d.sx) / r.width));
    const ny = Math.min(1, Math.max(0, d.y + (e.clientY - d.sy) / r.height));
    if (!d.moved) { setUndo((u) => [...u.slice(-39), layers]); d.moved = true; }
    onChange(layers.map((l) => (l.id === d.id ? { ...l, x: nx, y: ny } : l)));
  };
  const onUp = () => (drag.current = null);

  const addPhoto = async (blobId?: string) => {
    setPhotos(false);
    let id = blobId;
    if (!id) {
      const [f] = await pickFiles('image/*');
      if (!f) return;
      id = (await saveFileAsBlob(f, f.name, ownerJourneyId)).id; // stored once; original photo never modified
    }
    const r = await readBlob(id);
    let aspect = 0.75;
    if (r) try { const b = await createImageBitmap(r.blob); aspect = b.height / b.width; b.close?.(); } catch { /* keep default */ }
    add({ id: uid('l'), kind: 'photo', x: 0.5, y: 0.45, w: 0.5, rot: 0, opacity: 1, blobId: id, aspect });
  };
  const addSticker = (assetId: string) => {
    setStickers(false);
    const a = art.assets[assetId];
    add({ id: uid('l'), kind: 'sticker', x: 0.5, y: 0.5, w: 0.22, rot: 0, opacity: 1, assetId, aspect: a ? a.height / a.width : 1 });
  };
  const z = (dir: 1 | -1) => {
    if (!cur) return;
    const i = layers.findIndex((l) => l.id === cur.id);
    const j = i + dir;
    if (j < 0 || j >= layers.length) return;
    const next = [...layers];
    [next[i], next[j]] = [next[j], next[i]];
    commit(next);
  };

  const exportPng = async (): Promise<Blob | null> => {
    try {
      return await renderLayers(bgBlob, bg.aspect, layers, (id) => artBlob(art.assets[id], 'orig'), (id) => ({ frame: artBlob(art.assets[id], 'orig'), mask: artBlob(art.assets[id], 'mask') }));
    } catch {
      toast(t('Không xuất được ảnh.'));
      return null;
    }
  };
  const download = async () => {
    const b = await exportPng();
    if (!b) return;
    const a = document.createElement('a');
    a.href = URL.createObjectURL(b);
    a.download = `${fileName}.png`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 4000);
    toast(t('Đã tạo tệp PNG — kiểm tra mục Tải về / Tệp.'));
  };
  const share = async () => {
    const b = await exportPng();
    if (!b) return;
    const file = new File([b], `${fileName}.png`, { type: 'image/png' });
    const nav: any = navigator;
    if (nav.canShare?.({ files: [file] })) {
      try { await nav.share({ files: [file] }); } catch { /* cancelled */ }
    } else toast(t('Thiết bị không hỗ trợ chia sẻ tệp — hãy dùng “Lưu PNG”.'));
  };
  const printPdf = async () => {
    const b = await exportPng();
    if (!b) return;
    const u = URL.createObjectURL(b);
    const w = open('', '_blank');
    if (!w) return toast(t('Không mở được cửa sổ in.'));
    w.document.write(`<title>${fileName}</title><style>@page{margin:0}body{margin:0}img{width:100%;display:block}</style><img src="${u}" onload="setTimeout(()=>print(),300)">`);
  };

  return (
    <div className="layer-editor" data-testid="layer-editor">
      <div className="le-stage-wrap">
        <div ref={stage} className="le-stage" style={{ aspectRatio: `1 / ${bg.aspect}` }} onPointerDown={() => setSel(null)} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp}>
          {bgUrl ? <img className="le-bg" src={bgUrl} alt="" draggable={false} /> : <div className="le-bg le-bg-plain" />}
          {bg.safe && sel && cur?.kind === 'text' && <div className="le-safe" style={{ left: `${bg.safe[0] * 100}%`, top: `${bg.safe[1] * 100}%`, width: `${(bg.safe[2] - bg.safe[0]) * 100}%`, height: `${(bg.safe[3] - bg.safe[1]) * 100}%` }} />}
          {layers.map((l) => (
            <div
              key={l.id}
              className={`le-layer le-${l.kind} ${sel === l.id ? 'sel' : ''}`}
              data-testid={`layer-${l.kind}`}
              style={{ left: `${l.x * 100}%`, top: `${l.y * 100}%`, width: `${l.w * 100}%`, transform: `translate(-50%, -50%) rotate(${l.rot}deg)`, opacity: l.opacity }}
              onPointerDown={(e: any) => onDown(e, l)}
            >
              {l.kind === 'text' ? (
                <div className="le-text" style={{ fontFamily: FONTS[l.font ?? 'serif'].css, color: l.color, fontSize: `calc(${(l.size ?? 0.045) * 100} * var(--le-w, 3.5px))`, textAlign: l.align }}>{l.text || t('Chạm để viết…')}</div>
              ) : (
                <LayerImg l={l} />
              )}
            </div>
          ))}
        </div>
      </div>

      <div className="le-tools row gap-s wrap">
        <button className="btn small" onClick={() => add(newTextLayer(bg.safe))}><LuType size={14} /> {t('Chữ')}</button>
        <button className="btn small" onClick={() => (photoChoices.length ? setPhotos(true) : addPhoto())}><LuImage size={14} /> {t('Ảnh')}</button>
        <button className="btn small" data-testid="le-stickers" onClick={() => setStickers(true)}><LuSticker size={14} /> {t('Sticker')}</button>
        <button className="btn small ghost" disabled={!undo.length} onClick={() => { onChange(undo[undo.length - 1]); setUndo((u) => u.slice(0, -1)); }} aria-label={t('Hoàn tác')}><LuUndo2 size={14} /> {t('Hoàn tác')}</button>
      </div>

      {cur && (
        <div className="le-props card" data-testid="le-props">
          {cur.kind === 'text' && (
            <>
              <textarea data-testid="le-text" rows={3} value={cur.text ?? ''} placeholder={t('Viết lời nhắn…')} onChange={(e: any) => patch({ text: e.target.value }, false)} onBlur={() => patch({}, true)} />
              <div className="row gap-s wrap">
                <select value={cur.font} onChange={(e: any) => patch({ font: e.target.value })}>{(Object.keys(FONTS) as FontKey[]).map((k) => <option key={k} value={k}>{t(FONTS[k].label)}</option>)}</select>
                <select value={cur.align} onChange={(e: any) => patch({ align: e.target.value })}>
                  <option value="left">{t('Căn trái')}</option><option value="center">{t('Căn giữa')}</option><option value="right">{t('Căn phải')}</option>
                </select>
              </div>
              <div className="le-colors">{COLORS.map((c) => <button key={c} aria-label={c} className={cur.color === c ? 'on' : ''} style={{ background: c }} onClick={() => patch({ color: c })} />)}</div>
              <label className="small">{t('Cỡ chữ')} <input type="range" min="0.02" max="0.12" step="0.002" value={cur.size ?? 0.045} onChange={(e: any) => patch({ size: +e.target.value }, false)} /></label>
            </>
          )}
          {cur.kind === 'photo' && frames.length > 0 && (
            <div className="le-frame-pick" data-testid="le-frame-pick">
              <button className={!cur.frameId ? 'on' : ''} onClick={() => patch({ frameId: undefined })}>{t('Không khung')}</button>
              {frames.map((f) => <button key={f.id} className={cur.frameId === f.id ? 'on' : ''} aria-label={f.name} onClick={() => patch({ frameId: f.id })}><ArtImg id={f.id} v="thumb" /></button>)}
            </div>
          )}
          <label className="small">{t('Kích thước')} <input type="range" min="0.06" max="1" step="0.01" value={cur.w} onChange={(e: any) => patch({ w: +e.target.value }, false)} /></label>
          <label className="small">{t('Xoay')} <input type="range" min="-180" max="180" step="1" value={cur.rot} onChange={(e: any) => patch({ rot: +e.target.value }, false)} /></label>
          <label className="small">{t('Độ trong suốt')} <input type="range" min="0.1" max="1" step="0.05" value={cur.opacity} onChange={(e: any) => patch({ opacity: +e.target.value }, false)} /></label>
          <div className="row gap-s wrap">
            <button className="btn small ghost" onClick={() => add({ ...cur, id: uid('l'), x: Math.min(0.95, cur.x + 0.04), y: Math.min(0.95, cur.y + 0.04) })}><LuCopy size={14} /> {t('Nhân bản')}</button>
            <button className="btn small ghost" onClick={() => z(1)}><LuArrowUp size={14} /> {t('Lên lớp trên')}</button>
            <button className="btn small ghost" onClick={() => z(-1)}><LuArrowDown size={14} /> {t('Xuống lớp dưới')}</button>
            <button className="btn small danger" onClick={() => { commit(layers.filter((l) => l.id !== cur.id)); setSel(null); }}><LuTrash2 size={14} /> {t('Xóa')}</button>
          </div>
        </div>
      )}

      <div className="row gap-s wrap">
        <button className="btn small" data-testid="le-png" onClick={download}><LuDownload size={14} /> {t('Lưu PNG')}</button>
        <button className="btn small" onClick={share}><LuShare2 size={14} /> {t('Chia sẻ')}</button>
        <button className="btn small ghost" onClick={printPdf}><LuPrinter size={14} /> {t('In / PDF')}</button>
      </div>
      <p className="xsmall muted">{t('“In / PDF” mở hộp thoại in của iPhone — chọn “Lưu vào Tệp” để có tệp PDF.')}</p>

      <Sheet open={stickers} onClose={() => setStickers(false)} title={t('Sticker')}>
        {charms.length ? (
          <div className="sticker-grid" data-testid="sticker-library">
            {charms.map((c) => (
              <button key={c.id} onClick={() => addSticker(c.id)} aria-label={c.name}><ArtImg id={c.id} v="thumb" /></button>
            ))}
          </div>
        ) : (
          <p className="muted">{t('Chưa có sticker. Nhập gói artwork trong Cài đặt → Artwork.')}</p>
        )}
      </Sheet>
      <Sheet open={photos} onClose={() => setPhotos(false)} title={t('Chọn ảnh')}>
        <div className="sticker-grid">
          {photoChoices.map((id) => <PhotoChoice key={id} id={id} onPick={() => addPhoto(id)} />)}
        </div>
        <button className="btn small" onClick={() => addPhoto()}>{t('Chọn ảnh khác từ máy…')}</button>
      </Sheet>
    </div>
  );
}

function PhotoChoice({ id, onPick }: { id: string; onPick: () => void }) {
  const { url } = useBlobUrl(id);
  return <button onClick={onPick}>{url && <img src={url} alt="" />}</button>;
}

async function loadImg(blobId: string | undefined): Promise<HTMLImageElement | null> {
  if (!blobId) return null;
  const r = await readBlob(blobId);
  if (!r) return null;
  const u = URL.createObjectURL(r.blob);
  const img = new Image();
  img.src = u;
  await img.decode();
  return img;
}

/** Render background + layers into a PNG (background drawn at its own resolution, capped at 2400 px). */
export async function renderLayers(bgBlob: string | undefined, aspect: number, layers: Layer[], stickerBlob: (assetId: string) => string | undefined, frameBlobs?: (frameId: string) => { frame?: string; mask?: string }): Promise<Blob> {
  const bgImg = await loadImg(bgBlob);
  const W = Math.min(2400, bgImg?.naturalWidth ?? 1600);
  const H = Math.round(W * aspect);
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  const g = c.getContext('2d')!;
  if (bgImg) g.drawImage(bgImg, 0, 0, W, H);
  else { g.fillStyle = '#FFF8EE'; g.fillRect(0, 0, W, H); }
  for (const l of layers) {
    g.save();
    g.globalAlpha = l.opacity;
    g.translate(l.x * W, l.y * H);
    g.rotate((l.rot * Math.PI) / 180);
    const w = l.w * W;
    if (l.kind === 'text') {
      const fs = (l.size ?? 0.045) * W;
      g.font = `${fs}px ${FONTS[l.font ?? 'serif'].css}`;
      g.fillStyle = l.color ?? '#3a2a1a';
      g.textAlign = l.align ?? 'left';
      g.textBaseline = 'top';
      const lines = wrap(g, l.text ?? '', w);
      const lh = fs * 1.35;
      const x = l.align === 'center' ? 0 : l.align === 'right' ? w / 2 : -w / 2;
      const top = (-lines.length * lh) / 2;
      lines.forEach((ln, i) => g.fillText(ln, x, top + i * lh));
    } else if (l.kind === 'photo' && l.frameId && frameBlobs) {
      const fb = frameBlobs(l.frameId);
      const [ph, fr, mk] = await Promise.all([loadImg(l.blobId), loadImg(fb.frame), loadImg(fb.mask)]);
      if (ph && fr) {
        const h = w * (fr.naturalHeight / fr.naturalWidth);
        const off = document.createElement('canvas');
        off.width = Math.round(w);
        off.height = Math.round(h);
        const o = off.getContext('2d')!;
        const sc = Math.max(off.width / ph.naturalWidth, off.height / ph.naturalHeight);
        o.drawImage(ph, (off.width - ph.naturalWidth * sc) / 2, (off.height - ph.naturalHeight * sc) / 2, ph.naturalWidth * sc, ph.naturalHeight * sc);
        if (mk) { o.globalCompositeOperation = 'destination-in'; o.drawImage(mk, 0, 0, off.width, off.height); o.globalCompositeOperation = 'source-over'; }
        o.drawImage(fr, 0, 0, off.width, off.height);
        g.drawImage(off, -w / 2, -h / 2, w, h);
      }
    } else {
      const img = await loadImg(l.kind === 'sticker' ? stickerBlob(l.assetId!) : l.blobId);
      if (img) {
        const h = w * (img.naturalHeight / img.naturalWidth);
        g.drawImage(img, -w / 2, -h / 2, w, h);
      }
    }
    g.restore();
  }
  return await new Promise<Blob>((res, rej) => c.toBlob((b) => (b ? res(b) : rej(new Error('toBlob'))), 'image/png'));
}
function wrap(g: CanvasRenderingContext2D, text: string, max: number): string[] {
  const out: string[] = [];
  for (const para of text.split('\n')) {
    const cjk = /[぀-鿿가-힯]/.test(para);
    const tokens = cjk ? [...para] : para.split(/(\s+)/);
    let line = '';
    for (const tk of tokens) {
      const test = line + tk;
      if (g.measureText(test).width > max && line) { out.push(line.trimEnd()); line = tk.trimStart(); }
      else line = test;
    }
    out.push(line);
  }
  return out;
}
