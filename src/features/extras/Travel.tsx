import { createPortal } from 'react-dom';
import { useEffect, useState } from 'react';
import { LuCopy, LuVolume2, LuMaximize2, LuX, LuPlus, LuTrash2, LuRefreshCw } from 'react-icons/lu';
import type { ChecklistItem, Place, WalletDoc, WeatherSnapshot } from '../../db/schema';
import { hotelOf } from '../../lib/wallet';
import { db } from '../../db/repo';
import { Field, PageHeader, queryParam, useLive, useStore, useToast } from '../../ui/core';
import { useJourney } from '../journey/JourneyShell';
import { meaningOf, PHRASES } from '../../lib/phrases';
import { copyText, nowIso, uid } from '../../lib/util';
import { speak, speechSupported } from '../../lib/speech';
import { getLang, locale, t, tr } from '../../lib/i18n';
import { Tx } from '../../ui/contentTx';

// ───────── Large text card (show to drivers / staff)
export function BigText({ zh, py, vi, onClose }: { zh: string; py?: string; vi?: string; onClose: () => void }) {
  return createPortal(
    <div className="bigtext" role="dialog" aria-modal="true" onClick={onClose}>
      <button className="icon-btn bigtext-close" aria-label={t('Đóng')}><LuX size={28} /></button>
      <p className="bigtext-zh" lang="zh-CN">{zh}</p>
      {py && <p className="bigtext-py">{py}</p>}
      {vi && <p className="bigtext-vi">{vi}</p>}
    </div>,
    document.body,
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
      <PageHeader title={t('Trợ lý ngôn ngữ')} sub={t('Chữ Hán · Pinyin · Tiếng Việt')} back={`/j/${j.id}`} />
      {!tts && <p className="muted small">{t('Thiết bị/trình duyệt này không hỗ trợ đọc thành tiếng.')}</p>}
      {tts && <p className="muted xsmall">{t('Đọc thành tiếng dùng giọng có sẵn của iPhone; có hoạt động offline hay không tùy giọng đã tải trên máy (chưa được kiểm chứng).')}</p>}
      <div className="seg scroll-x">
        <button className={group === 'all' ? 'on' : ''} onClick={() => setGroup('all')}>{t('Tất cả')}</button>
        {groups.map((g) => <button key={g} className={group === g ? 'on' : ''} onClick={() => setGroup(g)}>{t(g)}</button>)}
      </div>
      <div className="stack-s">
        {phrases.filter((p) => group === 'all' || p.group === group).map((p) => (
          <div key={p.zh} className="phrase glass-card">
            <p className="zh big-zh" lang="zh-CN">{p.zh}</p>
            <p className="pinyin">{p.py}</p>
            <p>{meaningOf(p, getLang())}</p>
            <div className="row gap-s">
              <button className="btn small ghost" onClick={async () => toast((await copyText(p.zh)) ? t('Đã sao chép') : t('Không sao chép được'))} aria-label={t('Sao chép')}><LuCopy size={14} /></button>
              <button className="btn small ghost" onClick={() => setBig({ zh: p.zh, py: p.py, vi: meaningOf(p, getLang()) })} aria-label={t('Hiện chữ lớn')}><LuMaximize2 size={14} /></button>
              {tts && <button className="btn small ghost" aria-label={t('Nghe')} onClick={async () => !(await speak(p.zh)) && toast(t('Không phát được giọng tiếng Trung trên thiết bị này'), 'warn')}><LuVolume2 size={14} /></button>}
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
  const hotel = hotelOf(j, useStore<WalletDoc>('docs', j.id));
  const [big, setBig] = useState<{ zh: string; py?: string; vi?: string } | null>(() => {
    if (queryParam('card') === 'hotel' && hotel?.addressZh) return { zh: `请带我去：${hotel.addressZh}`, py: t('Qǐng dài wǒ qù'), vi: t('Làm ơn đưa tôi đến {0}', hotel.name) };
    return null;
  });
  const transport = activities.filter((a) => a.kind === 'transport' || a.kind === 'flight');
  const cardPlaces = places.filter((p) => p.addressZh);
  return (
    <div className="page">
      <PageHeader title={t('Di chuyển thông minh')} back={`/j/${j.id}`} />
      <h3 className="section-title">{t('Thẻ taxi / DiDi (tiếng Trung)')}</h3>
      <div className="stack-s">
        {cardPlaces.map((p: Place) => (
          <div key={p.id} className="glass-card list-row">
            <span className="grow"><b><Tx s="places" r={p} f="name" /></b><span className="zh xsmall block" lang="zh-CN">{p.addressZh}</span></span>
            <button className="btn small" onClick={() => setBig({ zh: `请带我去：${p.addressZh}`, vi: t('Làm ơn đưa tôi đến {0}', p.name) })}>{t('Thẻ lớn')}</button>
            <button className="icon-btn" aria-label={t('Sao chép địa chỉ')} onClick={async () => toast((await copyText(p.addressZh!)) ? t('Đã sao chép') : t('Không sao chép được'))}><LuCopy size={16} /></button>
          </div>
        ))}
      </div>
      <h3 className="section-title">{t('Các chặng di chuyển trong lịch trình')}</h3>
      <div className="stack-s">
        {transport.map((a) => (
          <div key={a.id} className="glass-card">
            <b>{a.start ? `${a.approxTime ? '~' : ''}${a.start} · ` : ''}<Tx s="activities" r={a} f="title" /></b>
            {a.timeZoneLabel && <span className="tz-badge">{t(a.timeZoneLabel)}</span>}
            {a.nameZh && <p className="zh small" lang="zh-CN">{a.nameZh}</p>}
            {a.descriptionVi && <p className="small muted"><Tx s="activities" r={a} f="descriptionVi" /></p>}
          </div>
        ))}
      </div>
      <div className="glass-card small">
        <h4>{t('Ghi chú chung')}</h4>
        <ul>
          {(j.transportNotes ?? [t('Tàu cao tốc: mang hộ chiếu (dùng để mua/soát vé).')]).map((n, k) => <li key={k}>{j.transportNotes ? <Tx s="journeys" r={j} f={`transportNotes.${k}`} /> : n}</li>)}
        </ul>
        <p className="muted xsmall">{t('Giờ tàu và giá vé không được ứng dụng xác minh — hãy kiểm tra trong ứng dụng đặt vé chính thức.')}</p>
      </div>
      {big && <BigText {...big} onClose={() => setBig(null)} />}
    </div>
  );
}

// ───────── Weather & wardrobe (only real data, timestamped)
const WMO: Record<number, string> = { 0: '☀️ Quang', 1: tr('🌤️ Ít mây'), 2: tr('⛅ Mây rải rác'), 3: tr('☁️ Nhiều mây'), 45: tr('🌫️ Sương mù'), 48: tr('🌫️ Sương mù'), 51: tr('🌦️ Mưa phùn'), 53: tr('🌦️ Mưa phùn'), 55: tr('🌧️ Mưa phùn'), 61: tr('🌧️ Mưa nhẹ'), 63: tr('🌧️ Mưa'), 65: tr('🌧️ Mưa to'), 71: tr('🌨️ Tuyết nhẹ'), 73: tr('🌨️ Tuyết'), 75: tr('❄️ Tuyết dày'), 80: tr('🌦️ Mưa rào'), 81: tr('🌧️ Mưa rào'), 82: tr('⛈️ Mưa rào mạnh'), 95: tr('⛈️ Dông') };

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
    if (!c) return toast(t('Chưa có toạ độ cho thành phố này'), 'warn');
    setBusy(true);
    try {
      const r = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${c[0].toFixed(3)}&longitude=${c[1].toFixed(3)}&daily=weather_code,temperature_2m_max,temperature_2m_min&timezone=${encodeURIComponent(j.timeZone)}&forecast_days=7`);
      if (!r.ok) throw new Error('HTTP ' + r.status);
      const d = await r.json();
      const daily = d.daily.time.map((t: string, i: number) => ({ date: t, max: d.daily.temperature_2m_max[i], min: d.daily.temperature_2m_min[i], code: d.daily.weather_code[i] }));
      await db.put('weather', { journeyId: j.id, city: city!, fetchedAt: nowIso(), source: 'Open-Meteo', daily } satisfies WeatherSnapshot);
      toast(t('Đã cập nhật dự báo'));
    } catch (e: any) {
      toast(t('Không lấy được thời tiết ({0}). Cần Internet.', e.message), 'warn');
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="page">
      <PageHeader title={t('Thời tiết & trang phục')} back={`/j/${j.id}`} />
      <div className="glass-card">
        <div className="row"><h3 className="grow">{city}</h3><button className="btn small" disabled={busy} onClick={fetchNow}><LuRefreshCw size={14} /> {busy ? t('Đang tải…') : t('Cập nhật')}</button></div>
        {!snap && <p className="muted small">{t('Chưa có dữ liệu thời tiết thật. Nhấn “Cập nhật” khi có Internet.')}</p>}
        {snap && (
          <>
            <p className="muted xsmall">{t('Nguồn:')}{' '}{snap.source} {' '}{t('· lấy lúc')}{' '}{new Date(snap.fetchedAt).toLocaleString(locale())} · {Date.now() - Date.parse(snap.fetchedAt) > 3 * 3600_000 ? t('dữ liệu cũ (offline / lần cuối)') : t('mới')}</p>
            <div className="weather-days">
              {snap.daily.map((d) => (
                <div key={d.date} className="wday"><span className="xsmall">{d.date.slice(5)}</span><span>{(WMO[d.code] ?? '·').split(' ')[0]}</span><b>{Math.round(d.max)}°</b><span className="muted">{Math.round(d.min)}°</span></div>
              ))}
            </div>
            <p className="muted xsmall">{t('Dự báo chỉ có cho 7 ngày tới — không phải dự báo cho ngày đi nếu còn xa.')}</p>
          </>
        )}
      </div>
      <div className="glass-card">
        <h3>{t('Ghi chú trang phục')}</h3>
        <p className="muted xsmall">{j.wardrobeHint ? <Tx s="journeys" r={j} f="wardrobeHint" /> : t('Hãy xem dự báo thật trước khi đi.')}</p>
        <textarea rows={8} value={notes} onChange={(e: any) => setNotes(e.target.value)} placeholder={j.wardrobePlaceholder ?? t('Ngày 1: áo khoác + khăn…')} />
        <p className="muted xsmall">{t('Lưu tự động trên thiết bị. Xem thêm gợi ý dáng chụp trong tab Pose.')}</p>
      </div>
    </div>
  );
}

// ───────── Checklist
export function ChecklistPage() {
  const { journey: j } = useJourney();
  const items = useStore<ChecklistItem>('checklist', j.id).sort((a, b) => a.order - b.order);
  const [text, setText] = useState('');
  const [group, setGroup] = useState(t('Khác'));
  const groups = Array.from(new Set(items.map((i) => i.group).concat(t('Khác'))));
  const done = items.filter((i) => i.done).length;
  return (
    <div className="page">
      <PageHeader title={t('Checklist')} sub={t('{0}/{1} đã xong', done, items.length)} back={`/j/${j.id}`} />
      {groups.map((g) => {
        const list = items.filter((i) => i.group === g);
        if (!list.length) return null;
        return (
          <section key={g} className="glass-card">
            <h3>{g}</h3>
            {list.map((i) => (
              <div key={i.id} className="check-row">
                <label className="toggle-row grow"><input type="checkbox" checked={i.done} onChange={() => db.put('checklist', { ...i, done: !i.done })} /> <span className={i.done ? 'done' : ''}><Tx s="checklist" r={i} f="text" /></span></label>
                <button className="icon-btn" aria-label={t('Xóa mục')} onClick={() => db.del('checklist', i.id)}><LuTrash2 size={14} /></button>
              </div>
            ))}
          </section>
        );
      })}
      <div className="glass-card stack">
        <Field label={t('Mục mới')}><input value={text} onChange={(e: any) => setText(e.target.value)} /></Field>
        <Field label={t('Nhóm')}><input list="ck-groups" value={group} onChange={(e: any) => setGroup(e.target.value)} /><datalist id="ck-groups">{groups.map((g) => <option key={g} value={g} />)}</datalist></Field>
        <button className="btn" disabled={!text.trim()} onClick={async () => { await db.put('checklist', { id: uid('ck'), journeyId: j.id, group: group || t('Khác'), text: text.trim(), done: false, order: items.length + 1 } satisfies ChecklistItem); setText(''); }}><LuPlus size={14} /> {' '}{t('Thêm')}</button>
      </div>
    </div>
  );
}

// ───────── Emergency (offline) — public numbers by country (journey time zone)
const EMERGENCY: Record<string, [string, string, string][]> = {
  'Asia/Shanghai': [['110', tr('Cảnh sát'), '警察'], ['120', tr('Cấp cứu'), '急救'], ['119', tr('Cứu hỏa'), '火警']],
  'Asia/Seoul': [['112', tr('Cảnh sát'), '경찰'], ['119', tr('Cấp cứu / cứu hỏa'), '119 구급'], ['1330', tr('Tổng đài du lịch'), '관광안내']],
  'Asia/Tokyo': [['110', tr('Cảnh sát'), '警察'], ['119', tr('Cấp cứu / cứu hỏa'), '救急'], ['#7119', tr('Tư vấn y tế'), '救急相談']],
  'Asia/Ho_Chi_Minh': [['113', tr('Cảnh sát'), 'Công an'], ['115', tr('Cấp cứu'), 'Cấp cứu'], ['114', tr('Cứu hỏa'), 'Cứu hỏa']],
};
export function EmergencyPage() {
  const { journey: j } = useJourney();
  const toast = useToast();
  const hotel = hotelOf(j, useStore<WalletDoc>('docs', j.id));
  const [big, setBig] = useState<{ zh: string; py?: string; vi?: string } | null>(null);
  const numbers = EMERGENCY[j.timeZone];
  return (
    <div className="page">
      <PageHeader title={t('Khẩn cấp')} sub={t('Dùng được offline')} back={`/j/${j.id}`} />
      {numbers ? (
        <div className="emergency-grid">
          {numbers.map(([n, vi, local]) => (
            <a key={n + vi} className="emergency-btn" href={`tel:${n}`}><b>{n}</b><span>{t(vi)}</span><span>{local}</span></a>
          ))}
        </div>
      ) : (
        <p className="warn-box small">{t('Chưa có số khẩn cấp cho múi giờ')}{' '}{j.timeZone}{t('. Hãy tra số địa phương trước khi đi.')}</p>
      )}
      <p className="muted xsmall">{t('Nhấn số sẽ mở màn hình gọi của iPhone — bạn vẫn phải tự xác nhận cuộc gọi. Ứng dụng không tự gọi hay theo dõi vị trí.')}</p>
      {hotel && (
        <div className="glass-card">
          <h3>{t('Khách sạn')}</h3>
          <p><b>{hotel.name}</b></p>
          {hotel.addressZh && <p className="zh big-zh" lang="zh-CN">{hotel.addressZh}</p>}
          {hotel.addressEn && <p className="small">{hotel.addressEn}</p>}
          <div className="row gap-s">
            <button className="btn small" onClick={async () => toast((await copyText(hotel!.addressZh ?? '')) ? t('Đã sao chép') : t('Không sao chép được'))}><LuCopy size={14} /> {' '}{t('Sao chép')}</button>
            {hotel.addressZh && <button className="btn small" onClick={() => setBig({ zh: `我住在：${hotel!.addressZh}`, vi: t('Tôi ở tại: {0}', hotel!.name) })}>{t('Thẻ lớn')}</button>}
          </div>
        </div>
      )}
      <h3 className="section-title">{t('Câu nói khẩn cấp')}</h3>
      <div className="stack-s">
        {PHRASES.filter((p) => p.group === 'Khẩn cấp').map((p) => (
          <button key={p.zh} className="phrase glass-card text-left" onClick={() => setBig({ zh: p.zh, py: p.py, vi: meaningOf(p, getLang()) })}>
            <span className="zh big-zh" lang="zh-CN">{p.zh}</span>
            <span className="pinyin block">{p.py}</span>
            <span className="block">{meaningOf(p, getLang())}</span>
          </button>
        ))}
      </div>
      {big && <BigText {...big} onClose={() => setBig(null)} />}
    </div>
  );
}
