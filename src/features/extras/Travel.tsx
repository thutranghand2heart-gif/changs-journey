import { useEffect, useState } from 'react';
import { LuCopy, LuVolume2, LuMaximize2, LuX, LuPlus, LuTrash2, LuRefreshCw } from 'react-icons/lu';
import type { ChecklistItem, Place, WeatherSnapshot } from '../../db/schema';
import { db } from '../../db/repo';
import { Field, PageHeader, queryParam, useLive, useStore, useToast } from '../../ui/core';
import { useJourney } from '../journey/JourneyShell';
import { PHRASES } from '../../lib/phrases';
import { copyText, nowIso, uid } from '../../lib/util';
import { speak, speechSupported } from '../../lib/speech';

// ───────── Large text card (show to drivers / staff)
export function BigText({ zh, py, vi, onClose }: { zh: string; py?: string; vi?: string; onClose: () => void }) {
  return (
    <div className="bigtext" role="dialog" aria-modal="true" onClick={onClose}>
      <button className="icon-btn bigtext-close" aria-label="Đóng"><LuX size={28} /></button>
      <p className="bigtext-zh" lang="zh-CN">{zh}</p>
      {py && <p className="bigtext-py">{py}</p>}
      {vi && <p className="bigtext-vi">{vi}</p>}
    </div>
  );
}

// journey-specific phrases (from the private import file) are listed inside their group
function mergePhrases<T extends { group: string; zh: string }>(base: T[], extra?: T[]): T[] {
  if (!extra?.length) return base;
  const out = [...base];
  for (const e of extra) {
    if (out.some((p) => p.zh === e.zh)) continue;
    let at = -1;
    out.forEach((p, i) => p.group === e.group && (at = i));
    out.splice(at < 0 ? out.length : at + 1, 0, e);
  }
  return out;
}

// ───────── Language assistant
export function LanguagePage() {
  const { journey: j } = useJourney();
  const toast = useToast();
  const [big, setBig] = useState<{ zh: string; py?: string; vi?: string } | null>(null);
  const [group, setGroup] = useState('all');
  const phrases = mergePhrases(PHRASES, j.extraPhrases);
  const groups = Array.from(new Set(phrases.map((p) => p.group)));
  const tts = speechSupported();
  return (
    <div className="page">
      <PageHeader title="Trợ lý ngôn ngữ" sub="Chữ Hán · Pinyin · Tiếng Việt" back={`/j/${j.id}`} />
      {!tts && <p className="muted small">Thiết bị/trình duyệt này không hỗ trợ đọc thành tiếng.</p>}
      {tts && <p className="muted xsmall">Đọc thành tiếng dùng giọng có sẵn của iPhone; có hoạt động offline hay không tùy giọng đã tải trên máy (chưa được kiểm chứng).</p>}
      <div className="seg scroll-x">
        <button className={group === 'all' ? 'on' : ''} onClick={() => setGroup('all')}>Tất cả</button>
        {groups.map((g) => <button key={g} className={group === g ? 'on' : ''} onClick={() => setGroup(g)}>{g}</button>)}
      </div>
      <div className="stack-s">
        {phrases.filter((p) => group === 'all' || p.group === group).map((p) => (
          <div key={p.zh} className="phrase glass-card">
            <p className="zh big-zh" lang="zh-CN">{p.zh}</p>
            <p className="pinyin">{p.py}</p>
            <p>{p.vi}</p>
            <div className="row gap-s">
              <button className="btn small ghost" onClick={async () => toast((await copyText(p.zh)) ? 'Đã sao chép' : 'Không sao chép được')} aria-label="Sao chép"><LuCopy size={14} /></button>
              <button className="btn small ghost" onClick={() => setBig({ zh: p.zh, py: p.py, vi: p.vi })} aria-label="Hiện chữ lớn"><LuMaximize2 size={14} /></button>
              {tts && <button className="btn small ghost" aria-label="Nghe" onClick={async () => !(await speak(p.zh)) && toast('Không phát được giọng tiếng Trung trên thiết bị này', 'warn')}><LuVolume2 size={14} /></button>}
            </div>
          </div>
        ))}
      </div>
      {big && <BigText {...big} onClose={() => setBig(null)} />}
    </div>
  );
}

