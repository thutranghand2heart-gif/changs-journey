import { useState } from 'react';
import { LuPencil, LuFileText } from 'react-icons/lu';
import type { Attachment, FlightInfo, TravelCardSettings, WalletDoc } from '../../db/schema';
import { updateJourney } from '../../db/repo';
import { Field, go, PageHeader, useStore } from '../../ui/core';
import { useJourney } from '../journey/JourneyShell';
import { publicDocs } from '../../lib/search';
import { attIds, hotelOf } from '../../lib/wallet';
import { t } from '../../lib/i18n';
import { DocViewer } from './WalletTab';
import { useCtState } from '../../ui/contentTx';
import { detectLang, displayText } from '../../lib/contentI18n';
import { airlineName, airportName, cityName } from '../../lib/cityNames';

// The CARD has its own display language (e.g. Chinese for an officer) — independent of the app language.
type L = 'vi' | 'zh' | 'en' | 'ko';
const CARD_LANG_KEY = 'chang-travelcard-lang';
const L10N: Record<string, Record<L, string>> = {
  title: { vi: 'Thông tin chuyến đi', zh: '旅行信息', en: 'Travel information', ko: '여행 정보' },
  purpose: { vi: 'Mục đích', zh: '目的', en: 'Purpose', ko: '목적' },
  tourism: { vi: 'Du lịch', zh: '旅游', en: 'Tourism', ko: '관광' },
  business: { vi: 'Công tác', zh: '商务', en: 'Business', ko: '출장' },
  family: { vi: 'Thăm thân', zh: '探亲访友', en: 'Visiting family/friends', ko: '친지 방문' },
  other: { vi: 'Khác', zh: '其他', en: 'Other', ko: '기타' },
  stay: { vi: 'Thời gian lưu trú', zh: '停留时间', en: 'Length of stay', ko: '체류 기간' },
  nights: { vi: 'đêm', zh: '晚', en: 'nights', ko: '박' },
  hotel: { vi: 'Nơi ở', zh: '住宿地址', en: 'Accommodation', ko: '숙소' },
  phone: { vi: 'Điện thoại', zh: '电话', en: 'Phone', ko: '전화' },
  arrival: { vi: 'Chuyến bay đến', zh: '入境航班', en: 'Arrival flight', ko: '입국 항공편' },
  return: { vi: 'Chuyến bay về', zh: '离境航班', en: 'Return flight', ko: '출국 항공편' },
  from: { vi: 'Đi', zh: '出发', en: 'From', ko: '출발' },
  to: { vi: 'Đến', zh: '到达', en: 'To', ko: '도착' },
  ref: { vi: 'Mã đặt chỗ', zh: '订座编号', en: 'Booking ref.', ko: '예약 번호' },
  itinerary: { vi: 'Lịch trình', zh: '行程', en: 'Itinerary', ko: '일정' },
  note: { vi: 'Thông tin do người du lịch tự nhập. Không phải giấy tờ chính thức.', zh: '以上信息由旅客本人填写，并非官方文件。', en: 'Entered by the traveller. Not an official document.', ko: '여행자가 직접 입력한 정보이며 공식 서류가 아닙니다.' },
};
const DEFAULT_SHOW: TravelCardSettings['show'] = { airportTimes: true, airline: true, hotelContact: false, itinerary: false, documents: true, bookingRefs: false };

