import { useState } from 'react';
import { createPortal } from 'react-dom';
import { LuHeart, LuPlus, LuImage, LuFan, LuUser, LuHeartHandshake, LuFootprints, LuMoonStar, LuBuilding2, LuSnowflake, LuCamera, LuHand, LuPersonStanding, LuFrame, LuSun, LuPencil, LuX, LuChevronLeft, LuChevronRight } from 'react-icons/lu';
import type { Activity, Pose } from '../../db/schema';
import { db, saveFileAsBlob, updateJourneySettings } from '../../db/repo';
import { BlobImg, Confirm, Field, go, PageHeader, pickFiles, queryParam, Sheet, useStore, useToast } from '../../ui/core';
import { useJourney } from './JourneyShell';
import { uid } from '../../lib/util';
import { t, tr } from '../../lib/i18n';
import { Tx } from '../../ui/contentTx';

const CAT_ICON: Record<Pose['category'], any> = { hanfu: LuFan, portrait: LuUser, couple: LuHeartHandshake, street: LuFootprints, night: LuMoonStar, architecture: LuBuilding2, seasonal: LuSnowflake };
function CatIcon({ c, size = 18 }: { c: Pose['category']; size?: number }) {
  const I = CAT_ICON[c] ?? LuCamera;
  return <I size={size} />;
}
export const DEFAULT_ALBUMS = [tr('Thượng Hải'), tr('Giáng sinh'), tr('Hán phục'), tr('Tô Châu'), tr('Hàng Châu'), tr('Thiên văn')];
export const POSE_CATS: Record<Pose['category'], string> = { hanfu: tr('Hán phục'), portrait: tr('Chân dung'), couple: tr('Đôi (tự chọn)'), street: tr('Đường phố'), night: tr('Ban đêm'), architecture: tr('Kiến trúc'), seasonal: tr('Theo mùa') };

