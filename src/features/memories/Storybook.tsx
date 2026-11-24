import { useEffect, useState } from 'react';
import { LuPlus, LuCopy, LuArrowUp, LuArrowDown, LuTrash2, LuPencil } from 'react-icons/lu';
import type { Memory, StoryPage } from '../../db/schema';
import * as db from '../../db/idb';
import { Confirm, PageHeader, Sheet, useStore, useToast } from '../../ui/core';
import { useJourney } from '../journey/JourneyShell';
import { useArtwork, ArtImg } from '../../ui/art';
import { JourneyCover } from '../../ui/Cover';
import { LayerEditor, LayerPreview, newTextLayer, type Layer } from '../../ui/LayerEditor';
import { publicMemories } from '../../lib/search';
import { nowIso, uid } from '../../lib/util';
import { t } from '../../lib/i18n';
import { useApp } from '../../ui/app-context';

const SAFE_DEFAULT: [number, number, number, number] = [0.1, 0.13, 0.9, 0.74];

/** Storybook: diary cover (gentle opening, skippable, once per session) and editable pages on the approved paper. */
export function StorybookPage() {
  const { journey: j } = useJourney();
  const { reduced: reducedMotion } = useApp();
  const art = useArtwork();
  const toast = useToast();
  const pages = useStore<StoryPage>('storypages', j.id).slice().sort((a, b) => a.index - b.index);
  const photos = publicMemories(useStore<Memory>('memories', j.id)).flatMap((m) => m.photoBlobIds);
  const seenKey = `chang-storybook-opened-${j.id}`;
  const [opened, setOpened] = useState(() => { try { return sessionStorage.getItem(seenKey) === '1'; } catch { return true; } });
  const [turning, setTurning] = useState(false);
  const [edit, setEdit] = useState<string | null>(null);
  const [del, setDel] = useState<StoryPage | null>(null);
  const [view, setView] = useState<string | null>(null);
  const page = art.assets['page'];
  const safe = (page?.safe as [number, number, number, number] | undefined) ?? SAFE_DEFAULT;
  const aspect = page ? page.height / page.width : 1448 / 1086;

  const open = () => {
    try { sessionStorage.setItem(seenKey, '1'); } catch { /* */ }
    if (reducedMotion) return setOpened(true);
    setTurning(true);
    setTimeout(() => setOpened(true), 900);
  };
  const add = async (copyOf?: StoryPage) => {
    const p: StoryPage = { id: uid('sp'), journeyId: j.id, index: (pages.at(-1)?.index ?? 0) + 1, bgAssetId: 'page', createdAt: nowIso(), updatedAt: nowIso(),
      layers: copyOf ? (copyOf.layers as Layer[]).map((l) => ({ ...l, id: uid('l') })) : [{ ...newTextLayer(safe), y: safe[1] + 0.06, size: 0.05, font: 'script' as const }, { ...newTextLayer(safe), y: safe[1] + 0.3 }] };
    await db.put('storypages', p);
    if (!copyOf) setEdit(p.id);
    toast(copyOf ? t('Đã nhân bản trang') : t('Đã thêm trang'));
  };
  const move = async (p: StoryPage, dir: -1 | 1) => {
    const i = pages.findIndex((x) => x.id === p.id);
    const q = pages[i + dir];
    if (!q) return;
    await db.put('storypages', { ...p, index: q.index });
    await db.put('storypages', { ...q, index: p.index });
  };

  if (!opened)
    return (
      <div className="page storybook-intro area-paper">
        <PageHeader title={t('Storybook')} back={`/j/${j.id}/memories`} />
        <p className="muted center small">{t('Nhật ký của chuyến đi — chạm vào bìa để mở')}</p>
        <button className={`book-cover ${turning ? 'turning' : ''}`} data-testid="storybook-cover" onClick={open} aria-label={t('Mở sách')}>
          <span className="book-inner" aria-hidden="true">{page ? <ArtImg id="page" v="disp" /> : <span className="le-bg-plain" />}</span>
          <span className="book-front"><JourneyCover journey={j} /></span>
        </button>
        <div className="row gap-s center-row">
          <button className="btn primary" onClick={open}>{t('Mở sách')}</button>
          <button className="btn ghost" data-testid="storybook-skip" onClick={() => { try { sessionStorage.setItem(seenKey, '1'); } catch { /* */ } setOpened(true); }}>{t('Bỏ qua')}</button>
        </div>
      </div>
    );

  const cur = pages.find((p) => p.id === edit);
  return (
    <div className="page area-paper">
      <PageHeader title={t('Storybook')} sub={t('{0} trang', pages.length)} back={`/j/${j.id}/memories`} />
      {!page && <p className="xsmall muted">{t('Giấy trang nhật ký Christmas Collection xuất hiện sau khi bạn nhập gói artwork (Cài đặt → Artwork).')}</p>}
      <div className="story-pages" data-testid="story-pages">
        {pages.map((p, i) => (
          <figure key={p.id} className="story-thumb">
            <button className="story-thumb-img" data-testid="story-thumb" onClick={() => setView(p.id)} aria-label={t('Xem trang {0}', i + 1)}>
              <LayerPreview bg={{ assetId: p.bgAssetId, aspect, safe }} layers={p.layers as Layer[]} />
            </button>
            <figcaption className="row gap-s wrap">
              <span className="xsmall muted">{t('Trang {0}', i + 1)}</span>
              <button className="icon-btn" aria-label={t('Sửa')} onClick={() => setEdit(p.id)}><LuPencil size={14} /></button>
              <button className="icon-btn" aria-label={t('Nhân bản')} onClick={() => add(p)}><LuCopy size={14} /></button>
              <button className="icon-btn" aria-label={t('Lên trên')} disabled={i === 0} onClick={() => move(p, -1)}><LuArrowUp size={14} /></button>
              <button className="icon-btn" aria-label={t('Xuống dưới')} disabled={i === pages.length - 1} onClick={() => move(p, 1)}><LuArrowDown size={14} /></button>
              <button className="icon-btn" aria-label={t('Xóa')} onClick={() => setDel(p)}><LuTrash2 size={14} /></button>
            </figcaption>
          </figure>
        ))}
      </div>
      <button className="btn primary" data-testid="story-add" onClick={() => add()}><LuPlus size={14} /> {t('Thêm trang')}</button>
      <p className="xsmall muted">{t('Nếu chữ dài hơn khung, hãy thêm trang mới thay vì thu nhỏ chữ. Chữ nên nằm trong vùng giữa, tránh họa tiết ở các góc.')}</p>
      {!pages.length && (
        <div className="story-empty card">
          <p>{t('Chưa có trang nào. Bấm “Thêm trang” để bắt đầu viết trên giấy nhật ký — thêm ảnh, khung ảnh và sticker tùy thích.')}</p>
        </div>
      )}
      {view && (() => {
        const vp = pages.find((p) => p.id === view);
        if (!vp) return null;
        const i = pages.indexOf(vp);
        return (
          <Sheet open onClose={() => setView(null)} title={t('Trang {0}', i + 1)} full>
            <div className="story-view" data-testid="story-view">
              <LayerPreview bg={{ assetId: vp.bgAssetId, aspect, safe }} layers={vp.layers as Layer[]} />
              <div className="row gap-s wrap center-row">
                <button className="btn small ghost" disabled={i === 0} onClick={() => setView(pages[i - 1].id)}>‹ {t('Trang trước')}</button>
                <button className="btn small primary" onClick={() => { setView(null); setEdit(vp.id); }}><LuPencil size={14} /> {t('Sửa')}</button>
                <button className="btn small ghost" disabled={i === pages.length - 1} onClick={() => setView(pages[i + 1].id)}>{t('Trang sau')} ›</button>
              </div>
            </div>
          </Sheet>
        );
      })()}
      {cur && <PageEditor p={cur} aspect={aspect} safe={safe} photos={photos} onClose={() => setEdit(null)} />}
      <Confirm open={!!del} danger title={t('Xóa trang này?')} body={t('Chỉ xóa trang; ảnh gốc của bạn vẫn giữ nguyên.')} onConfirm={async () => void (del && (await db.del('storypages', del.id)))} onClose={() => setDel(null)} />
    </div>
  );
}

function PageEditor({ p, aspect, safe, photos, onClose }: { p: StoryPage; aspect: number; safe: [number, number, number, number]; photos: string[]; onClose: () => void }) {
  const [layers, setLayers] = useState<Layer[]>(p.layers as Layer[]);
  useEffect(() => {
    const h = setTimeout(() => db.put('storypages', { ...p, layers, updatedAt: nowIso() }), 400);
    return () => clearTimeout(h);
  }, [layers]);
  return (
    <Sheet open onClose={onClose} title={t('Trang nhật ký')} full>
      <LayerEditor bg={{ assetId: p.bgAssetId, aspect, safe }} layers={layers} onChange={setLayers} photoChoices={photos} fileName={`storybook-${p.id}`} ownerJourneyId={p.journeyId} />
      <p className="xsmall muted">{t('Bản nháp tự lưu trên máy.')}</p>
    </Sheet>
  );
}
