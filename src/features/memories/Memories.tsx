import { useEffect, useState } from 'react';
import { LuPlus, LuLock, LuFilm, LuLayoutGrid, LuStar, LuMail, LuHourglass, LuDownload, LuBookOpen, LuPencil, LuPause, LuPlay, LuX } from 'react-icons/lu';
import type { Memory } from '../../db/schema';
import { BlobImg, go, PageHeader, useLive, useStore } from '../../ui/core';
import * as db from '../../db/idb';
import { useJourney } from '../journey/JourneyShell';
import { Markup, useMemoryText } from './MemoryCommon';
import { fmtShort } from '../../lib/time';
import { publicMemories } from '../../lib/search';
import { useApp } from '../../ui/app-context';

export function MemoriesHub({ view = 'book' }: { view?: string }) {
  const { journey: j, days } = useJourney();
  const mems = useStore<Memory>('memories', j.id).sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  const base = `/j/${j.id}/memories`;
  return (
    <div className="page">
      <PageHeader title="Kỷ niệm" sub="Memory Book · Gallery · Keepsakes" back={`/j/${j.id}`} right={<button className="icon-btn" aria-label="Viết kỷ niệm" onClick={() => go(`${base}/new`)}><LuPlus size={20} /></button>} />
      <div className="seg">
        <button className={view === 'book' ? 'on' : ''} onClick={() => go(`${base}/book`)}><LuBookOpen size={14} /> Sách</button>
        <button className={view === 'gallery' ? 'on' : ''} onClick={() => go(`${base}/gallery`)}><LuLayoutGrid size={14} /> Gallery</button>
        <button className={view === 'keepsakes' ? 'on' : ''} onClick={() => go(`${base}/keepsakes`)}><LuStar size={14} /> Keepsakes</button>
      </div>
      <div className="row gap-s wrap">
        <button className="btn small" onClick={() => go(`${base}/new`)}><LuPencil size={14} /> Viết</button>
        <button className="btn small ghost" onClick={() => go(`/j/${j.id}/postcards`)}><LuMail size={14} /> Bưu thiếp</button>
        <button className="btn small ghost" onClick={() => go(`/j/${j.id}/capsules`)}><LuHourglass size={14} /> Hộp thời gian</button>
        <button className="btn small ghost" onClick={() => go(`/j/${j.id}/export`)}><LuDownload size={14} /> Xuất kỷ niệm</button>
        <button className="btn small ghost" onClick={() => go(`/j/${j.id}/ending`)}>✨ Trang kết</button>
      </div>
      {view === 'book' && (
        <div className="memory-book">
          {days.map((d) => {
            const list = mems.filter((m) => m.dayId === d.id);
            return (
              <section key={d.id} className="book-page glass-card">
                <header>
                  <span className="muted xsmall">Ngày {d.index} · {fmtShort(d.date)}</span>
                  <h3 className="display">{d.title}</h3>
                </header>
                {list.map((m) => <MemoryCard key={m.id} m={m} />)}
                {!list.length && (d.freeDay ? <p className="muted small italic">Trang này để trống — chỉ bạn quyết định có viết gì hay không.</p> : <button className="link-btn" onClick={() => go(`${base}/new?day=${d.id}`)}>+ Viết cho ngày này</button>)}
              </section>
            );
          })}
          {mems.filter((m) => !m.dayId).length > 0 && (
            <section className="book-page glass-card">
              <h3 className="display">Những trang rời</h3>
              {mems.filter((m) => !m.dayId).map((m) => <MemoryCard key={m.id} m={m} />)}
            </section>
          )}
        </div>
      )}
      {view === 'gallery' && <Gallery memories={publicMemories(mems)} />}
      {view === 'keepsakes' && (
        <div className="keepsakes">
          {mems.filter((m) => m.keepsake).map((m) => <MemoryCard key={m.id} m={m} />)}
          {!mems.some((m) => m.keepsake) && <p className="muted center">Tủ Keepsakes còn trống. Đánh dấu ⭐ khi viết kỷ niệm.</p>}
        </div>
      )}
    </div>
  );
}

function MemoryCard({ m }: { m: Memory }) {
  const { journey: j } = useJourney();
  const txt = useMemoryText(m);
  if (m.privacy === 'private' && !txt)
    return (
      <button className={`memory-card locked`} onClick={() => go(`/j/${j.id}/memories/${m.id}`)}>
        <LuLock /> Kỷ niệm riêng tư (đã mã hóa)
      </button>
    );
  return (
    <button className={`memory-card layout-${m.layout}`} onClick={() => go(`/j/${j.id}/memories/${m.id}`)}>
      {m.photoBlobIds[0] && <BlobImg id={m.photoBlobIds[0]} className="memory-thumb" />}
      <span className="grow text-left">
        <b>{txt?.title || 'Không tiêu đề'}</b> {m.privacy === 'private' && <LuLock size={12} />} {m.keepsake && '⭐'}
        <span className="muted small block clamp2">{txt?.body}</span>
      </span>
    </button>
  );
}

