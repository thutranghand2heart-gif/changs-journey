import { useEffect, useState } from 'react';
import { LuPlus, LuPencil, LuLock, LuTrash2 } from 'react-icons/lu';
import type { Activity, ActivityStatus, Day } from '../../db/schema';
import { db, deleteActivity } from '../../db/repo';
import { Confirm, Field, go, PageHeader, queryParam, Sheet, useToast } from '../../ui/core';
import { useJourney } from './JourneyShell';
import { fmtDateVi, fmtShort, addDays, tzLabel } from '../../lib/time';
import { uid } from '../../lib/util';
import { ActivitySheet } from './ActivitySheet';

export const STATUS_LABEL: Record<ActivityStatus, string> = { draft: 'Nháp', tentative: 'Dự kiến', booked: 'Đã đặt', completed: 'Đã xong', cancelled: 'Đã hủy' };

export function JourneyTab({ dayId }: { dayId?: string }) {
  const { journey: j, days } = useJourney();
  const toast = useToast();
  const [delDay, setDelDay] = useState<Day | null>(null);
  if (dayId) {
    const d = days.find((x) => x.id === dayId);
    if (d) return <DayView day={d} />;
  }
  const addDay = async () => {
    const last = days[days.length - 1];
    const date = last ? addDays(last.date, 1) : j.startDate;
    await db.put('days', { id: uid('d'), journeyId: j.id, index: (last?.index ?? 0) + 1, date, title: `Ngày ${(last?.index ?? 0) + 1}`, freeDay: false, privateByDefault: false, notes: '' } satisfies Day);
    if (date > j.endDate) await db.put('journeys', { ...j, endDate: date });
    toast('Đã thêm ngày');
  };
  return (
    <div className="page">
      <PageHeader title="Journey" sub={`${j.title} · ${days.length} ngày`} />
      <div className="day-cards">
        {days.map((d) => (
          <div key={d.id} className={`day-card glass-card ${d.freeDay ? 'free' : ''}`}>
            <button className="day-card-main" onClick={() => go(`/j/${j.id}/journey/${d.id}`)}>
              <div className="day-card-num display">{d.index}</div>
              <div className="grow">
                <p className="muted xsmall">{fmtDateVi(d.date)}</p>
                <h3 className="display">{d.title}</h3>
                {d.subtitle && <p className="muted small">{d.subtitle}</p>}
              </div>
            </button>
            {j.seedKey === undefined && days.length > 1 && (
              <button className="icon-btn" aria-label={`Xóa ngày ${d.index}`} onClick={() => setDelDay(d)}><LuTrash2 size={16} /></button>
            )}
          </div>
        ))}
      </div>
      <button className="btn" onClick={addDay}><LuPlus /> Thêm ngày</button>
      <Confirm
        open={!!delDay}
        danger
        title={`Xóa Ngày ${delDay?.index}?`}
        body="Các hoạt động của ngày này sẽ bị xóa. Ảnh, kỷ niệm, chi phí liên kết vẫn được giữ lại."
        onConfirm={async () => {
          const acts = (await db.getAll<Activity>('activities', j.id)).filter((a) => a.dayId === delDay!.id);
          for (const a of acts) await deleteActivity(a);
          await db.del('days', delDay!.id);
        }}
        onClose={() => setDelDay(null)}
      />
    </div>
  );
}

function DayView({ day }: { day: Day }) {
  const { journey: j, activities, places } = useJourney();
  const acts = activities.filter((a) => a.dayId === day.id);
  const [open, setOpen] = useState<string | null>(queryParam('a'));
  const [editDay, setEditDay] = useState(false);
  const [adding, setAdding] = useState(false);
  useEffect(() => setOpen(queryParam('a')), [day.id]);
  const act = acts.find((a) => a.id === open);

  return (
    <div className="page">
      <PageHeader
        title={<span className="display">Ngày {day.index}: {day.title}</span>}
        sub={`${fmtDateVi(day.date)}${day.subtitle ? ' · ' + day.subtitle.replace(/^[^·]*·\s*/, '') : ''}`}
        back={`/j/${j.id}/journey`}
        right={<button className="icon-btn" aria-label="Sửa ngày" onClick={() => setEditDay(true)}><LuPencil size={18} /></button>}
      />
      {day.notes && <p className="glass-card small">📝 {day.notes}</p>}

      {day.freeDay ? (
        <div className="free-day glass-card">
          <p className="display big-quote">Một ngày của riêng mình.</p>
          <p className="muted">Không có lịch trình, không nhắc nhở, không gợi ý. Hôm nay hoàn toàn thuộc về bạn.</p>
          {acts.length > 0 && <p className="muted small">Bạn đã tự thêm {acts.length} ghi chú cho ngày này.</p>}
          <div className="row gap-s wrap">
            <button className="btn small" onClick={() => go(`/j/${j.id}/memories/new?day=${day.id}&private=1`)}><LuLock size={14} /> Viết nhật ký riêng tư</button>
            <button className="btn small ghost" onClick={() => setAdding(true)}><LuPlus size={14} /> Tự thêm một ghi chú</button>
          </div>
          {acts.length > 0 && <Timeline acts={acts} onOpen={setOpen} placeName={(id) => places.find((p) => p.id === id)?.name} />}
        </div>
      ) : (
        <>
          <Timeline acts={acts} onOpen={setOpen} placeName={(id) => places.find((p) => p.id === id)?.name} />
          {!acts.length && <p className="muted center">Chưa có hoạt động.</p>}
          <button className="btn" onClick={() => setAdding(true)}><LuPlus /> Thêm hoạt động</button>
        </>
      )}
      {act && <ActivitySheet a={act} onClose={() => setOpen(null)} />}
      {adding && <ActivityEditor day={day} onClose={() => setAdding(false)} />}
      {editDay && <DayEditor day={day} onClose={() => setEditDay(false)} />}
    </div>
  );
}

