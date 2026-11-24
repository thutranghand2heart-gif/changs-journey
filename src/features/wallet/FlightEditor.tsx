import { useState } from 'react';
import type { FlightInfo, WalletDoc } from '../../db/schema';
import { Field } from '../../ui/core';
import { useJourney } from '../journey/JourneyShell';
import { flightSuggestions, type Suggestion } from '../../lib/wallet';
import { t, tr } from '../../lib/i18n';
import { tzLabel } from '../../lib/time';

const TZS = ['Asia/Seoul', 'Asia/Shanghai', 'Asia/Tokyo', 'Asia/Ho_Chi_Minh', 'Asia/Hong_Kong', 'Asia/Taipei', 'Asia/Bangkok', 'Asia/Singapore', 'Europe/Paris', 'Europe/London', 'America/New_York', 'UTC'];
const FIELD_LABEL: Record<keyof FlightInfo, string> = {
  direction: tr('Chiều bay'), airline: tr('Hãng bay'), flightNumber: tr('Số hiệu chuyến bay'), depAirport: tr('Sân bay đi'), arrAirport: tr('Sân bay đến'),
  depTerminal: tr('Nhà ga đi'), arrTerminal: tr('Nhà ga đến'), depDate: tr('Ngày đi'), depTime: tr('Giờ cất cánh (giờ địa phương)'), depTz: tr('Múi giờ nơi đi'),
  arrDate: tr('Ngày đến'), arrTime: tr('Giờ hạ cánh (giờ địa phương)'), arrTz: tr('Múi giờ nơi đến'), passenger: tr('Hành khách'), bookingRef: tr('Mã đặt chỗ'), seat: tr('Ghế'), baggage: tr('Hành lý'),
};

/** One-line summary used in Wallet cards and the travel card. User data only. */
export function flightLine(f: FlightInfo): string {
  const dep = [f.depAirport, f.depTerminal].filter(Boolean).join(' ');
  const arr = [f.arrAirport, f.arrTerminal].filter(Boolean).join(' ');
  return [f.airline, f.flightNumber].filter(Boolean).join(' ') + (dep || arr ? ` · ${dep}${f.depTime ? ' ' + f.depTime : ''} → ${arr}${f.arrTime ? ' ' + f.arrTime : ''}` : '');
}

export function FlightEditor({ d, onChange }: { d: WalletDoc; onChange: (d: WalletDoc) => void }) {
  const { activities, days, places } = useJourney();
  const f = d.flight ?? {};
  const set = (k: keyof FlightInfo) => (e: any) => onChange({ ...d, flight: { ...f, [k]: e.target.value || undefined } });
  const [sugs, setSugs] = useState<Suggestion[] | null>(null);
  const [pick, setPick] = useState<Record<string, boolean>>({});

  const text = (k: keyof FlightInfo, extra: Record<string, unknown> = {}) => (
    <Field label={t(FIELD_LABEL[k])}><input value={(f[k] as string) ?? ''} onChange={set(k)} {...extra} /></Field>
  );
  const tz = (k: 'depTz' | 'arrTz') => (
    <Field label={t(FIELD_LABEL[k])}>
      <select value={f[k] ?? ''} onChange={set(k)}>
        <option value="">—</option>
        {TZS.map((z) => <option key={z} value={z}>{t(tzLabel(z))}</option>)}
      </select>
    </Field>
  );

  return (
    <div className="card stack-s" aria-label={t('Chi tiết chuyến bay')}>
      <h4>✈️ {t('Chi tiết chuyến bay')}</h4>
      <Field label={t(FIELD_LABEL.direction)}>
        <select value={f.direction ?? ''} onChange={set('direction')}>
          <option value="">—</option>
          <option value="outbound">{t('Chiều đi')}</option>
          <option value="return">{t('Chiều về')}</option>
          <option value="other">{t('Khác')}</option>
        </select>
      </Field>
      <div className="row gap">{text('airline')}{text('flightNumber', { autoCapitalize: 'characters' })}</div>
      <div className="row gap">{text('depAirport')}{text('depTerminal')}</div>
      <div className="row gap">
        <Field label={t(FIELD_LABEL.depDate)}><input type="date" value={f.depDate ?? ''} onChange={set('depDate')} /></Field>
        <Field label={t(FIELD_LABEL.depTime)}><input type="time" value={f.depTime ?? ''} onChange={set('depTime')} /></Field>
      </div>
      {tz('depTz')}
      <div className="row gap">{text('arrAirport')}{text('arrTerminal')}</div>
      <div className="row gap">
        <Field label={t(FIELD_LABEL.arrDate)}><input type="date" value={f.arrDate ?? ''} onChange={set('arrDate')} /></Field>
        <Field label={t(FIELD_LABEL.arrTime)}><input type="time" value={f.arrTime ?? ''} onChange={set('arrTime')} /></Field>
      </div>
      {tz('arrTz')}
      <details>
        <summary>{t('Thông tin tùy chọn')}</summary>
        <div className="stack-s">
          {text('passenger')}
          {text('bookingRef', { autoCapitalize: 'characters' })}
          <div className="row gap">{text('seat')}{text('baggage')}</div>
          <p className="muted xsmall">{t('Mã đặt chỗ không hiển thị trên thẻ nhập cảnh khi in hoặc chia sẻ, trừ khi bạn bật.')}</p>
        </div>
      </details>
      <button className="btn small ghost" onClick={() => (setSugs(flightSuggestions(d, activities, days, places)), setPick({}))}>{t('Gợi ý từ lịch trình đã liên kết…')}</button>
      {sugs && (
        <div className="card stack-s" aria-label={t('Gợi ý cần xác nhận')}>
          {!sugs.length && <p className="muted small">{t('Không có gợi ý: hãy liên kết hồ sơ với hoạt động chuyến bay trong lịch trình, hoặc nhập tay.')}</p>}
          {sugs.length > 0 && <p className="small">{t('Chỉ lấy từ dữ liệu của chính bạn. Chọn những mục đúng rồi bấm Áp dụng:')}</p>}
          {sugs.map((s) => (
            <label key={s.field} className="toggle-row small">
              <input type="checkbox" checked={!!pick[s.field]} onChange={(e: any) => setPick({ ...pick, [s.field]: e.target.checked })} />
              <span><b>{t(FIELD_LABEL[s.field])}:</b> {s.field.endsWith('Tz') ? t(tzLabel(s.value)) : s.value} <span className="muted xsmall">← {s.source === 'title' ? t('tên hồ sơ') : s.source}</span></span>
            </label>
          ))}
          {sugs.length > 0 && (
            <button
              className="btn small primary"
              disabled={!Object.values(pick).some(Boolean)}
              onClick={() => {
                const next = { ...f };
                for (const s of sugs) if (pick[s.field]) (next as any)[s.field] = s.value;
                onChange({ ...d, flight: next });
                setSugs(null);
              }}
            >
              {t('Áp dụng')}
            </button>
          )}
          <p className="muted xsmall">{t('Bản này chưa tự đọc nội dung PDF. Không có tệp nào được gửi ra ngoài.')}</p>
        </div>
      )}
    </div>
  );
}
