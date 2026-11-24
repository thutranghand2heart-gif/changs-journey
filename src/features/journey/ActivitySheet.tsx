import { useState } from 'react';
import { LuCopy, LuNavigation, LuMapPin, LuPencil, LuCamera, LuImage, LuCheck, LuVolume2 } from 'react-icons/lu';
import type { Activity, Expense, Pose, WalletDoc } from '../../db/schema';
import { db, saveFileAsBlob } from '../../db/repo';
import { BlobImg, go, pickFiles, Sheet, useStore, useToast } from '../../ui/core';
import { useJourney } from './JourneyShell';
import { copyText, fmtMoney } from '../../lib/util';
import { amapUrl, appleMapsUrl } from '../../lib/maps';
import { STATUS_LABEL, ActivityEditor } from './JourneyTab';
import { paidOf } from '../../lib/budget';
import { speak, speechSupported } from '../../lib/speech';

export function ActivitySheet({ a, onClose }: { a: Activity; onClose: () => void }) {
  const { journey: j, places, days } = useJourney();
  const toast = useToast();
  const poses = useStore<Pose>('poses', j.id).filter((p) => a.poseIds.includes(p.id));
  const docs = useStore<WalletDoc>('docs', j.id).filter((d) => a.documentIds.includes(d.id) && d.privacy !== 'private');
  const exps = useStore<Expense>('expenses', j.id).filter((e) => e.activityId === a.id);
  const place = places.find((p) => p.id === a.placeId);
  const [editing, setEditing] = useState(false);
  const day = days.find((d) => d.id === a.dayId)!;
  const addr = place?.addressZh;

  const copy = async (s: string) => toast((await copyText(s)) ? 'Đã sao chép' : 'Không sao chép được — hãy nhấn giữ để chọn', 'ok');
  const addPhotos = async () => {
    const fs = await pickFiles('image/*', true);
    if (!fs.length) return;
    try {
      const ids: string[] = [];
      for (const f of fs) ids.push((await saveFileAsBlob(f, f.name, j.id)).id);
      await db.put('activities', { ...a, photoBlobIds: [...a.photoBlobIds, ...ids] });
      toast(`Đã lưu ${ids.length} ảnh`);
    } catch (e: any) {
      toast(e.message, 'err');
    }
  };

  if (editing) return <ActivityEditor day={day} a={a} onClose={() => setEditing(false)} />;
  return (
    <Sheet open onClose={onClose} title={a.title}>
      <div className="stack act-detail">
        <div className="act-time">
          {a.start ? <b>{a.approxTime ? 'Khoảng ' : ''}{a.start}{a.end ? ` – ${a.end}` : ''}</b> : <span>Thời gian linh hoạt</span>}
          <span className="tz-badge">{a.timeZoneLabel ?? a.timeZone}</span>
        </div>
        <div className="row gap-s wrap">
          <span className={`status-pill s-${a.status}`}>{STATUS_LABEL[a.status]}</span>
          {a.optional && <span className="status-pill">Tùy chọn</span>}
        </div>
        {a.unverified && <p className="warn-box">⚠︎ {a.unverified}</p>}
        {a.nameZh && (
          <div className="zh-block">
            <p className="zh big-zh" lang="zh-CN">{a.nameZh}</p>
            {a.pinyin && <p className="pinyin">{a.pinyin}</p>}
            {speechSupported() && <button className="btn small ghost" onClick={async () => !(await speak(a.nameZh!)) && toast('Thiết bị không phát được giọng tiếng Trung', 'warn')}><LuVolume2 size={14} /> Nghe</button>}
          </div>
        )}
        {a.descriptionVi && <p>{a.descriptionVi}</p>}
        {place && (
          <div className="card">
            <p><LuMapPin size={14} /> <b>{place.name}</b>{place.nameZh && <span className="zh"> · {place.nameZh}</span>}</p>
            {addr && <p className="zh big-zh selectable" lang="zh-CN">{addr}</p>}
            {place.addressEn && <p className="small muted">{place.addressEn}</p>}
            <div className="row gap-s wrap">
              {addr && <button className="btn small" onClick={() => copy(addr)}><LuCopy size={14} /> Sao chép địa chỉ</button>}
              <a className="btn small" href={amapUrl(place)} target="_blank" rel="noopener noreferrer"><LuNavigation size={14} /> Mở Amap 高德</a>
              <a className="btn small ghost" href={appleMapsUrl(place)} target="_blank" rel="noopener noreferrer">Apple Maps</a>
              <button className="btn small ghost" onClick={() => go(`/j/${j.id}/map?p=${place.id}`)}>Xem trên Map</button>
            </div>
            <p className="muted xsmall">Dẫn đường cần Internet và ứng dụng/dịch vụ bên ngoài.</p>
          </div>
        )}
        {a.notes && <p className="note">📝 {a.notes}</p>}

        {exps.length > 0 && (
          <div className="card">
            <h4>Chi phí liên kết</h4>
            {exps.map((e) => (
              <button key={e.id} className="list-row" onClick={() => go(`/j/${j.id}/budget?e=${e.id}`)}>
                <span className="grow">{e.title}</span>
                <span className="small">{e.estimate != null && `Ước tính ${fmtMoney(e.estimate, e.currency)}${e.estimateHigh ? `–${fmtMoney(e.estimateHigh, e.currency)}` : ''}`} · Đã trả {fmtMoney(paidOf(e), e.currency)}</span>
              </button>
            ))}
          </div>
        )}
        {docs.length > 0 && (
          <div className="card">
            <h4>Giấy tờ liên kết</h4>
            {docs.map((d) => <button key={d.id} className="list-row" onClick={() => go(`/j/${j.id}/wallet?d=${d.id}`)}>📄 {d.title}</button>)}
          </div>
        )}
        {poses.length > 0 && (
          <div className="card">
            <h4>Gợi ý tạo dáng</h4>
            {poses.map((p) => <button key={p.id} className="list-row" onClick={() => go(`/j/${j.id}/pose?p=${p.id}`)}>📸 {p.title}</button>)}
          </div>
        )}
        <div className="card">
          <h4>Ảnh</h4>
          <div className="thumb-row">{a.photoBlobIds.map((id) => <BlobImg key={id} id={id} className="thumb" />)}</div>
          <button className="btn small" onClick={addPhotos}><LuImage size={14} /> Thêm ảnh</button>
        </div>
        <div className="row gap-s wrap">
          {a.status !== 'completed' ? (
            <button className="btn small" onClick={async () => (await db.put('activities', { ...a, status: 'completed' }), toast('Đã đánh dấu hoàn thành'))}><LuCheck size={14} /> Đánh dấu đã xong</button>
          ) : (
            <button className="btn small ghost" onClick={() => db.put('activities', { ...a, status: 'tentative' })}>Bỏ đánh dấu xong</button>
          )}
          <button className="btn small ghost" onClick={() => go(`/j/${j.id}/memories/new?day=${a.dayId}`)}><LuCamera size={14} /> Viết kỷ niệm</button>
          <button className="btn small ghost" onClick={() => setEditing(true)}><LuPencil size={14} /> Sửa</button>
        </div>
      </div>
    </Sheet>
  );
}
