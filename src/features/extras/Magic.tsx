import { cityName } from '../../lib/cityNames';
import { useState } from 'react';
import { MagicalFlight } from './MagicalFlight';
import { PageHeader, go, useToast, useBlobUrl } from '../../ui/core';
import { useJourney } from '../journey/JourneyShell';
import { useApp } from '../../ui/app-context';
import { Snow, SkyControls } from '../../art/Snow';
import { todayIn } from '../../lib/time';
import { updateJourneySettings } from '../../db/repo';
import { t, tr, getLang } from '../../lib/i18n';
import { Tx } from '../../ui/contentTx';
import { SnowGlobeArt } from '../../art/SnowGlobeArt';
import { useArtUrl } from '../../ui/art';

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
  const [flight, setFlight] = useState<null | 'once' | 'loop'>(null);
  const [opening, setOpening] = useState<number | null>(null);
  const toast = useToast();
  const stickerId = j.settings.countdownStickerBlobId;
  const { url: stickerUrl } = useBlobUrl(stickerId);
  const globeUrl = useArtUrl('globe', 'thumb');
  const [shake, setShake] = useState(0);
  const today = todayIn(j.timeZone);
  const year = j.startDate.slice(0, 4);
  const canOpen = (n: number) => today >= `${year}-12-${String(n).padStart(2, '0')}`;
  const open = (n: number) => {
    if (!canOpen(n)) { toast(t('Cánh cửa này mở vào ngày {0}/12 — hãy chờ thêm một chút nhé.', n)); return; }
    if (!opened.includes(n) && !reduced) { setOpening(n); setTimeout(() => setOpening(null), 1100); }
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
        <div className="advent" data-testid="advent">
          {Array.from({ length: 25 }, (_, i) => i + 1).map((n) => {
            const st = opened.includes(n) ? 'opened' : canOpen(n) ? 'ready' : 'future';
            return (
              <button
                key={n}
                className={`advent-door ${st} ${n % 2 ? 'tone-a' : 'tone-b'} ${opening === n ? 'opening' : ''} ${door === n ? 'current' : ''}`}
                data-state={st}
                aria-disabled={st === 'future'}
                onClick={() => open(n)}
                aria-label={st === 'future' ? t('Ngày {0} — mở vào {0}/12', n) : st === 'ready' ? t('Ngày {0} — có thể mở', n) : t('Ngày {0} — đã mở', n)}
              >
                <span className="door-inside" aria-hidden="true"><span className="door-star">✦</span><span className="door-in-num">{n}</span></span>
                <span className="door-panel" aria-hidden="true">
                  <span className="door-num">{n}</span>
                  <span className="door-knob" />
                  {st === 'future' && <span className="door-date">{n}/12</span>}
                  {st === 'ready' && <span className="door-ribbon" />}
                </span>
                {opening === n && (
                  <span className="door-burst" aria-hidden="true">
                    {Array.from({ length: 10 }, (_, k) => <i key={k} style={{ ['--a' as any]: `${k * 36}deg`, ['--d' as any]: `${18 + (k % 3) * 8}px` }} />)}
                  </span>
                )}
              </button>
            );
          })}
        </div>
        <div className="advent-legend xsmall">
          <span><i className="lg future" />{t('Chưa đến ngày')}</span>
          <span><i className="lg ready" />{t('Có thể mở')}</span>
          <span><i className="lg opened" />{t('Đã mở')}</span>
        </div>
        {door && <p className="advent-msg display" data-testid="advent-msg"><span className="advent-msg-date">{door}/12</span> {j.adventMessages?.[door - 1] ? <Tx s="journeys" r={j} f={`adventMessages.${door - 1}`} /> : t(DEFAULT_ADVENT[door - 1])}</p>}
      </section>

      <section className="glass-card">
        <h3 className="display">{t('Quả cầu tuyết')}{' '}{j.destinations[0] ? cityName(j.destinations[0], getLang()) ?? j.destinations[0] : ''}</h3>
        {globeUrl ? <SnowGlobeArt reduced={reduced} /> : <>
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
        </>}
      </section>

      <section className="glass-card flight-card">
        <h3 className="display">{t('Chuyến bay kỳ diệu của Chang')}</h3>
        {stickerUrl ? (
          <>
            <img className="flight-preview" src={stickerUrl} alt="" draggable={false} />
            <p className="muted xsmall">{t('Xe tuần lộc của Chang bay lượn khắp màn hình: qua lại, lượn vòng, bay hình số 8 và kéo theo bụi sao vàng.')}</p>
            <div className="row gap-s wrap">
              <button className="btn primary" data-testid="flight-once" onClick={() => setFlight('once')} disabled={reduced || !!flight}>{t('Bay một vòng')}</button>
              <button className="btn" data-testid="flight-loop" onClick={() => setFlight('loop')} disabled={reduced || flight === 'loop'}>{t('Bay liên tục')}</button>
              {flight && <button className="btn ghost" onClick={() => setFlight(null)}>{t('Dừng bay')}</button>}
            </div>
          </>
        ) : (
          <>
            <p className="muted small">{t('Chưa có sticker xe tuần lộc của bạn. Thêm sticker trong Giao diện để Chang bay lượn trên màn hình.')}</p>
            <button className="btn" onClick={() => go(`/j/${j.id}/appearance`)}>{t('Thêm sticker xe tuần lộc')}</button>
          </>
        )}
        {reduced && <p className="muted xsmall">{t('Đã tắt vì đang giảm chuyển động.')}</p>}
      </section>

      <section className="glass-card">
        <h3 className="display">{t('Trang trí')}</h3>
        <SkyControls t={t} />
        <label className="toggle-row"><input type="checkbox" checked={j.settings.decorations} onChange={(e: any) => updateJourneySettings(j.id, { decorations: e.target.checked })} /> {' '}{t('Tuyết, sao băng và bụi sao vàng trên các trang Giáng sinh')}</label>
        <button className="link-btn" onClick={() => go(`/j/${j.id}/appearance`)}>{t('Thêm tùy chọn giao diện →')}</button>
      </section>

      {flight && !reduced && <MagicalFlight blobId={stickerId} mode={flight} onEnd={() => setFlight(null)} />}
      {shake > 0 && !reduced && <div className="magic-snow"><Snow key={shake} density={0.6} burst={40} /></div>}
    </div>
  );
}