// ───────── Transport
export function TransportPage() {
  const { journey: j, places, activities } = useJourney();
  const toast = useToast();
  const [big, setBig] = useState<{ zh: string; py?: string; vi?: string } | null>(() => {
    if (queryParam('card') === 'hotel' && j.hotel?.addressZh) return { zh: `请带我去：${j.hotel.addressZh}`, py: 'Qǐng dài wǒ qù', vi: `Làm ơn đưa tôi đến ${j.hotel.name}` };
    return null;
  });
  const transport = activities.filter((a) => a.kind === 'transport' || a.kind === 'flight');
  const cardPlaces = places.filter((p) => p.addressZh);
  return (
    <div className="page">
      <PageHeader title="Di chuyển thông minh" back={`/j/${j.id}`} />
      <h3 className="section-title">Thẻ taxi / DiDi (tiếng Trung)</h3>
      <div className="stack-s">
        {cardPlaces.map((p: Place) => (
          <div key={p.id} className="glass-card list-row">
            <span className="grow"><b>{p.name}</b><span className="zh xsmall block" lang="zh-CN">{p.addressZh}</span></span>
            <button className="btn small" onClick={() => setBig({ zh: `请带我去：${p.addressZh}`, vi: `Làm ơn đưa tôi đến ${p.name}` })}>Thẻ lớn</button>
            <button className="icon-btn" aria-label="Sao chép địa chỉ" onClick={async () => toast((await copyText(p.addressZh!)) ? 'Đã sao chép' : 'Không sao chép được')}><LuCopy size={16} /></button>
          </div>
        ))}
      </div>
      <h3 className="section-title">Các chặng di chuyển trong lịch trình</h3>
      <div className="stack-s">
        {transport.map((a) => (
          <div key={a.id} className="glass-card">
            <b>{a.start ? `${a.approxTime ? '~' : ''}${a.start} · ` : ''}{a.title}</b>
            {a.timeZoneLabel && <span className="tz-badge">{a.timeZoneLabel}</span>}
            {a.nameZh && <p className="zh small" lang="zh-CN">{a.nameZh}</p>}
            {a.descriptionVi && <p className="small muted">{a.descriptionVi}</p>}
          </div>
        ))}
      </div>
      <div className="glass-card small">
        <h4>Ghi chú chung</h4>
        <ul>
          {(j.transportNotes ?? ['Tàu cao tốc: mang hộ chiếu (dùng để mua/soát vé).']).map((n) => <li key={n}>{n}</li>)}
        </ul>
        <p className="muted xsmall">Giờ tàu và giá vé không được ứng dụng xác minh — hãy kiểm tra trong ứng dụng đặt vé chính thức.</p>
      </div>
      {big && <BigText {...big} onClose={() => setBig(null)} />}
    </div>
  );
}

// ───────── Weather & wardrobe (only real data, timestamped)
const WMO: Record<number, string> = { 0: '☀️ Quang', 1: '🌤️ Ít mây', 2: '⛅ Mây rải rác', 3: '☁️ Nhiều mây', 45: '🌫️ Sương mù', 48: '🌫️ Sương mù', 51: '🌦️ Mưa phùn', 53: '🌦️ Mưa phùn', 55: '🌧️ Mưa phùn', 61: '🌧️ Mưa nhẹ', 63: '🌧️ Mưa', 65: '🌧️ Mưa to', 71: '🌨️ Tuyết nhẹ', 73: '🌨️ Tuyết', 75: '❄️ Tuyết dày', 80: '🌦️ Mưa rào', 81: '🌧️ Mưa rào', 82: '⛈️ Mưa rào mạnh', 95: '⛈️ Dông' };