function Timeline({ acts, onOpen, placeName }: { acts: Activity[]; onOpen: (id: string) => void; placeName: (id?: string) => string | undefined }) {
  const { journey: j } = useJourney();
  return (
    <ol className="gold-timeline">
      {acts.map((a) => (
        <li key={a.id} className={`tl-item status-${a.status} ${a.optional ? 'optional' : ''}`}>
          <span className="tl-dot" aria-hidden="true" />
          <button className="tl-card glass-card" onClick={() => onOpen(a.id)}>
            <div className="tl-time">
              {a.start ? <b>{a.approxTime ? '~' : ''}{a.start}{a.end ? `–${a.end}` : ''}</b> : <span className="muted">Linh hoạt</span>}
              {a.timeZone !== j.timeZone && a.timeZoneLabel && <span className="tz-badge">{a.timeZoneLabel}</span>}
              {a.kind === 'flight' && a.timeZone === j.timeZone && <span className="tz-badge">{a.timeZoneLabel ?? tzLabel(a.timeZone)}</span>}
            </div>
            <div className="tl-title">{a.title}</div>
            {a.nameZh && <div className="zh small" lang="zh-CN">{a.nameZh}</div>}
            {!a.nameZh && placeName(a.placeId) && <div className="muted small">{placeName(a.placeId)}</div>}
            <div className="tl-tags">
              <span className={`status-pill s-${a.status}`}>{STATUS_LABEL[a.status]}</span>
              {a.optional && <span className="status-pill">Tùy chọn</span>}
              {a.unverified && <span className="status-pill warn">Chưa xác minh</span>}
            </div>
          </button>
        </li>
      ))}
    </ol>
  );
}

function DayEditor({ day, onClose }: { day: Day; onClose: () => void }) {
  const [f, setF] = useState({ title: day.title, subtitle: day.subtitle ?? '', notes: day.notes, freeDay: day.freeDay });
  return (
    <Sheet open onClose={onClose} title={`Sửa Ngày ${day.index}`}>
      <div className="stack">
        <Field label="Tiêu đề"><input value={f.title} onChange={(e: any) => setF({ ...f, title: e.target.value })} /></Field>
        <Field label="Phụ đề"><input value={f.subtitle} onChange={(e: any) => setF({ ...f, subtitle: e.target.value })} /></Field>
        <Field label="Ghi chú"><textarea rows={3} value={f.notes} onChange={(e: any) => setF({ ...f, notes: e.target.value })} /></Field>
        <label className="toggle-row"><input type="checkbox" checked={f.freeDay} onChange={(e: any) => setF({ ...f, freeDay: e.target.checked })} /> Ngày tự do (không nhắc nhở)</label>
        <p className="muted small">Ngày: {fmtShort(day.date)} — ngày tháng được giữ cố định theo lịch trình.</p>
        <button className="btn primary" onClick={async () => (await db.put('days', { ...day, ...f }), onClose())}>Lưu</button>
      </div>
    </Sheet>
  );
}

