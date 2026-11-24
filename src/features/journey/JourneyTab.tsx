import { useEffect, useState } from 'react';
import { LuPlus, LuPencil, LuLock, LuTrash2 } from 'react-icons/lu';
import type { Activity, ActivityStatus, Day } from '../../db/schema';
import { db, deleteActivity } from '../../db/repo';
import { Confirm, Field, go, PageHeader, queryParam, Sheet, useToast } from '../../ui/core';
import { useJourney } from './JourneyShell';
import { fmtDateVi, fmtShort, addDays, tzLabel } from '../../lib/time';
import { uid } from '../../lib/util';
import { ActivitySheet } from './ActivitySheet';
import { t, tr } from '../../lib/i18n';
import { Tx } from '../../ui/contentTx';

export const STATUS_LABEL: Record<ActivityStatus, string> = { draft: tr('Nháp'), tentative: tr('Dự kiến'), booked: tr('Đã đặt'), completed: tr('Đã xong'), cancelled: tr('Đã hủy') };

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
    await db.put('days', { id: uid('d'), journeyId: j.id, index: (last?.index ?? 0) + 1, date, title: t('Ngày {0}', (last?.index ?? 0) + 1), freeDay: false, privateByDefault: false, notes: '' } satisfies Day);
    if (date > j.endDate) await db.put('journeys', { ...j, endDate: date });
    toast(t('Đã thêm ngày'));
  };
  return (
    <div className="page">
      <PageHeader title={t('Journey')} sub={t('{0} · {1} ngày', j.title, days.length)} />
      <div className="day-cards">
        {days.map((d) => (
          <div key={d.id} className={`day-card glass-card ${d.freeDay ? 'free' : ''}`}>
            <button className="day-card-main" onClick={() => go(`/j/${j.id}/journey/${d.id}`)}>
              <div className="day-card-num display">{d.index}</div>
              <div className="grow">
                <p className="muted xsmall">{fmtDateVi(d.date)}</p>
                <h3 className="display"><Tx s="days" r={d} f="title" /></h3>
                {d.subtitle && <p className="muted small"><Tx s="days" r={d} f="subtitle" /></p>}
              </div>
            </button>
            {j.seedKey === undefined && days.length > 1 && (
              <button className="icon-btn" aria-label={t('Xóa ngày {0}', d.index)} onClick={() => setDelDay(d)}><LuTrash2 size={16} /></button>
            )}
          </div>
        ))}
      </div>
      <button className="btn" onClick={addDay}><LuPlus /> {' '}{t('Thêm ngày')}</button>
      <Confirm
        open={!!delDay}
        danger
        title={t('Xóa Ngày {0}?', delDay?.index)}
        body={t('Các hoạt động của ngày này sẽ bị xóa. Ảnh, kỷ niệm, chi phí liên kết vẫn được giữ lại.')}
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
        title={<span className="display">{t('Ngày')}{' '}{day.index}: <Tx s="days" r={day} f="title" /></span>}
        sub={`${fmtDateVi(day.date)}${day.subtitle ? ' · ' + day.subtitle.replace(/^[^·]*·\s*/, '') : ''}`}
        back={`/j/${j.id}/journey`}
        right={<button className="icon-btn" aria-label={t('Sửa ngày')} onClick={() => setEditDay(true)}><LuPencil size={18} /></button>}
      />
      {day.notes && <p className="glass-card small">📝 <Tx s="days" r={day} f="notes" /></p>}

      {day.freeDay ? (
        <div className="free-day glass-card">
          <p className="display big-quote">{t('Một ngày của riêng mình.')}</p>
          <p className="muted">{t('Không có lịch trình, không nhắc nhở, không gợi ý. Hôm nay hoàn toàn thuộc về bạn.')}</p>
          {acts.length > 0 && <p className="muted small">{t('Bạn đã tự thêm')}{' '}{acts.length} {' '}{t('ghi chú cho ngày này.')}</p>}
          <div className="row gap-s wrap">
            <button className="btn small" onClick={() => go(`/j/${j.id}/memories/new?day=${day.id}&private=1`)}><LuLock size={14} /> {' '}{t('Viết nhật ký riêng tư')}</button>
            <button className="btn small ghost" onClick={() => setAdding(true)}><LuPlus size={14} /> {' '}{t('Tự thêm một ghi chú')}</button>
          </div>
          {acts.length > 0 && <Timeline acts={acts} onOpen={setOpen} placeName={(id) => places.find((p) => p.id === id)?.name} />}
        </div>
      ) : (
        <>
          <Timeline acts={acts} onOpen={setOpen} placeName={(id) => places.find((p) => p.id === id)?.name} />
          {!acts.length && <p className="muted center">{t('Chưa có hoạt động.')}</p>}
          <button className="btn" onClick={() => setAdding(true)}><LuPlus /> {' '}{t('Thêm hoạt động')}</button>
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
              {a.start ? <b>{a.approxTime ? '~' : ''}{a.start}{a.end ? `–${a.end}` : ''}</b> : <span className="muted">{t('Linh hoạt')}</span>}
              {a.timeZone !== j.timeZone && a.timeZoneLabel && <span className="tz-badge">{t(a.timeZoneLabel)}</span>}
              {a.kind === 'flight' && a.timeZone === j.timeZone && <span className="tz-badge">{t(a.timeZoneLabel ?? tzLabel(a.timeZone))}</span>}
            </div>
            <div className="tl-title"><Tx s="activities" r={a} f="title" /></div>
            {a.nameZh && <div className="zh small" lang="zh-CN">{a.nameZh}</div>}
            {!a.nameZh && placeName(a.placeId) && <div className="muted small">{placeName(a.placeId)}</div>}
            <div className="tl-tags">
              <span className={`status-pill s-${a.status}`}>{t(STATUS_LABEL[a.status])}</span>
              {a.optional && <span className="status-pill">{t('Tùy chọn')}</span>}
              {a.unverified && <span className="status-pill warn">{t('Chưa xác minh')}</span>}
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
    <Sheet open onClose={onClose} title={t('Sửa Ngày {0}', day.index)}>
      <div className="stack">
        <Field label={t('Tiêu đề')}><input value={f.title} onChange={(e: any) => setF({ ...f, title: e.target.value })} /></Field>
        <Field label={t('Phụ đề')}><input value={f.subtitle} onChange={(e: any) => setF({ ...f, subtitle: e.target.value })} /></Field>
        <Field label={t('Ghi chú')}><textarea rows={3} value={f.notes} onChange={(e: any) => setF({ ...f, notes: e.target.value })} /></Field>
        <label className="toggle-row"><input type="checkbox" checked={f.freeDay} onChange={(e: any) => setF({ ...f, freeDay: e.target.checked })} /> {' '}{t('Ngày tự do (không nhắc nhở)')}</label>
        <p className="muted small">{t('Ngày:')}{' '}{fmtShort(day.date)} {' '}{t('— ngày tháng được giữ cố định theo lịch trình.')}</p>
        <button className="btn primary" onClick={async () => (await db.put('days', { ...day, ...f }), onClose())}>{t('Lưu')}</button>
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
    <Sheet open onClose={onClose} title={a ? t('Sửa hoạt động') : t('Hoạt động mới')} full>
      <div className="stack">
        <Field label={t('Tên hoạt động')}><input value={f.title} onChange={(e: any) => setF({ ...f, title: e.target.value })} /></Field>
        <div className="row gap">
          <Field label={t('Bắt đầu')}><input type="time" value={f.start ?? ''} onChange={set('start')} /></Field>
          <Field label={t('Kết thúc')}><input type="time" value={f.end ?? ''} onChange={set('end')} /></Field>
        </div>
        <label className="toggle-row"><input type="checkbox" checked={!!f.approxTime} onChange={(e: any) => setF({ ...f, approxTime: e.target.checked })} /> {' '}{t('Giờ ước chừng (“khoảng”)')}</label>
        <Field label={t('Múi giờ của hoạt động')}>
          <select value={f.timeZone} onChange={(e: any) => setF({ ...f, timeZone: e.target.value, timeZoneLabel: tzLabel(e.target.value) })}>
            {[j.timeZone, 'Asia/Seoul', 'Asia/Shanghai', 'Asia/Ho_Chi_Minh', 'Asia/Tokyo', 'UTC'].filter((v, i, s) => s.indexOf(v) === i).map((z) => <option key={z} value={z}>{t(tzLabel(z))}</option>)}
          </select>
        </Field>
        <div className="row gap">
          <Field label={t('Loại')}>
            <select value={f.kind} onChange={set('kind')}>
              {[['sight', t('Tham quan')], ['transport', t('Di chuyển')], ['flight', t('Chuyến bay')], ['meal', t('Ăn uống')], ['rest', t('Nghỉ')], ['hotel', t('Khách sạn')], ['photo', t('Chụp ảnh')], ['other', t('Khác')]].map(([k, l]) => <option key={k} value={k}>{l}</option>)}
            </select>
          </Field>
          <Field label={t('Trạng thái')}>
            <select value={f.status} onChange={set('status')}>{Object.entries(STATUS_LABEL).map(([k, l]) => <option key={k} value={k}>{t(l)}</option>)}</select>
          </Field>
        </div>
        <Field label={t('Tên tiếng Trung')}><input value={f.nameZh ?? ''} onChange={set('nameZh')} lang="zh-CN" /></Field>
        <Field label={t('Pinyin')}><input value={f.pinyin ?? ''} onChange={set('pinyin')} /></Field>
        <Field label={t('Mô tả (tiếng Việt)')}><textarea rows={2} value={f.descriptionVi ?? ''} onChange={set('descriptionVi')} /></Field>
        <Field label={t('Địa điểm')}>
          <select value={f.placeId ?? ''} onChange={set('placeId')}>
            <option value="">{t('— Không —')}</option>
            {places.map((p) => <option key={p.id} value={p.id}>{p.name}{p.nameZh ? ` · ${p.nameZh}` : ''}</option>)}
          </select>
        </Field>
        {!f.placeId && (
          <details className="card">
            <summary>{t('+ Tạo địa điểm mới')}</summary>
            <div className="stack">
              <input placeholder={t('Tên')} value={newPlace.name} onChange={(e: any) => setNewPlace({ ...newPlace, name: e.target.value })} />
              <input placeholder={t('Tên tiếng Trung')} value={newPlace.nameZh} onChange={(e: any) => setNewPlace({ ...newPlace, nameZh: e.target.value })} />
              <input placeholder={t('Địa chỉ tiếng Trung (giản thể)')} value={newPlace.addressZh} onChange={(e: any) => setNewPlace({ ...newPlace, addressZh: e.target.value })} />
              <button
                type="button"
                className="btn small"
                disabled={!newPlace.name.trim()}
                onClick={async () => {
                  // avoid duplicates: reuse a place whose name / Chinese name / alias already matches
                  const hit = places.find((p) => [p.name, p.nameZh, ...p.aliases].some((n) => n && (n === newPlace.name.trim() || n === newPlace.nameZh.trim())));
                  if (hit) {
                    setF({ ...f, placeId: hit.id });
                    return toast(t('Dùng địa điểm sẵn có: {0}', hit.name));
                  }
                  const id = uid('pl');
                  await db.put('places', { id, journeyId: j.id, name: newPlace.name.trim(), nameZh: newPlace.nameZh || undefined, addressZh: newPlace.addressZh || undefined, aliases: [], city: j.destinations[0] ?? '', wishlist: false, notes: '' });
                  setF({ ...f, placeId: id });
                }}
              >
                {t('Tạo & gắn')}</button>
            </div>
          </details>
        )}
        <Field label={t('Ghi chú')}><textarea rows={3} value={f.notes} onChange={(e: any) => setF({ ...f, notes: e.target.value })} /></Field>
        <div className="row gap">
          {a && <button className="btn danger ghost" onClick={() => setConfirmDel(true)}>{t('Xóa')}</button>}
          <button className="btn primary" disabled={!f.title.trim()} onClick={async () => (await db.put('activities', f), toast(t('Đã lưu hoạt động')), onClose())}>{t('Lưu')}</button>
        </div>
      </div>
      <Confirm open={confirmDel} danger title={t('Xóa hoạt động?')} body={t('Ảnh, biên lai, chi phí và kỷ niệm liên kết sẽ được giữ lại (chỉ bỏ liên kết).')} onConfirm={async () => (await deleteActivity(f), onClose())} onClose={() => setConfirmDel(false)} />
    </Sheet>
  );
}