export function WeatherPage() {
  const { journey: j, places } = useJourney();
  const toast = useToast();
  const [snap] = useLive(() => db.get<WeatherSnapshot>('weather', j.id), [j.id], undefined as WeatherSnapshot | undefined);
  const [busy, setBusy] = useState(false);
  const [notes, setNotes] = useState<string>(() => { try { return localStorage.getItem(`wardrobe-${j.id}`) ?? ''; } catch { return ''; } });
  useEffect(() => { try { localStorage.setItem(`wardrobe-${j.id}`, notes); } catch { /* */ } }, [notes]);
  // coordinates come from the journey's own places (average of the destination's places)
  const coordsOf = (city: string): [number, number] | undefined => {
    const ps = places.filter((p) => p.city === city && p.lat != null && p.lng != null);
    return ps.length ? [ps.reduce((s, p) => s + p.lat!, 0) / ps.length, ps.reduce((s, p) => s + p.lng!, 0) / ps.length] : undefined;
  };
  const city = j.destinations.find((d) => coordsOf(d)) ?? j.destinations[0];
  const fetchNow = async () => {
    const c = coordsOf(city ?? '');
    if (!c) return toast('Chưa có toạ độ cho thành phố này', 'warn');
    setBusy(true);
    try {
      const r = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${c[0].toFixed(3)}&longitude=${c[1].toFixed(3)}&daily=weather_code,temperature_2m_max,temperature_2m_min&timezone=${encodeURIComponent(j.timeZone)}&forecast_days=7`);
      if (!r.ok) throw new Error('HTTP ' + r.status);
      const d = await r.json();
      const daily = d.daily.time.map((t: string, i: number) => ({ date: t, max: d.daily.temperature_2m_max[i], min: d.daily.temperature_2m_min[i], code: d.daily.weather_code[i] }));
      await db.put('weather', { journeyId: j.id, city: city!, fetchedAt: nowIso(), source: 'Open-Meteo', daily } satisfies WeatherSnapshot);
      toast('Đã cập nhật dự báo');
    } catch (e: any) {
      toast(`Không lấy được thời tiết (${e.message}). Cần Internet.`, 'warn');
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="page">
      <PageHeader title="Thời tiết & trang phục" back={`/j/${j.id}`} />
      <div className="glass-card">
        <div className="row"><h3 className="grow">{city}</h3><button className="btn small" disabled={busy} onClick={fetchNow}><LuRefreshCw size={14} /> {busy ? 'Đang tải…' : 'Cập nhật'}</button></div>
        {!snap && <p className="muted small">Chưa có dữ liệu thời tiết thật. Nhấn “Cập nhật” khi có Internet.</p>}
        {snap && (
          <>
            <p className="muted xsmall">Nguồn: {snap.source} · lấy lúc {new Date(snap.fetchedAt).toLocaleString('vi-VN')} · {Date.now() - Date.parse(snap.fetchedAt) > 3 * 3600_000 ? 'dữ liệu cũ (offline / lần cuối)' : 'mới'}</p>
            <div className="weather-days">
              {snap.daily.map((d) => (
                <div key={d.date} className="wday"><span className="xsmall">{d.date.slice(5)}</span><span>{(WMO[d.code] ?? '·').split(' ')[0]}</span><b>{Math.round(d.max)}°</b><span className="muted">{Math.round(d.min)}°</span></div>
              ))}
            </div>
            <p className="muted xsmall">Dự báo chỉ có cho 7 ngày tới — không phải dự báo cho ngày đi nếu còn xa.</p>
          </>
        )}
      </div>
      <div className="glass-card">
        <h3>Ghi chú trang phục</h3>
        <p className="muted xsmall">{j.wardrobeHint ?? 'Hãy xem dự báo thật trước khi đi.'}</p>
        <textarea rows={8} value={notes} onChange={(e: any) => setNotes(e.target.value)} placeholder={j.wardrobePlaceholder ?? 'Ngày 1: áo khoác + khăn…'} />
        <p className="muted xsmall">Lưu tự động trên thiết bị. Xem thêm gợi ý dáng chụp trong tab Pose.</p>
      </div>
    </div>
  );
}

// ───────── Checklist
export function ChecklistPage() {
  const { journey: j } = useJourney();
  const items = useStore<ChecklistItem>('checklist', j.id).sort((a, b) => a.order - b.order);
  const [text, setText] = useState('');
  const [group, setGroup] = useState('Khác');
  const groups = Array.from(new Set(items.map((i) => i.group).concat('Khác')));
  const done = items.filter((i) => i.done).length;
  return (
    <div className="page">
      <PageHeader title="Checklist" sub={`${done}/${items.length} đã xong`} back={`/j/${j.id}`} />
      {groups.map((g) => {
        const list = items.filter((i) => i.group === g);
        if (!list.length) return null;
        return (
          <section key={g} className="glass-card">
            <h3>{g}</h3>
            {list.map((i) => (
              <div key={i.id} className="check-row">
                <label className="toggle-row grow"><input type="checkbox" checked={i.done} onChange={() => db.put('checklist', { ...i, done: !i.done })} /> <span className={i.done ? 'done' : ''}>{i.text}</span></label>
                <button className="icon-btn" aria-label="Xóa mục" onClick={() => db.del('checklist', i.id)}><LuTrash2 size={14} /></button>
              </div>
            ))}
          </section>
        );
      })}
      <div className="glass-card stack">
        <Field label="Mục mới"><input value={text} onChange={(e: any) => setText(e.target.value)} /></Field>
        <Field label="Nhóm"><input list="ck-groups" value={group} onChange={(e: any) => setGroup(e.target.value)} /><datalist id="ck-groups">{groups.map((g) => <option key={g} value={g} />)}</datalist></Field>
        <button className="btn" disabled={!text.trim()} onClick={async () => { await db.put('checklist', { id: uid('ck'), journeyId: j.id, group: group || 'Khác', text: text.trim(), done: false, order: items.length + 1 } satisfies ChecklistItem); setText(''); }}><LuPlus size={14} /> Thêm</button>
      </div>
    </div>
  );
}

// ───────── Emergency (offline) — public numbers by country (journey time zone)
const EMERGENCY: Record<string, [string, string, string][]> = {
  'Asia/Shanghai': [['110', 'Cảnh sát', '警察'], ['120', 'Cấp cứu', '急救'], ['119', 'Cứu hỏa', '火警']],
  'Asia/Seoul': [['112', 'Cảnh sát', '경찰'], ['119', 'Cấp cứu / cứu hỏa', '119 구급'], ['1330', 'Tổng đài du lịch', '관광안내']],
  'Asia/Tokyo': [['110', 'Cảnh sát', '警察'], ['119', 'Cấp cứu / cứu hỏa', '救急'], ['#7119', 'Tư vấn y tế', '救急相談']],
  'Asia/Ho_Chi_Minh': [['113', 'Cảnh sát', 'Công an'], ['115', 'Cấp cứu', 'Cấp cứu'], ['114', 'Cứu hỏa', 'Cứu hỏa']],
};
export function EmergencyPage() {
  const { journey: j } = useJourney();
  const toast = useToast();
  const [big, setBig] = useState<{ zh: string; py?: string; vi?: string } | null>(null);
  const numbers = EMERGENCY[j.timeZone];
  return (
    <div className="page">
      <PageHeader title="Khẩn cấp" sub="Dùng được offline" back={`/j/${j.id}`} />
      {numbers ? (
        <div className="emergency-grid">
          {numbers.map(([n, vi, local]) => (
            <a key={n + vi} className="emergency-btn" href={`tel:${n}`}><b>{n}</b><span>{vi}</span><span>{local}</span></a>
          ))}
        </div>
      ) : (
        <p className="warn-box small">Chưa có số khẩn cấp cho múi giờ {j.timeZone}. Hãy tra số địa phương trước khi đi.</p>
      )}
      <p className="muted xsmall">Nhấn số sẽ mở màn hình gọi của iPhone — bạn vẫn phải tự xác nhận cuộc gọi. Ứng dụng không tự gọi hay theo dõi vị trí.</p>
      {j.hotel && (
        <div className="glass-card">
          <h3>Khách sạn</h3>
          <p><b>{j.hotel.name}</b></p>
          {j.hotel.addressZh && <p className="zh big-zh" lang="zh-CN">{j.hotel.addressZh}</p>}
          {j.hotel.addressEn && <p className="small">{j.hotel.addressEn}</p>}
          <div className="row gap-s">
            <button className="btn small" onClick={async () => toast((await copyText(j.hotel!.addressZh ?? '')) ? 'Đã sao chép' : 'Không sao chép được')}><LuCopy size={14} /> Sao chép</button>
            {j.hotel.addressZh && <button className="btn small" onClick={() => setBig({ zh: `我住在：${j.hotel!.addressZh}`, vi: `Tôi ở tại: ${j.hotel!.name}` })}>Thẻ lớn</button>}
          </div>
        </div>
      )}
      <h3 className="section-title">Câu nói khẩn cấp</h3>
      <div className="stack-s">
        {PHRASES.filter((p) => p.group === 'Khẩn cấp').map((p) => (
          <button key={p.zh} className="phrase glass-card text-left" onClick={() => setBig({ zh: p.zh, py: p.py, vi: p.vi })}>
            <span className="zh big-zh" lang="zh-CN">{p.zh}</span>
            <span className="pinyin block">{p.py}</span>
            <span className="block">{p.vi}</span>
          </button>
        ))}
      </div>
      {big && <BigText {...big} onClose={() => setBig(null)} />}
    </div>
  );
}