export function ActivityEditor({ day, a, onClose }: { day: Day; a?: Activity; onClose: () => void }) {
  const { journey: j, activities, places } = useJourney();
  const toast = useToast();
  const [f, setF] = useState<Activity>(
    a ?? {
      id: uid('a'), journeyId: j.id, dayId: day.id, order: (Math.max(0, ...activities.map((x) => x.order)) + 1), title: '', timeZone: j.timeZone, timeZoneLabel: tzLabel(j.timeZone), notes: '',
      status: 'draft', kind: 'sight', poseIds: [], documentIds: [], expenseIds: [], photoBlobIds: [],
    },
  );
  const set = (k: keyof Activity) => (e: any) => setF({ ...f, [k]: e.target.value || undefined });
  const [newPlace, setNewPlace] = useState({ name: '', nameZh: '', addressZh: '' });
  const [confirmDel, setConfirmDel] = useState(false);
  return (
    <Sheet open onClose={onClose} title={a ? 'Sửa hoạt động' : 'Hoạt động mới'} full>
      <div className="stack">
        <Field label="Tên hoạt động"><input value={f.title} onChange={(e: any) => setF({ ...f, title: e.target.value })} /></Field>
        <div className="row gap">
          <Field label="Bắt đầu"><input type="time" value={f.start ?? ''} onChange={set('start')} /></Field>
          <Field label="Kết thúc"><input type="time" value={f.end ?? ''} onChange={set('end')} /></Field>
        </div>
        <label className="toggle-row"><input type="checkbox" checked={!!f.approxTime} onChange={(e: any) => setF({ ...f, approxTime: e.target.checked })} /> Giờ ước chừng (“khoảng”)</label>
        <Field label="Múi giờ của hoạt động">
          <select value={f.timeZone} onChange={(e: any) => setF({ ...f, timeZone: e.target.value, timeZoneLabel: tzLabel(e.target.value) })}>
            {[j.timeZone, 'Asia/Seoul', 'Asia/Shanghai', 'Asia/Ho_Chi_Minh', 'Asia/Tokyo', 'UTC'].filter((v, i, s) => s.indexOf(v) === i).map((z) => <option key={z} value={z}>{tzLabel(z)}</option>)}
          </select>
        </Field>
        <div className="row gap">
          <Field label="Loại">
            <select value={f.kind} onChange={set('kind')}>
              {[['sight', 'Tham quan'], ['transport', 'Di chuyển'], ['flight', 'Chuyến bay'], ['meal', 'Ăn uống'], ['rest', 'Nghỉ'], ['hotel', 'Khách sạn'], ['photo', 'Chụp ảnh'], ['other', 'Khác']].map(([k, l]) => <option key={k} value={k}>{l}</option>)}
            </select>
          </Field>
          <Field label="Trạng thái">
            <select value={f.status} onChange={set('status')}>{Object.entries(STATUS_LABEL).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select>
          </Field>
        </div>
        <Field label="Tên tiếng Trung"><input value={f.nameZh ?? ''} onChange={set('nameZh')} lang="zh-CN" /></Field>
        <Field label="Pinyin"><input value={f.pinyin ?? ''} onChange={set('pinyin')} /></Field>
        <Field label="Mô tả (tiếng Việt)"><textarea rows={2} value={f.descriptionVi ?? ''} onChange={set('descriptionVi')} /></Field>
        <Field label="Địa điểm">
          <select value={f.placeId ?? ''} onChange={set('placeId')}>
            <option value="">— Không —</option>
            {places.map((p) => <option key={p.id} value={p.id}>{p.name}{p.nameZh ? ` · ${p.nameZh}` : ''}</option>)}
          </select>
        </Field>
        {!f.placeId && (
          <details className="card">
            <summary>+ Tạo địa điểm mới</summary>
            <div className="stack">
              <input placeholder="Tên" value={newPlace.name} onChange={(e: any) => setNewPlace({ ...newPlace, name: e.target.value })} />
              <input placeholder="Tên tiếng Trung" value={newPlace.nameZh} onChange={(e: any) => setNewPlace({ ...newPlace, nameZh: e.target.value })} />
              <input placeholder="Địa chỉ tiếng Trung (giản thể)" value={newPlace.addressZh} onChange={(e: any) => setNewPlace({ ...newPlace, addressZh: e.target.value })} />
              <button
                type="button"
                className="btn small"
                disabled={!newPlace.name.trim()}
                onClick={async () => {
                  // avoid duplicates: reuse a place whose name / Chinese name / alias already matches
                  const hit = places.find((p) => [p.name, p.nameZh, ...p.aliases].some((n) => n && (n === newPlace.name.trim() || n === newPlace.nameZh.trim())));
                  if (hit) {
                    setF({ ...f, placeId: hit.id });
                    return toast(`Dùng địa điểm sẵn có: ${hit.name}`);
                  }
                  const id = uid('pl');
                  await db.put('places', { id, journeyId: j.id, name: newPlace.name.trim(), nameZh: newPlace.nameZh || undefined, addressZh: newPlace.addressZh || undefined, aliases: [], city: j.destinations[0] ?? '', wishlist: false, notes: '' });
                  setF({ ...f, placeId: id });
                }}
              >
                Tạo & gắn
              </button>
            </div>
          </details>
        )}
        <Field label="Ghi chú"><textarea rows={3} value={f.notes} onChange={(e: any) => setF({ ...f, notes: e.target.value })} /></Field>
        <div className="row gap">
          {a && <button className="btn danger ghost" onClick={() => setConfirmDel(true)}>Xóa</button>}
          <button className="btn primary" disabled={!f.title.trim()} onClick={async () => (await db.put('activities', f), toast('Đã lưu hoạt động'), onClose())}>Lưu</button>
        </div>
      </div>
      <Confirm open={confirmDel} danger title="Xóa hoạt động?" body="Ảnh, biên lai, chi phí và kỷ niệm liên kết sẽ được giữ lại (chỉ bỏ liên kết)." onConfirm={async () => (await deleteActivity(f), onClose())} onClose={() => setConfirmDel(false)} />
    </Sheet>
  );
}
