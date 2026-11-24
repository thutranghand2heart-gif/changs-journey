import { useState } from 'react';
import type { Journey, TravelWorldEntry } from '../../db/schema';
import { db } from '../../db/repo';
import { Confirm, Field, PageHeader, Sheet, useStore, useToast, go } from '../../ui/core';
import { uid } from '../../lib/util';

export function TravelWorld() {
  const journeys = useStore<Journey>('journeys');
  const world = useStore<TravelWorldEntry>('world');
  const toast = useToast();
  const [edit, setEdit] = useState<TravelWorldEntry | null>(null);
  const [del, setDel] = useState<TravelWorldEntry | null>(null);
  const today = new Date().toISOString().slice(0, 10);

  const planned = journeys.flatMap((j) => j.destinations.map((d) => ({ d, j }))).filter(({ d }) => !world.some((w) => w.name === d && w.status === 'visited'));
  const visited = world.filter((w) => w.status === 'visited');
  const wish = world.filter((w) => w.status === 'wishlist');
  const timeline = [...journeys].sort((a, b) => a.startDate.localeCompare(b.startDate));

  return (
    <div className="page theme-global">
      <PageHeader title="My Travel World" sub="Nơi đã đến, nơi mơ ước và câu chuyện cả đời" back="/" right={<button className="btn small" onClick={() => setEdit({ id: uid('w'), name: '', country: '', status: 'wishlist', story: '' })}>+ Thêm</button>} />
      <p className="muted small">Một nơi chỉ được đánh dấu “đã đến” khi bạn tự đánh dấu. Ứng dụng không theo dõi GPS.</p>

      <section className="card">
        <h3>✅ Đã đến ({visited.length})</h3>
        {visited.map((w) => <WorldRow key={w.id} w={w} onEdit={() => setEdit(w)} />)}
        {!visited.length && <p className="muted small">Chưa có nơi nào được đánh dấu đã đến.</p>}
      </section>
      <section className="card">
        <h3>🗺️ Đã lên kế hoạch</h3>
        {planned.map(({ d, j }, i) => (
          <div key={i} className="list-row">
            <span className="grow">{d} <span className="muted small">· {j.title}</span></span>
            <button
              className="btn small"
              onClick={async () => {
                await db.put('world', { id: uid('w'), name: d, country: '', status: 'visited', visitedOn: j.endDate <= today ? j.endDate : today, story: '', journeyId: j.id } satisfies TravelWorldEntry);
                toast(`Đã đánh dấu ${d} là đã đến`);
              }}
            >
              Đánh dấu đã đến
            </button>
          </div>
        ))}
      </section>
      <section className="card">
        <h3>💫 Mơ ước ({wish.length})</h3>
        {wish.map((w) => <WorldRow key={w.id} w={w} onEdit={() => setEdit(w)} />)}
      </section>
      <section className="card">
        <h3>📜 Dòng thời gian</h3>
        <ol className="timeline-simple">
          {timeline.map((j) => (
            <li key={j.id}>
              <button className="link-btn" onClick={() => go(`/j/${j.id}`)}>{j.coverEmoji} {j.title}</button> <span className="muted small">{j.startDate}</span>
            </li>
          ))}
        </ol>
      </section>

      <Sheet open={!!edit} onClose={() => setEdit(null)} title="Địa điểm">
        {edit && (
          <div className="stack">
            <Field label="Tên nơi"><input value={edit.name} onChange={(e: any) => setEdit({ ...edit, name: e.target.value })} /></Field>
            <Field label="Quốc gia"><input value={edit.country} onChange={(e: any) => setEdit({ ...edit, country: e.target.value })} /></Field>
            <Field label="Trạng thái">
              <select value={edit.status} onChange={(e: any) => setEdit({ ...edit, status: e.target.value })}>
                <option value="wishlist">Mơ ước</option>
                <option value="visited">Đã đến (tôi xác nhận)</option>
              </select>
            </Field>
            {edit.status === 'visited' && <Field label="Ngày đến"><input type="date" value={edit.visitedOn ?? ''} onChange={(e: any) => setEdit({ ...edit, visitedOn: e.target.value })} /></Field>}
            <Field label="Câu chuyện"><textarea rows={4} value={edit.story} onChange={(e: any) => setEdit({ ...edit, story: e.target.value })} /></Field>
            <div className="row gap">
              {world.some((w) => w.id === edit.id) && <button className="btn danger ghost" onClick={() => (setDel(edit), setEdit(null))}>Xóa</button>}
              <button className="btn primary" disabled={!edit.name.trim()} onClick={async () => (await db.put('world', edit), setEdit(null), toast('Đã lưu'))}>Lưu</button>
            </div>
          </div>
        )}
      </Sheet>
      <Confirm open={!!del} danger title="Xóa địa điểm?" body={del?.name} onConfirm={() => db.del('world', del!.id)} onClose={() => setDel(null)} />
    </div>
  );
}

function WorldRow({ w, onEdit }: { w: TravelWorldEntry; onEdit: () => void }) {
  return (
    <button className="list-row" onClick={onEdit}>
      <span className="grow">
        <b>{w.name}</b> {w.country && <span className="muted small">· {w.country}</span>}
        {w.story && <div className="muted small">{w.story.slice(0, 90)}</div>}
      </span>
      {w.visitedOn && <span className="muted small">{w.visitedOn}</span>}
    </button>
  );
}