export function TravelDocPage() {
  const { journey: j, days, activities, places } = useJourney();
  const docs = useStore<WalletDoc>('docs', j.id);
  const atts = useStore<Attachment>('attachments', j.id);
  const pub = publicDocs(docs);
  const flights = pub.filter((d) => d.category === 'flight');
  const hotels = pub.filter((d) => d.category === 'hotel');
  const [lang, setLangState] = useState<L>(() => { try { return (localStorage.getItem(CARD_LANG_KEY) as L) || 'zh'; } catch { return 'zh'; } });
  const setCardLang = (l: L) => { setLangState(l); try { localStorage.setItem(CARD_LANG_KEY, l); } catch { /* */ } };
  const [detail, setDetail] = useState(false);
  const [viewing, setViewing] = useState<Attachment | null>(null);
  const L = (k: string) => L10N[k][lang];

  // Default selection comes from the user's own records (direction field, or which trip day the flight is linked to).
  const dayOf = (d: WalletDoc) => days.find((x) => x.id === (d.dayId ?? activities.find((a) => d.activityIds.includes(a.id))?.dayId));
  const auto = (dir: 'outbound' | 'return') =>
    flights.find((d) => d.flight?.direction === dir)?.id ?? flights.find((d) => !d.flight?.direction && dayOf(d)?.index === (dir === 'outbound' ? 1 : days.length))?.id;
  const cfg: TravelCardSettings = { purpose: 'tourism', show: DEFAULT_SHOW, ...j.travelCard };
  const outId = j.travelCard?.outboundId ?? auto('outbound');
  const retId = j.travelCard?.returnId ?? auto('return');
  const save = (patch: Partial<TravelCardSettings>) => updateJourney(j.id, { travelCard: { purpose: cfg.purpose, show: cfg.show, outboundId: outId, returnId: retId, hotelId: j.travelCard?.hotelId, ...patch } });
  const show = { ...DEFAULT_SHOW, ...cfg.show };
  const out = flights.find((d) => d.id === outId);
  const ret = flights.find((d) => d.id === retId);
  const hotelDoc = hotels.find((d) => d.id === (j.travelCard?.hotelId ?? j.hotelDocId));
  const hotel = hotelDoc?.hotel?.name || hotelDoc?.hotel?.addressZh ? { name: hotelDoc.hotel.name ?? hotelDoc.title, nameZh: hotelDoc.hotel.nameZh, addressZh: hotelDoc.hotel.addressZh, addressEn: hotelDoc.hotel.addressEn, phone: hotelDoc.hotel.phone, bookingRef: hotelDoc.hotel.bookingRef } : hotelOf(j, docs);
  const nights = Math.round((Date.parse(j.endDate) - Date.parse(j.startDate)) / 86400000);
  // Itinerary in the CARD language: Chinese names the user entered (nameZh) first, then saved translations, then
  // built-in city names; anything else stays as the original text and is counted so the user can fix it.
  const { map: txMap } = useCtState();
  const inCard = (store: 'activities' | 'places' | 'days', rec: any, field: string): { text: string; local: boolean } => {
    const orig = (rec?.[field] ?? '').trim();
    if (!orig || detectLang(orig) === lang) return { text: orig, local: true };
    const r = displayText(txMap, store, rec, field, lang);
    return r.translated && r.text ? { text: r.text, local: true } : { text: orig, local: false };
  };
  let missingLocal = 0;
  const NO_STOP = new Set(['flight', 'transport', 'rest', 'hotel']);
  const itinerary = days
    .map((d) => {
      const acts = activities.filter((a) => a.dayId === d.id).sort((a, b) => (a.start ?? '99').localeCompare(b.start ?? '99'));
      const cities = Array.from(new Set(acts.map((a) => places.find((p) => p.id === a.placeId)?.city).filter(Boolean) as string[])).map((c) => {
        const known = cityName(c, lang);
        if (known) return known;
        const pl = places.find((p) => p.city === c);
        const x = inCard('places', pl, 'city');
        if (!x.local) missingLocal++;
        return x.text;
      });
      const stops: string[] = [];
      for (const a of acts) {
        if (NO_STOP.has(a.kind)) continue;
        const p = places.find((x) => x.id === a.placeId);
        let label: string | undefined;
        if (lang === 'zh') label = a.nameZh || p?.nameZh;
        if (!label) {
          const x = inCard('activities', a, 'title');
          const y = p ? inCard('places', p, 'name') : undefined;
          const pick = x.local ? x : y?.local ? y : x;
          if (!pick.local) missingLocal++;
          label = pick.text;
        }
        // generic entries ("Lunch", "Dinner") with no local name add nothing for an officer — leave them out
        if (a.kind === 'meal' && !(lang === 'zh' && (a.nameZh || p?.nameZh)) && !inCard('activities', a, 'title').local) {
          missingLocal = Math.max(0, missingLocal - 1);
          continue;
        }
        if (label && !stops.includes(label)) stops.push(label);
      }
      return { d, cities, stops };
    })
    .filter((x) => x.cities.length || x.stops.length);
  const fmtCardDate = (iso: string) => {
    try {
      return new Date(iso + 'T12:00:00').toLocaleDateString({ zh: 'zh-CN', en: 'en-GB', ko: 'ko-KR', vi: 'vi-VN' }[lang], { month: 'short', day: 'numeric', weekday: 'short' });
    } catch {
      return iso;
    }
  };

  const flightBlock = (d: WalletDoc | undefined, head: string) => {
    if (!d) return null;
    const f: FlightInfo = d.flight ?? {};
    const num = [airlineName(f.flightNumber, lang) ?? f.airline, f.flightNumber].filter(Boolean).join(' ');
    const ap = (x?: string) => airportName(x, lang) ?? x;
    const docTitle = displayText(txMap, 'docs', d, 'title', lang);
    return (
      <section>
        <h3>{L(head)}</h3>
        <p className="big">{num || (docTitle.translated ? docTitle.text : d.title)}</p>
        {(detail || show.airportTimes) && (f.depAirport || f.depTime) && <p>{L('from')}: {[ap(f.depAirport), f.depTerminal].filter(Boolean).join(' ')} {[f.depDate, f.depTime].filter(Boolean).join(' ')}</p>}
        {(detail || show.airportTimes) && (f.arrAirport || f.arrTime) && <p>{L('to')}: {[ap(f.arrAirport), f.arrTerminal].filter(Boolean).join(' ')} {[f.arrDate, f.arrTime].filter(Boolean).join(' ')}</p>}
        {show.bookingRefs && f.bookingRef && <p>{L('ref')}: {f.bookingRef}</p>}
        <button className="btn small ghost no-print" onClick={() => go(`/j/${j.id}/wallet?d=${d.id}`)}><LuPencil size={12} /> {t('Sửa thông tin')}</button>
        {!num && <p className="muted xsmall no-print">{t('Hồ sơ này chưa có chi tiết chuyến bay — bấm “Sửa thông tin” để bổ sung.')}</p>}
      </section>
    );
  };
  const linkedAtts = [out, ret, hotelDoc].filter(Boolean).flatMap((d) => attIds(d!)).map((id) => atts.find((a) => a.id === id)).filter(Boolean) as Attachment[];

  return (
    <div className="page">
      <PageHeader title={t('Thẻ thông tin nhập cảnh')} sub={t('Đưa cho nhân viên xem khi cần')} back={`/j/${j.id}`} />
      <div className="seg no-print" role="group" aria-label={t('Ngôn ngữ hiển thị của thẻ')}>
        {(['zh', 'en', 'ko', 'vi'] as L[]).map((l) => <button key={l} className={lang === l ? 'on' : ''} onClick={() => setCardLang(l)}>{({ zh: '中文', en: 'English', ko: '한국어', vi: t('Tiếng Việt') } as const)[l]}</button>)}
      </div>
      <p className="muted xsmall no-print">{t('Ngôn ngữ của thẻ độc lập với ngôn ngữ ứng dụng.')}</p>
      <div className="seg no-print">
        <button className={!detail ? 'on' : ''} onClick={() => setDetail(false)}>{t('Ngắn gọn')}</button>
        <button className={detail ? 'on' : ''} onClick={() => setDetail(true)}>{t('Chi tiết')}</button>
      </div>

      <article className="travel-doc printable" lang={lang === 'zh' ? 'zh-CN' : lang} data-testid="travel-card">
        <h2>{L('title')}</h2>
        <p className="big">{L('purpose')}: {L(cfg.purpose)}</p>
        <section>
          <h3>{L('stay')}</h3>
          <p>{j.startDate} → {j.endDate} ({nights} {L('nights')})</p>
        </section>
        {hotel && (
          <section>
            <h3>{L('hotel')}</h3>
            <p className="big">{lang === 'zh' && hotel.nameZh ? hotel.nameZh : hotel.name}</p>
            {lang === 'zh' && hotel.nameZh && detail && hotel.name && <p>{hotel.name}</p>}
            {hotel.addressZh && <p className="big-zh" lang="zh-CN">{hotel.addressZh}</p>}
            {(detail || lang !== 'zh') && hotel.addressEn && <p>{hotel.addressEn}</p>}
            {(detail || show.hotelContact) && hotel.phone && <p>{L('phone')}: {hotel.phone}</p>}
            {hotelDoc && <button className="btn small ghost no-print" onClick={() => go(`/j/${j.id}/wallet?d=${hotelDoc.id}`)}><LuPencil size={12} /> {t('Sửa thông tin')}</button>}
          </section>
        )}
        {flightBlock(out, 'arrival')}
        {flightBlock(ret, 'return')}
        {(detail || show.itinerary) && itinerary.length > 0 && (
          <section data-testid="travel-card-itinerary">
            <h3>{L('itinerary')}</h3>
            {itinerary.map(({ d, cities, stops }) => (
              <p key={d.id} className="itin-day">
                <b>{fmtCardDate(d.date)}</b> {cities.join('、')}{cities.length && stops.length ? ' — ' : ''}{stops.join(lang === 'zh' ? '、' : ', ')}
              </p>
            ))}
            {missingLocal > 0 && <p className="muted xsmall no-print">{t('{0} mục chưa có tên bằng ngôn ngữ của thẻ nên đang hiện bản gốc. Thêm tên tiếng Trung cho hoạt động/địa điểm, hoặc dùng “Dịch nội dung bạn nhập”.', missingLocal)}</p>}
          </section>
        )}
        <p className="muted xsmall">{L('note')}</p>
      </article>

      {(detail || show.documents) && linkedAtts.length > 0 && (
        <section className="card no-print">
          <h4><LuFileText size={14} /> {t('Giấy tờ gốc đã liên kết')}</h4>
          {linkedAtts.map((a) => <button key={a.id} className="list-row" onClick={() => setViewing(a)}>📄 {a.label}</button>)}
          <p className="muted xsmall">{t('Mở tệp gốc trong Ví — không tạo bản sao. Không xuất hiện khi in.')}</p>
        </section>
      )}

      <details className="card no-print" open={!out && !ret}>
        <summary>{t('Chọn thông tin hiển thị')}</summary>
        <div className="stack-s">
          <Field label={t('Chuyến bay đến (chiều đi)')}>
            <select value={outId ?? ''} onChange={(e: any) => save({ outboundId: e.target.value || undefined })}>
              <option value="">{t('— Không hiển thị —')}</option>
              {flights.map((d) => <option key={d.id} value={d.id}>{d.title}</option>)}
            </select>
          </Field>
          <Field label={t('Chuyến bay về')}>
            <select value={retId ?? ''} onChange={(e: any) => save({ returnId: e.target.value || undefined })}>
              <option value="">{t('— Không hiển thị —')}</option>
              {flights.map((d) => <option key={d.id} value={d.id}>{d.title}</option>)}
            </select>
          </Field>
          <Field label={t('Khách sạn')}>
            <select value={j.travelCard?.hotelId ?? j.hotelDocId ?? ''} onChange={(e: any) => save({ hotelId: e.target.value || undefined })}>
              <option value="">{t('Thông tin khách sạn của chuyến đi')}</option>
              {hotels.map((d) => <option key={d.id} value={d.id}>{d.title}</option>)}
            </select>
          </Field>
          <Field label={t('Mục đích chuyến đi')}>
            <select value={cfg.purpose} onChange={(e: any) => save({ purpose: e.target.value })}>
              <option value="tourism">{t('Du lịch')}</option>
              <option value="business">{t('Công tác')}</option>
              <option value="family">{t('Thăm thân')}</option>
              <option value="other">{t('Khác')}</option>
            </select>
          </Field>
          {([
            ['airportTimes', t('Sân bay, nhà ga & giờ bay')], ['hotelContact', t('Điện thoại khách sạn')], ['itinerary', t('Tóm tắt lịch trình theo thành phố')], ['documents', t('Lối tắt tới giấy tờ gốc')], ['bookingRefs', t('Mã đặt chỗ (nhạy cảm — tắt mặc định)')],
          ] as [keyof TravelCardSettings['show'], string][]).map(([k, l]) => (
            <label key={k} className="toggle-row small"><input type="checkbox" checked={show[k]} onChange={(e: any) => save({ show: { ...show, [k]: e.target.checked } })} /> {t(l)}</label>
          ))}
          {!flights.length && <p className="muted small">{t('Chưa có hồ sơ chuyến bay trong Ví.')} <button className="link-btn" onClick={() => go(`/j/${j.id}/wallet`)}>{t('Mở Ví')}</button></p>}
        </div>
      </details>
      <button className="btn no-print" onClick={() => print()}>{t('In / Lưu PDF (qua menu Chia sẻ của trình duyệt)')}</button>
      <p className="muted xsmall no-print">{t('Thông tin chỉ lấy từ những gì bạn đã nhập. Ứng dụng không tạo giấy tờ, thị thực hay xác nhận của hãng bay. Mã QR và số hộ chiếu không bao giờ hiển thị trên thẻ.')}</p>
      {viewing && <DocViewer att={viewing} onClose={() => setViewing(null)} />}
    </div>
  );
}
