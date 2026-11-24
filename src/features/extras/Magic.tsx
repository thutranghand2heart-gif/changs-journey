import { useState } from 'react';
import { PageHeader, go } from '../../ui/core';
import { useJourney } from '../journey/JourneyShell';
import { useApp } from '../../ui/app-context';
import { Snow } from '../../art/Snow';
import { todayIn } from '../../lib/time';
import { updateJourneySettings } from '../../db/repo';
import { t, tr } from '../../lib/i18n';
import { Tx } from '../../ui/contentTx';

const DEFAULT_ADVENT = [
  tr('Một tách trà nóng là khởi đầu của mọi câu chuyện.'), tr('Viết ra ba điều bạn mong chờ ở chuyến đi.'), tr('Chọn một chiếc khăn quàng thật ấm.'), tr('Tập nói: 圣诞快乐 — Shèngdàn kuàilè!'),
  tr('Sạc đầy pin máy ảnh và dọn chỗ trong bộ nhớ.'), tr('Nghe một bản nhạc khiến bạn thấy bình yên.'), tr('Lưu địa chỉ nơi ở bằng tiếng địa phương.'), tr('Chọn trang phục cho những bức ảnh đẹp nhất.'),
  tr('Viết một lá thư nhỏ gửi chính mình của năm sau.'), tr('Tưởng tượng thành phố lúc lên đèn.'), tr('Tập nói: 谢谢 — Xièxie.'), tr('Kiểm tra hộ chiếu và giấy tờ.'),
  tr('Mỗi bước chân đều có một câu chuyện.'), tr('Thêm vé thật vào Ví và mở thử một lần.'), tr('Chuẩn bị một món quà nhỏ cho chính mình.'), tr('Kiểm tra lại các vé cần đặt trước.'),
  tr('Tạo một bản sao lưu và cất vào Tệp.'), tr('Xếp vali thật gọn gàng.'), tr('Đêm nay ngủ sớm nhé.'), tr('Hello Christmas!'),
  tr('Một con phố đèn lồng đang chờ bạn.'), tr('Mùa đông thật dịu dàng.'), tr('Hôm nay, hãy ngước nhìn bầu trời.'), tr('Một ngày của riêng mình. 🕯️'), tr('Until we meet again. 🎄'),
];

