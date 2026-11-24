import { useState } from 'react';
import type { WalletDoc } from '../../db/schema';
import { PageHeader, useStore } from '../../ui/core';
import { useJourney } from '../journey/JourneyShell';
import { publicDocs } from '../../lib/search';

type L = 'vi' | 'zh' | 'en' | 'ko';
const LBL: Record<string, Record<L, string>> = {
  title: { vi: 'Thông tin chuyến đi', zh: '旅行信息', en: 'Travel information', ko: '여행 정보' },
  purpose: { vi: 'Mục đích: Du lịch', zh: '目的：旅游', en: 'Purpose: Tourism', ko: '목적: 관광' },
  stay: { vi: 'Thời gian lưu trú', zh: '停留时间', en: 'Length of stay', ko: '체류 기간' },
  hotel: { vi: 'Nơi ở', zh: '住宿地址', en: 'Accommodation', ko: '숙소' },
  flights: { vi: 'Chuyến bay', zh: '航班', en: 'Flights', ko: '항공편' },
  note: { vi: 'Thông tin do người du lịch tự nhập. Không phải giấy tờ chính thức.', zh: '以上信息由旅客本人填写，并非官方文件。', en: 'Entered by the traveller. Not an official document.', ko: '여행자가 직접 입력한 정보이며 공식 서류가 아닙니다.' },
};

export function TravelDocPage() {
  const { journey: j } = useJourney();
  const docs = publicDocs(useStore<WalletDoc>('docs', j.id));
  const flights = docs.filter((d) => d.category === 'flight');
  const [lang, setLang] = useState<L>('zh');
  const [detail, setDetail] = useState(false);
  const nights = Math.round((Date.parse(j.endDate) - Date.parse(j.startDate)) / 86400000);
  return (
    <div className="page">
      <PageHeader title="Thẻ thông tin nhập cảnh" sub="Đưa cho nhân viên xem khi cần" back={`/j/${j.id}`} />
      <div className="seg no-print">
        {(['zh', 'en', 'ko', 'vi'] as L[]).map((l) => <button key={l} className={lang === l ? 'on' : ''} onClick={() => setLang(l)}>{({ zh: '中文', en: 'English', ko: '한국어', vi: 'Tiếng Việt' } as const)[l]}</button>)}
      </div>
      <div className="seg no-print">
        <button className={!detail ? 'on' : ''} onClick={() => setDetail(false)}>Ngắn gọn</button>
        <button className={detail ? 'on' : ''} onClick={() => setDetail(true)}>Chi tiết</button>
      </div>
      <article className="travel-doc printable" lang={lang === 'zh' ? 'zh-CN' : lang}>
        <h2>{LBL.title[lang]}</h2>
        <p className="big">{LBL.purpose[lang]}</p>
        {j.hotel && (
          <section>
            <h3>{LBL.hotel[lang]}</h3>
            <p className="big">{j.hotel.name}</p>
            {j.hotel.addressZh && <p className="big-zh" lang="zh-CN">{j.hotel.addressZh}</p>}
            {(detail || lang !== 'zh') && j.hotel.addressEn && <p>{j.hotel.addressEn}</p>}
          </section>
        )}
        <section>
          <h3>{LBL.stay[lang]}</h3>
          <p>{j.startDate} → {j.endDate} ({nights} {lang === 'zh' ? '晚' : lang === 'ko' ? '박' : lang === 'en' ? 'nights' : 'đêm'})</p>
        </section>
        {flights.length > 0 && (
          <section>
            <h3>{LBL.flights[lang]}</h3>
            {flights.map((f) => (
              <div key={f.id}>
                <p><b>{f.title}</b></p>
                {detail && <pre className="details-box">{f.details}</pre>}
              </div>
            ))}
          </section>
        )}
        <p className="muted xsmall">{LBL.note[lang]}</p>
      </article>
      <button className="btn no-print" onClick={() => print()}>In / Lưu PDF (qua menu Chia sẻ của trình duyệt)</button>
      <p className="muted xsmall no-print">Thông tin chỉ lấy từ những gì bạn đã nhập. Ứng dụng không tạo giấy tờ, thị thực hay xác nhận của hãng bay.</p>
    </div>
  );
}