export function PoseTab() {
  const { journey: j, activities } = useJourney();
  const poses = useStore<Pose>('poses', j.id);
  const [cat, setCat] = useState<string>('all');
  const [open, setOpen] = useState<string | null>(queryParam('p'));
  const [creating, setCreating] = useState(false);
  const [album, setAlbum] = useState<string | null>(null);
  const [newAlbum, setNewAlbum] = useState<string | null>(null);
  const toast = useToast();
  const albums = Array.from(new Set([...DEFAULT_ALBUMS, ...(j.settings.poseAlbums ?? []), ...(poses.map((p) => p.album).filter(Boolean) as string[])]));
  const list = poses.filter((p) => (cat === 'all' || (cat === 'fav' ? p.favorite : p.category === cat)) && (!album || p.album === album));
  const photoPoses = list.filter((p) => p.refBlobIds.length > 0);
  const ideaPoses = list.filter((p) => !p.refBlobIds.length);
  const importMany = async () => {
    const fs = await pickFiles('image/*', true);
    if (!fs.length) return;
    let n = poses.filter((p) => p.album === album).length;
    for (const file of fs) {
      const rec = await saveFileAsBlob(file, file.name, j.id);
      n++;
      await db.put('poses', { id: uid('pose'), journeyId: j.id, category: 'portrait', title: `${album ? t(album) : t('Ảnh tham khảo')} · ${n}`, description: '', favorite: false, notes: '', refBlobIds: [rec.id], activityIds: [], builtin: false, album: album ?? undefined } satisfies Pose);
    }
    toast(t('Đã nhập {0} ảnh vào album.', fs.length));
  };
  const sel = poses.find((p) => p.id === open);
  return (
    <div className="page area-album">
      <PageHeader title={t('pose')} sub={t('Cảm hứng & kế hoạch chụp ảnh')} right={<button className="icon-btn" aria-label={t('Thêm dáng')} onClick={() => setCreating(true)}><LuPlus size={20} /></button>} />
      <div className="seg scroll-x">
        <button className={cat === 'all' ? 'on' : ''} onClick={() => setCat('all')}>{t('Tất cả')}</button>
        <button className={cat === 'fav' ? 'on' : ''} onClick={() => setCat('fav')}>{t('♥ Yêu thích')}</button>
        {Object.entries(POSE_CATS).map(([k, l]) => <button key={k} className={cat === k ? 'on' : ''} onClick={() => setCat(k)}>{t(l)}</button>)}
      </div>
      <div className="seg scroll-x albums" data-testid="pose-albums">
        <button className={!album ? 'on' : ''} onClick={() => setAlbum(null)}>{t('Mọi album')}</button>
        {albums.map((a) => <button key={a} className={album === a ? 'on' : ''} onClick={() => setAlbum(a)}>{t(a)}</button>)}
        <button data-testid="album-new" onClick={() => setNewAlbum('')}>{t('+ Album')}</button>
      </div>
      <button className="btn primary pose-import" data-testid="album-import" onClick={importMany}>
        <LuImage size={16} /> {album ? t('Nhập nhiều ảnh vào “{0}”', t(album)) : t('Nhập nhiều ảnh tham khảo')}
      </button>
      {photoPoses.length > 0 && (
        <div className="pose-grid" data-testid="pose-album-grid">
          {photoPoses.map((p) => (
            <button key={p.id} className={`pose-card cat-${p.category}`} onClick={() => setOpen(p.id)}>
              <BlobImg id={p.refBlobIds[0]} className="pose-img" />
              <span className="pose-meta">
                <span className="pose-cat">{p.album ? t(p.album) : t(POSE_CATS[p.category])}{p.refBlobIds.length > 1 ? ` · ${p.refBlobIds.length}` : ''}</span>
                <b><Tx s="poses" r={p} f="title" /></b>
              </span>
              {p.favorite && <span className="fav" aria-label={t('♥ Yêu thích')}><LuHeart size={16} /></span>}
            </button>
          ))}
        </div>
      )}
      {ideaPoses.length > 0 && (
        <section className="pose-ideas" data-testid="pose-ideas">
          <h3 className="section-title">{photoPoses.length ? t('Ý tưởng chưa có ảnh') : t('Ý tưởng tạo dáng')}</h3>
          {ideaPoses.map((p) => (
            <button key={p.id} className="pose-row" onClick={() => setOpen(p.id)}>
              <span className="pose-row-ic"><CatIcon c={p.category} size={20} /></span>
              <span className="grow">
                <b><Tx s="poses" r={p} f="title" /></b>
                <span className="small muted block clamp-1"><Tx s="poses" r={p} f="description" /></span>
              </span>
              {p.favorite && <LuHeart size={14} />}
            </button>
          ))}
        </section>
      )}
      {!list.length && <p className="muted center">{t('Chưa có dáng nào trong mục này.')}</p>}
      {sel && <PoseSheet p={sel} acts={activities} onClose={() => setOpen(null)} />}
      <Sheet open={newAlbum != null} onClose={() => setNewAlbum(null)} title={t('Album mới')}>
        <div className="stack-s">
          <Field label={t('Tên album')}><input data-testid="album-name" value={newAlbum ?? ''} onChange={(e: any) => setNewAlbum(e.target.value)} /></Field>
          <button className="btn primary" disabled={!newAlbum?.trim()} onClick={async () => { const n = newAlbum!.trim(); await updateJourneySettings(j.id, { poseAlbums: Array.from(new Set([...(j.settings.poseAlbums ?? []), n])) }); setAlbum(n); setNewAlbum(null); }}>{t('Tạo album')}</button>
        </div>
      </Sheet>
      {creating && (
        <PoseSheet
          p={{ id: uid('pose'), journeyId: j.id, category: 'portrait', title: '', description: '', favorite: false, notes: '', refBlobIds: [], activityIds: [], builtin: false }}
          acts={activities}
          isNew
          onClose={() => setCreating(false)}
        />
      )}
    </div>
  );
}