export function MemoryView({ id }: { id: string }) {
  const { journey: j, days } = useJourney();
  const [m, loaded] = useLive(() => db.get<Memory>('memories', id), [id], undefined as Memory | undefined);
  if (!loaded) return <div className="page muted">Đang mở…</div>;
  if (!m) return <div className="page"><PageHeader title="Không tìm thấy kỷ niệm" back={`/j/${j.id}/memories`} /></div>;
  return <MemoryViewInner m={m} dayLabel={days.find((d) => d.id === m.dayId)} />;
}
function MemoryViewInner({ m, dayLabel }: { m: Memory; dayLabel?: { index: number; title: string } }) {
  const { journey: j } = useJourney();
  const txt = useMemoryText(m);
  return (
    <div className="page">
      <PageHeader title={txt?.title || (m.privacy === 'private' ? 'Kỷ niệm riêng tư' : 'Kỷ niệm')} sub={dayLabel ? `Ngày ${dayLabel.index}: ${dayLabel.title}` : undefined} back={`/j/${j.id}/memories`} right={<button className="btn small" onClick={() => go(`/j/${j.id}/memories/${m.id}/edit`)}><LuPencil size={14} /> Sửa</button>} />
      {!txt ? (
        <div className="stack"><p>🔒 Đã mã hóa. Mở khóa Két để đọc.</p><button className="btn" onClick={() => go('/vault')}>Mở Két</button></div>
      ) : (
        <article className={`memory-article layout-${m.layout}`}>
          <div className="photo-stack">{m.photoBlobIds.map((pid) => <BlobImg key={pid} id={pid} className="memory-photo" />)}</div>
          <Markup className="memory-body" text={txt.body} />
          <p className="muted xsmall">{new Date(m.updatedAt).toLocaleString('vi-VN')} {m.privacy === 'private' && '· riêng tư, đã mã hóa'}</p>
        </article>
      )}
    </div>
  );
}

function Gallery({ memories }: { memories: Memory[] }) {
  const { reduced } = useApp();
  const [mode, setMode] = useState<'grid' | 'film' | 'cinema'>('grid');
  const photos = memories.flatMap((m) => m.photoBlobIds.map((id) => ({ id, m })));
  return (
    <div>
      <div className="seg">
        <button className={mode === 'grid' ? 'on' : ''} onClick={() => setMode('grid')}>Lưới</button>
        <button className={mode === 'film' ? 'on' : ''} onClick={() => setMode('film')}><LuFilm size={14} /> Cuộn phim</button>
        <button className={mode === 'cinema' ? 'on' : ''} onClick={() => setMode('cinema')} disabled={!photos.length}>▶︎ Trình chiếu</button>
      </div>
      <p className="muted xsmall">Chỉ hiển thị ảnh bạn đã chọn trong kỷ niệm không riêng tư.</p>
      {!photos.length && <p className="muted center">Chưa có ảnh trong kỷ niệm.</p>}
      {mode === 'grid' && <div className="photo-grid">{photos.map((p) => <BlobImg key={p.id} id={p.id} className="grid-img" />)}</div>}
      {mode === 'film' && (
        <div className="film-roll">
          {photos.map((p, i) => (
            <figure key={p.id} className="film-frame">
              <BlobImg id={p.id} className="film-img" />
              <figcaption>{String(i + 1).padStart(2, '0')}A · {p.m.title}</figcaption>
            </figure>
          ))}
        </div>
      )}
      {mode === 'cinema' && photos.length > 0 && <Cinema photos={photos.map((p) => ({ id: p.id, caption: p.m.title }))} reduced={reduced} onClose={() => setMode('grid')} />}
    </div>
  );
}

export function Cinema({ photos, reduced, onClose }: { photos: { id: string; caption: string }[]; reduced: boolean; onClose: () => void }) {
  const [i, setI] = useState(0);
  const [play, setPlay] = useState(!reduced);
  useEffect(() => {
    if (!play) return;
    const t = setInterval(() => setI((x) => (x + 1) % photos.length), 4000);
    return () => clearInterval(t);
  }, [play, photos.length]);
  const p = photos[i];
  return (
    <div className="cinema" role="dialog" aria-label="Trình chiếu kỷ niệm">
      <div key={p.id} className={`cinema-frame ${reduced ? '' : 'kenburns'}`}><BlobImg id={p.id} className="cinema-img" /></div>
      <p className="cinema-cap display">{p.caption}</p>
      <div className="cinema-bar">
        <button className="icon-btn" aria-label="Ảnh trước" onClick={() => setI((i - 1 + photos.length) % photos.length)}>‹</button>
        <button className="icon-btn" aria-label={play ? 'Tạm dừng' : 'Phát'} onClick={() => setPlay(!play)}>{play ? <LuPause /> : <LuPlay />}</button>
        <button className="icon-btn" aria-label="Ảnh sau" onClick={() => setI((i + 1) % photos.length)}>›</button>
        <button className="icon-btn" aria-label="Đóng" onClick={onClose}><LuX /></button>
      </div>
    </div>
  );
}