export function MagicPage() {
  const { journey: j } = useJourney();
  const { reduced } = useApp();
  const [door, setDoor] = useState<number | null>(null);
  const [opened, setOpened] = useState<number[]>(() => { try { return JSON.parse(localStorage.getItem(`advent-${j.id}`) ?? '[]'); } catch { return []; } });
  const [sleigh, setSleigh] = useState(0);
  const [shake, setShake] = useState(0);
  const today = todayIn(j.timeZone);
  const year = j.startDate.slice(0, 4);
  const canOpen = (n: number) => today >= `${year}-12-${String(n).padStart(2, '0')}`;
  const open = (n: number) => {
    setDoor(n);
    const next = Array.from(new Set([...opened, n]));
    setOpened(next);
    try { localStorage.setItem(`advent-${j.id}`, JSON.stringify(next)); } catch { /* */ }
  };
  return (
    <div className="page magic">
      <PageHeader title={t('Phép màu Giáng sinh')} back={`/j/${j.id}`} />
      <section className="glass-card">
        <h3 className="display">{t('Lịch Advent')}</h3>
        <p className="muted xsmall">{t('Mỗi ô mở vào đúng ngày của tháng 12 (giờ')}{' '}{j.timeZone}).</p>
        <div className="advent">
          {Array.from({ length: 25 }, (_, i) => i + 1).map((n) => (
            <button key={n} className={`advent-door ${opened.includes(n) ? 'open' : ''}`} disabled={!canOpen(n)} onClick={() => open(n)} aria-label={t('Ngày {0}{1}', n, canOpen(n) ? '' : t(' (chưa đến ngày)'))}>{n}</button>
          ))}
        </div>
        {door && <p className="advent-msg display">🎁 {door}/12 — {j.adventMessages?.[door - 1] ? <Tx s="journeys" r={j} f={`adventMessages.${door - 1}`} /> : t(DEFAULT_ADVENT[door - 1])}</p>}
      </section>

      <section className="glass-card">
        <h3 className="display">{t('Quả cầu tuyết')}{' '}{j.destinations[0] ?? ''}</h3>
        <button className="snowglobe" onClick={() => setShake((s) => s + 1)} aria-label={t('Lắc quả cầu tuyết')}>
          <svg viewBox="0 0 200 220" aria-hidden="true">
            <defs>
              <radialGradient id="glass" cx="0.35" cy="0.3" r="0.8"><stop offset="0" stopColor="#ffffff" stopOpacity="0.35" /><stop offset="1" stopColor="#bfe3ff" stopOpacity="0.08" /></radialGradient>
              <clipPath id="globe-clip"><circle cx="100" cy="95" r="80" /></clipPath>
            </defs>
            <g clipPath="url(#globe-clip)">
              <rect width="200" height="200" fill="#0d2b45" />
              {/* original stylised skyline */}
              <g fill="#D5B477" opacity="0.9">
                <rect x="30" y="120" width="14" height="60" /><rect x="48" y="105" width="10" height="75" /><rect x="62" y="128" width="16" height="52" />
                <path d="M92 180 L92 90 L96 70 L100 40 L104 70 L108 90 L108 180 Z" />
                <circle cx="100" cy="95" r="7" /><circle cx="100" cy="72" r="4" />
                <path d="M122 180 L122 80 L130 66 L138 80 L138 180 Z" />
                <rect x="144" y="112" width="12" height="68" /><rect x="160" y="130" width="14" height="50" />
              </g>
              <rect y="172" width="200" height="40" fill="#FFF8EE" />
              {Array.from({ length: 30 }, (_, i) => (
                <circle key={`${shake}-${i}`} className={reduced ? '' : 'globe-flake'} cx={20 + ((i * 53) % 160)} cy={30 + ((i * 37) % 120)} r={1.2 + (i % 3) * 0.6} fill="#fff" style={{ animationDelay: `${(i % 10) * 0.15}s` }} />
              ))}
            </g>
            <circle cx="100" cy="95" r="80" fill="url(#glass)" stroke="#D5B477" strokeOpacity="0.6" />
            <path d="M40 170 Q100 190 160 170 L170 210 L30 210 Z" fill="#8B1E2D" stroke="#D5B477" strokeOpacity="0.7" />
          </svg>
        </button>
        <p className="muted xsmall center">{t('Chạm để lắc.')}</p>
      </section>

      <section className="glass-card">
        <h3 className="display">{t('Xe tuần lộc')}</h3>
        <button className="btn" onClick={() => setSleigh((s) => s + 1)} disabled={reduced}>{t('Gọi ông già Noel bay qua 🦌')}</button>
        {reduced && <p className="muted xsmall">{t('Đã tắt vì đang giảm chuyển động.')}</p>}
      </section>

      <section className="glass-card">
        <h3 className="display">{t('Trang trí')}</h3>
        <label className="toggle-row"><input type="checkbox" checked={j.settings.decorations} onChange={(e: any) => updateJourneySettings(j.id, { decorations: e.target.checked })} /> {' '}{t('Tuyết, đèn và hạt vàng trên Home')}</label>
        <button className="link-btn" onClick={() => go(`/j/${j.id}/appearance`)}>{t('Thêm tùy chọn giao diện →')}</button>
      </section>

      {sleigh > 0 && !reduced && (
        <div key={sleigh} className="sleigh" aria-hidden="true">
          <svg viewBox="0 0 220 70" width="220" height="70">
            <g fill="#D5B477">
              <path d="M10 40 q10 -14 22 -4 l6 -10 l4 12 q12 4 6 14 l-30 2 z" />
              <path d="M52 40 q10 -14 22 -4 l6 -10 l4 12 q12 4 6 14 l-30 2 z" />
            </g>
            <path d="M44 44 L100 44" stroke="#D5B477" strokeWidth="1" />
            <path d="M100 30 h60 q16 0 20 -14 l6 0 q-2 26 -24 30 h-64 z" fill="#8B1E2D" stroke="#D5B477" />
            <path d="M96 52 h86 q10 0 12 -8" stroke="#D5B477" strokeWidth="2" fill="none" />
            <circle cx="140" cy="22" r="8" fill="#FFF8EE" />
          </svg>
        </div>
      )}
      {shake > 0 && !reduced && <div className="magic-snow"><Snow key={shake} density={0.6} burst={40} /></div>}
    </div>
  );
}