const GUIDE: [keyof Pose, string, any][] = [
  ['hands', tr('Tay'), LuHand], ['body', tr('Dáng người'), LuPersonStanding], ['camera', tr('Góc máy'), LuCamera], ['framing', tr('Khung hình'), LuFrame], ['lighting', tr('Ánh sáng'), LuSun],
];

function PoseView({ p, acts, onEdit, onClose }: { p: Pose; acts: Activity[]; onEdit: () => void; onClose: () => void }) {
  const [full, setFull] = useState<number | null>(null);
  const linked = p.activityIds.map((id) => acts.find((a) => a.id === id)).filter(Boolean) as Activity[];
  return (
    <Sheet open onClose={onClose} title={<Tx s="poses" r={p} f="title" />} full>
      <div className="stack pose-view" data-testid="pose-view">
        <div className="row gap-s wrap">
          <span className="status-pill"><CatIcon c={p.category} size={13} /> {' '}{t(POSE_CATS[p.category])}</span>
          <button className={`btn small ${p.favorite ? 'primary' : 'ghost'}`} data-testid="pose-fav" onClick={() => db.put('poses', { ...p, favorite: !p.favorite })}><LuHeart size={14} /> {' '}{p.favorite ? t('Đã yêu thích') : t('♥ Yêu thích')}</button>
        </div>
        {p.refBlobIds.length > 0 ? (
          <div className="pose-photos">{p.refBlobIds.map((id, i) => <BlobImg key={id} id={id} className="pose-photo" onClick={() => setFull(i)} />)}</div>
        ) : (
          <div className="pose-ph big"><CatIcon c={p.category} size={36} /><span className="pose-ph-add">{t('Chưa có ảnh tham khảo — bấm “Sửa” để thêm ảnh của bạn.')}</span></div>
        )}
        {p.description && <div className="card user-text"><h4>{t('Mô tả')}</h4><p><Tx s="poses" r={p} f="description" /></p></div>}
        {GUIDE.some(([k]) => p[k]) && (
          <div className="card pose-guide">
            {GUIDE.filter(([k]) => p[k]).map(([k, l, I]) => (
              <div key={k} className="pose-guide-row"><span className="tl-kind"><I size={15} /></span><span><b>{t(l)}</b><br /><Tx s="poses" r={p} f={k} /></span></div>
            ))}
          </div>
        )}
        {p.notes && <div className="card user-text"><h4>📝 {t('Ghi chú cá nhân')}</h4><p><Tx s="poses" r={p} f="notes" /></p></div>}
        {linked.length > 0 && (
          <div className="card">
            <h4>{t('Liên kết với hoạt động')}</h4>
            {linked.map((a) => <button key={a.id} className="list-row" onClick={() => go(`/j/${p.journeyId}/journey/${a.dayId}?a=${a.id}`)}>→ <Tx s="activities" r={a} f="title" /></button>)}
          </div>
        )}
        <button className="btn" data-testid="pose-edit" onClick={onEdit}><LuPencil size={14} /> {' '}{t('Sửa')}</button>
      </div>
      {full != null && <PhotoViewer ids={p.refBlobIds} start={full} onClose={() => setFull(null)} />}
    </Sheet>
  );
}

function PhotoViewer({ ids, start, onClose }: { ids: string[]; start: number; onClose: () => void }) {
  const [i, setI] = useState(start);
  const [zoom, setZoom] = useState(1);
  return createPortal(
    <div className="viewer" role="dialog" aria-modal="true" data-testid="pose-fullscreen">
      <div className="viewer-bar">
        <button className="icon-btn" aria-label={t('Đóng')} onClick={onClose}><LuX size={22} /></button>
        <span className="grow center small">{i + 1}/{ids.length}</span>
        <button className="icon-btn" aria-label={t('Ảnh trước')} disabled={i === 0} onClick={() => setI(i - 1)}><LuChevronLeft size={22} /></button>
        <button className="icon-btn" aria-label={t('Ảnh sau')} disabled={i === ids.length - 1} onClick={() => (setI(i + 1), setZoom(1))}><LuChevronRight size={22} /></button>
        <button className="btn small" data-testid="pose-zoom" aria-label={t('Phóng to')} onClick={() => setZoom(zoom >= 3 ? 1 : zoom + 1)}>{zoom}×</button>
      </div>
      <div className={`viewer-body ${zoom > 1 ? 'zoomed' : ''}`} onDoubleClick={() => setZoom(zoom >= 3 ? 1 : zoom + 1)}><div style={{ width: `${zoom * 100}%` }}><BlobImg id={ids[i]} className="viewer-fit" /></div></div>
    </div>,
    document.body,
  );
}

