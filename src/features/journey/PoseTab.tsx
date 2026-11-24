import { useState } from 'react';
import { LuHeart, LuPlus, LuImage } from 'react-icons/lu';
import type { Activity, Pose } from '../../db/schema';
import { db, saveFileAsBlob } from '../../db/repo';
import { BlobImg, Confirm, Field, go, PageHeader, pickFiles, queryParam, Sheet, useStore, useToast } from '../../ui/core';
import { useJourney } from './JourneyShell';
import { uid } from '../../lib/util';

export const POSE_CATS: Record<Pose['category'], string> = { hanfu: 'Hán phục', portrait: 'Chân dung', couple: 'Đôi (tự chọn)', street: 'Đường phố', night: 'Ban đêm', architecture: 'Kiến trúc', seasonal: 'Theo mùa' };

export function PoseTab() {
  const { journey: j, activities } = useJourney();
  const poses = useStore<Pose>('poses', j.id);
  const [cat, setCat] = useState<string>('all');
  const [open, setOpen] = useState<string | null>(queryParam('p'));
  const [creating, setCreating] = useState(false);
  const list = poses.filter((p) => cat === 'all' || (cat === 'fav' ? p.favorite : p.category === cat));
  const sel = poses.find((p) => p.id === open);
  return (
    <div className="page">
      <PageHeader title="Pose Book" sub="Cảm hứng & kế hoạch chụp ảnh" right={<button className="icon-btn" aria-label="Thêm dáng" onClick={() => setCreating(true)}><LuPlus size={20} /></button>} />
      <div className="seg scroll-x">
        <button className={cat === 'all' ? 'on' : ''} onClick={() => setCat('all')}>Tất cả</button>
        <button className={cat === 'fav' ? 'on' : ''} onClick={() => setCat('fav')}>♥ Yêu thích</button>
        {Object.entries(POSE_CATS).map(([k, l]) => <button key={k} className={cat === k ? 'on' : ''} onClick={() => setCat(k)}>{l}</button>)}
      </div>
      <div className="pose-grid">
        {list.map((p) => (
          <button key={p.id} className="pose-card glass-card" onClick={() => setOpen(p.id)}>
            {p.refBlobIds[0] ? <BlobImg id={p.refBlobIds[0]} className="pose-img" /> : <div className="pose-art" aria-hidden="true">{p.category === 'hanfu' ? '🏮' : p.category === 'night' ? '🌃' : p.category === 'architecture' ? '🏛️' : p.category === 'seasonal' ? '❄️' : p.category === 'street' ? '🚶' : p.category === 'couple' ? '🤍' : '📷'}</div>}
            <span className="pose-cat">{POSE_CATS[p.category]}</span>
            <b>{p.title}</b>
            {p.favorite && <span className="fav"><LuHeart size={14} /></span>}
          </button>
        ))}
      </div>
      {!list.length && <p className="muted center">Chưa có dáng nào trong mục này.</p>}
      {sel && <PoseSheet p={sel} acts={activities} onClose={() => setOpen(null)} />}
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

function PoseSheet({ p, acts, onClose, isNew }: { p: Pose; acts: Activity[]; onClose: () => void; isNew?: boolean }) {
  const toast = useToast();
  const [f, setF] = useState(p);
  const [del, setDel] = useState(false);
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
    <Sheet open onClose={onClose} title={isNew ? 'Dáng mới' : p.title} full>
      <div className="stack">
        <Field label="Tên"><input value={f.title} onChange={(e: any) => setF({ ...f, title: e.target.value })} /></Field>
        <Field label="Nhóm">
          <select value={f.category} onChange={(e: any) => setF({ ...f, category: e.target.value })}>{Object.entries(POSE_CATS).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select>
        </Field>
        <Field label="Mô tả"><textarea rows={3} value={f.description} onChange={(e: any) => setF({ ...f, description: e.target.value })} /></Field>
        <Field label="Ghi chú cá nhân"><textarea rows={2} value={f.notes} onChange={(e: any) => setF({ ...f, notes: e.target.value })} /></Field>
        <label className="toggle-row"><input type="checkbox" checked={f.favorite} onChange={(e: any) => setF({ ...f, favorite: e.target.checked })} /> ♥ Yêu thích</label>
        <div className="card">
          <h4>Ảnh tham khảo của bạn</h4>
          <p className="muted xsmall">Chỉ lưu trên thiết bị; không tự chia sẻ.</p>
          <div className="thumb-row">{f.refBlobIds.map((id) => <BlobImg key={id} id={id} className="thumb" />)}</div>
          <button
            className="btn small"
            onClick={async () => {
              const fs = await pickFiles('image/*', true);
              const ids: string[] = [];
              for (const file of fs) ids.push((await saveFileAsBlob(file, file.name, p.journeyId)).id);
              setF({ ...f, refBlobIds: [...f.refBlobIds, ...ids] });
            }}
          >
            <LuImage size={14} /> Thêm ảnh
          </button>
        </div>
        <Field label="Liên kết với hoạt động">
          <div className="check-list">
            {acts.filter((a) => a.kind === 'sight' || a.kind === 'photo').map((a) => (
              <label key={a.id} className="toggle-row small">
                <input type="checkbox" checked={f.activityIds.includes(a.id)} onChange={(e: any) => setF({ ...f, activityIds: e.target.checked ? [...f.activityIds, a.id] : f.activityIds.filter((x) => x !== a.id) })} />
                {a.title}
              </label>
            ))}
          </div>
        </Field>
        {f.activityIds.length > 0 && (
          <div className="row gap-s wrap">
            {f.activityIds.map((id) => {
              const a = acts.find((x) => x.id === id);
              return a ? <button key={id} className="btn small ghost" onClick={() => go(`/j/${p.journeyId}/journey/${a.dayId}?a=${a.id}`)}>→ {a.title}</button> : null;
            })}
          </div>
        )}
        <div className="row gap">
          {!isNew && <button className="btn danger ghost" onClick={() => setDel(true)}>Xóa</button>}
          <button className="btn primary" disabled={!f.title.trim()} onClick={async () => (await save(), toast('Đã lưu'), onClose())}>Lưu</button>
        </div>
      </div>
      <Confirm open={del} danger title="Xóa dáng này?" body={p.title} onConfirm={async () => (await save({ ...f, activityIds: [] }), await db.del('poses', p.id), onClose())} onClose={() => setDel(false)} />
    </Sheet>
  );
}