function PoseSheet(props: { p: Pose; acts: Activity[]; onClose: () => void; isNew?: boolean }) {
  const [editing, setEditing] = useState(!!props.isNew);
  if (!editing) return <PoseView p={props.p} acts={props.acts} onEdit={() => setEditing(true)} onClose={props.onClose} />;
  return <PoseEditor {...props} />;
}

function PoseEditor({ p, acts, onClose, isNew }: { p: Pose; acts: Activity[]; onClose: () => void; isNew?: boolean }) {
  const toast = useToast();
  const [f, setF] = useState(p);
  const [del, setDel] = useState(false);
  const [delPhoto, setDelPhoto] = useState<string | null>(null);
  const { journey: jj, places } = useJourney();
  const allPoses = useStore<Pose>('poses', p.journeyId);
  const albumsAll = Array.from(new Set([...DEFAULT_ALBUMS, ...(jj.settings.poseAlbums ?? []), ...(allPoses.map((x) => x.album).filter(Boolean) as string[])]));
  const save = async (next = f) => {
    await db.put('poses', next);
    // keep the activity → pose back-links consistent (one record each, ids only)
    for (const a of acts) {
      const has = a.poseIds.includes(next.id);
      const want = next.activityIds.includes(a.id);
      if (has !== want) await db.put('activities', { ...a, poseIds: want ? [...a.poseIds, next.id] : a.poseIds.filter((x) => x !== next.id) });
    }
  };
  return (
    <Sheet open onClose={onClose} title={isNew ? t('Dáng mới') : t('Sửa dáng')} full>
      <div className="stack">
        <Field label={t('Tên')}><input value={f.title} onChange={(e: any) => setF({ ...f, title: e.target.value })} /></Field>
        <Field label={t('Nhóm')}>
          <select value={f.category} onChange={(e: any) => setF({ ...f, category: e.target.value })}>{Object.entries(POSE_CATS).map(([k, l]) => <option key={k} value={k}>{t(l)}</option>)}</select>
        </Field>
        <div className="row gap">
          <Field label={t('Album')}>
            <select data-testid="pose-album" value={f.album ?? ''} onChange={(e: any) => setF({ ...f, album: e.target.value || undefined })}>
              <option value="">—</option>
              {albumsAll.map((a) => <option key={a} value={a}>{t(a)}</option>)}
            </select>
          </Field>
          <Field label={t('Địa điểm')}>
            <select value={f.placeId ?? ''} onChange={(e: any) => setF({ ...f, placeId: e.target.value || undefined })}>
              <option value="">—</option>
              {places.map((pl) => <option key={pl.id} value={pl.id}>{pl.name}</option>)}
            </select>
          </Field>
        </div>
        <Field label={t('Mô tả')}><textarea rows={3} value={f.description} onChange={(e: any) => setF({ ...f, description: e.target.value })} /></Field>
        {GUIDE.map(([k, l]) => (
          <Field key={k} label={t(l)}><textarea rows={2} value={(f[k] as string) ?? ''} onChange={(e: any) => setF({ ...f, [k]: e.target.value || undefined })} /></Field>
        ))}
        <Field label={t('Ghi chú cá nhân')}><textarea rows={2} value={f.notes} onChange={(e: any) => setF({ ...f, notes: e.target.value })} /></Field>
        <label className="toggle-row"><input type="checkbox" checked={f.favorite} onChange={(e: any) => setF({ ...f, favorite: e.target.checked })} /> {' '}{t('♥ Yêu thích')}</label>
        <div className="card">
          <h4>{t('Ảnh tham khảo của bạn')}</h4>
          <p className="muted xsmall">{t('Chỉ lưu trên thiết bị; không tự chia sẻ.')}</p>
          <div className="thumb-row">
            {f.refBlobIds.map((id, i) => (
              <span key={id} className="thumb-wrap">
                <BlobImg id={id} className="thumb" />
                {i === 0 && <span className="thumb-cover">{t('Bìa')}</span>}
                <button className="thumb-x" aria-label={t('Bỏ ảnh này')} onClick={() => setDelPhoto(id)}>×</button>
                <span className="thumb-moves">
                  <button aria-label={t('Sang trái')} disabled={i === 0} onClick={() => { const a = [...f.refBlobIds]; [a[i - 1], a[i]] = [a[i], a[i - 1]]; setF({ ...f, refBlobIds: a }); }}>‹</button>
                  {i > 0 && <button aria-label={t('Đặt làm bìa')} onClick={() => setF({ ...f, refBlobIds: [id, ...f.refBlobIds.filter((x) => x !== id)] })}>★</button>}
                  <button aria-label={t('Sang phải')} disabled={i === f.refBlobIds.length - 1} onClick={() => { const a = [...f.refBlobIds]; [a[i + 1], a[i]] = [a[i], a[i + 1]]; setF({ ...f, refBlobIds: a }); }}>›</button>
                </span>
              </span>
            ))}
          </div>
          <button
            className="btn small"
            onClick={async () => {
              const fs = await pickFiles('image/*', true);
              const ids: string[] = [];
              for (const file of fs) ids.push((await saveFileAsBlob(file, file.name, p.journeyId)).id);
              setF({ ...f, refBlobIds: [...f.refBlobIds, ...ids] });
            }}
          >
            <LuImage size={14} /> {' '}{t('Thêm ảnh')}</button>
        </div>
        <Field label={t('Liên kết với hoạt động')}>
          <div className="check-list">
            {acts.filter((a) => a.kind === 'sight' || a.kind === 'photo').map((a) => (
              <label key={a.id} className="toggle-row small">
                <input type="checkbox" checked={f.activityIds.includes(a.id)} onChange={(e: any) => setF({ ...f, activityIds: e.target.checked ? [...f.activityIds, a.id] : f.activityIds.filter((x) => x !== a.id) })} />
                <Tx s="activities" r={a} f="title" />
              </label>
            ))}
          </div>
        </Field>
        {f.activityIds.length > 0 && (
          <div className="row gap-s wrap">
            {f.activityIds.map((id) => {
              const a = acts.find((x) => x.id === id);
              return a ? <button key={id} className="btn small ghost" onClick={() => go(`/j/${p.journeyId}/journey/${a.dayId}?a=${a.id}`)}>→ <Tx s="activities" r={a} f="title" /></button> : null;
            })}
          </div>
        )}
        <Confirm open={!!delPhoto} danger title={t('Bỏ ảnh này khỏi dáng?')} body={t('Ảnh sẽ không còn trong dáng này sau khi bạn bấm Lưu.')} onConfirm={async () => void setF({ ...f, refBlobIds: f.refBlobIds.filter((x) => x !== delPhoto) })} onClose={() => setDelPhoto(null)} />
        <div className="row gap">
          {!isNew && <button className="btn danger ghost" onClick={() => setDel(true)}>{t('Xóa')}</button>}
          <button className="btn primary" disabled={!f.title.trim()} onClick={async () => (await save(), toast(t('Đã lưu')), onClose())}>{t('Lưu')}</button>
        </div>
      </div>
      <Confirm open={del} danger title={t('Xóa dáng này?')} body={p.title} onConfirm={async () => (await save({ ...f, activityIds: [] }), await db.del('poses', p.id), onClose())} onClose={() => setDel(false)} />
    </Sheet>
  );
}
