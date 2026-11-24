import { useEffect, useState } from 'react';
import {
  LuArrowLeft, LuSearch, LuPalette, LuVolume2, LuVolumeX, LuWallet, LuPhone, LuCopy, LuBookOpen, LuReceipt, LuUtensils, LuLanguages, LuListChecks,
  LuCar, LuCloudSun, LuSparkles, LuLayoutGrid, LuHeart, LuPlane, LuCalendar,
} from 'react-icons/lu';
import type { WalletDoc } from '../../db/schema';
import { go, useStore, useToast } from '../../ui/core';
import { useApp } from '../../ui/app-context';
import { useJourney } from './JourneyShell';
import { ChristmasTree } from '../../art/Tree';
import { Snow } from '../../art/Snow';
import { isPlaying, onAudio, startAmbience, stopAmbience } from '../../art/audio';
import { smartToday } from '../../lib/today';
import { copyText } from '../../lib/util';
import { fmtShort } from '../../lib/time';
import { updateJourneySettings } from '../../db/repo';
import { tokensFor } from '../../lib/themes';

const seenOpening = new Set<string>();
const NUM_VI = ['', 'Một', 'Hai', 'Ba', 'Bốn', 'Năm', 'Sáu', 'Bảy', 'Tám', 'Chín', 'Mười'];
const pagesTitle = (n: number) => `${NUM_VI[n] ?? n} trang nhật ký`;

export function JourneyHome() {
  const { journey: j, days, activities } = useJourney();
  const docs = useStore<WalletDoc>('docs', j.id);
  const { reduced, settings } = useApp();
  const toast = useToast();
  const s = j.settings;
  const motionOff = reduced || s.animations === 'off';
  const isXmas = s.theme === 'christmas-emerald';
  const [opening, setOpening] = useState(() => s.openingAnimation && !seenOpening.has(j.id) && !motionOff);
  const [playing, setPlaying] = useState(isPlaying());
  useEffect(() => onAudio(setPlaying), []);
  useEffect(() => () => void (isPlaying() && stopAmbience()), []);
  useEffect(() => {
    if (!opening) return;
    seenOpening.add(j.id);
    const tm = setTimeout(() => setOpening(false), 2700);
    return () => clearTimeout(tm);
  }, [opening]);

  const today = smartToday(j, days, activities, docs);
  const base = `/j/${j.id}`;
  const tk = tokensFor(j);

  const toggleSound = async () => {
    if (playing) return stopAmbience();
    try {
      await startAmbience();
    } catch (e: any) {
      toast(e.message, 'warn');
    }
  };

  return (
    <div className={`jhome ${isXmas ? 'xmas' : 'themed'}`}>
      {isXmas ? (
        <div className="tree-stage" aria-hidden="true">
          <ChristmasTree animate={!motionOff} lights={s.decorations} />
        </div>
      ) : (
        <div className="theme-deco" aria-hidden="true">{tk.deco}</div>
      )}
      {s.decorations && !motionOff && <Snow density={settings.performanceMode ? 0.4 : isXmas ? 1 : 0.5} gold={isXmas && !settings.performanceMode} />}

      <div className="jhome-inner">
        <div className="jhome-top">
          <button className="icon-btn glass" aria-label="Về danh sách chuyến đi" onClick={() => go('/')}><LuArrowLeft size={20} /></button>
          <div className="grow" />
          <button className="icon-btn glass" aria-label="Tìm kiếm" onClick={() => go(`${base}/search`)}><LuSearch size={20} /></button>
          <button className="icon-btn glass" aria-label={playing ? 'Tắt nhạc nền' : 'Bật nhạc nền'} onClick={toggleSound}>{playing ? <LuVolume2 size={20} /> : <LuVolumeX size={20} />}</button>
          <button className="icon-btn glass" aria-label="Giao diện & ảnh nền" onClick={() => go(`${base}/appearance`)}><LuPalette size={20} /></button>
        </div>

        <section className="hero">
          <p className="hero-kicker">{j.subtitle ?? j.destinations.join(' · ')}</p>
          <h1 className="hero-title display">{j.title}</h1>
          <p className="hero-dates"><LuCalendar size={14} /> {fmtShort(j.startDate)} – {fmtShort(j.endDate)}, {j.endDate.slice(0, 4)}</p>
        </section>

        <section className="glass-card today-card" aria-label="Hôm nay">
          {today.phase === 'before' && (
            <p className="countdown"><b className="big-num">{today.daysUntil}</b> ngày nữa{isXmas && j.destinations[0] ? ` là đến ${j.destinations[0]} 🎄` : ''}</p>
          )}
          {today.phase === 'after' && <p>Chuyến đi đã khép lại. Những bước chân vẫn còn đây ✨</p>}
          {today.phase === 'during' && today.day && (
            <div>
              <p className="muted small">Hôm nay · Ngày {today.day.index} · {today.localTime} (giờ địa phương)</p>
              <h3 className="display">{today.day.title}</h3>
              {today.calm ? (
                <p className="calm">Một ngày của riêng bạn. Không có lịch, không có nhắc nhở. 🕯️</p>
              ) : (
                <ul className="upcoming">
                  {today.upcoming.map((a) => (
                    <li key={a.id}><button className="link-btn" onClick={() => go(`${base}/journey/${a.dayId}?a=${a.id}`)}>{a.start && <b>{a.approxTime ? '~' : ''}{a.start}</b>} {a.title}</button></li>
                  ))}
                  {!today.upcoming.length && <li className="muted small">Không còn hoạt động nào cho hôm nay.</li>}
                </ul>
              )}
            </div>
          )}
          {today.reminders.length > 0 && (
            <ul className="reminders" aria-label="Nhắc nhở trong ứng dụng">
              {today.reminders.map((r, i) => (
                <li key={i} className={r.priority ? 'priority' : ''}>
                  {r.priority ? <LuPlane size={14} /> : '•'} {r.link ? <button className="link-btn" onClick={() => go(r.link!)}>{r.text}</button> : r.text}
                </li>
              ))}
            </ul>
          )}
          <p className="muted xsmall">Nhắc nhở chỉ hiển thị khi bạn mở ứng dụng.</p>
        </section>

        <section className="quick-row" aria-label="Truy cập nhanh">
          <button className="quick glass-card" onClick={() => go(`${base}/wallet`)}><LuWallet size={22} /><span>Giấy tờ</span></button>
          <button className="quick glass-card" onClick={() => go(`${base}/travel-doc`)}><LuPlane size={22} /><span>Thẻ nhập cảnh</span></button>
          <button className="quick glass-card" onClick={() => go(`${base}/emergency`)}><LuPhone size={22} /><span>Khẩn cấp</span></button>
        </section>

        {j.hotel && (
          <section className="glass-card hotel-card">
            <p className="muted xsmall">KHÁCH SẠN · thông tin bạn cung cấp</p>
            <h3>{j.hotel.name}</h3>
            {j.hotel.addressZh && <p className="zh big-zh" lang="zh-CN">{j.hotel.addressZh}</p>}
            {j.hotel.addressEn && <p className="small muted">{j.hotel.addressEn}</p>}
            <div className="row gap-s">
              <button className="btn small" onClick={async () => toast((await copyText(j.hotel!.addressZh ?? j.hotel!.addressEn ?? '')) ? 'Đã sao chép địa chỉ' : 'Không sao chép được', 'ok')}><LuCopy size={14} /> Sao chép</button>
              <button className="btn small" onClick={() => go(`${base}/transport?card=hotel`)}><LuCar size={14} /> Thẻ taxi</button>
            </div>
          </section>
        )}

        <h2 className="section-title display">{pagesTitle(days.length)}</h2>
        <div className="day-strip">
          {days.map((d) => (
            <button key={d.id} className={`day-chip glass-card ${today.day?.id === d.id ? 'is-today' : ''} ${d.freeDay ? 'free' : ''}`} onClick={() => go(`${base}/journey/${d.id}`)}>
              <span className="day-n">Ngày {d.index}</span>
              <span className="day-date">{fmtShort(d.date)}</span>
              <span className="day-t">{d.title}</span>
            </button>
          ))}
        </div>

        <h2 className="section-title display">Góc nhỏ của Chang</h2>
        <div className="feature-grid">
          {[
            [LuHeart, 'Kỷ niệm', 'memories'], [LuReceipt, 'Ngân sách', 'budget'], [LuUtensils, 'Food Passport', 'food'], [LuLanguages, 'Ngôn ngữ', 'language'],
            [LuListChecks, 'Checklist', 'checklist'], [LuCar, 'Di chuyển', 'transport'], [LuCloudSun, 'Thời tiết & trang phục', 'weather'], [LuSparkles, isXmas ? 'Phép màu Giáng sinh' : 'Phép màu', 'magic'],
            [LuBookOpen, 'Storybook', 'memories/book'], [LuLayoutGrid, 'Thư viện tính năng', 'features'],
          ].map(([Icon, label, path]: any) => (
            <button key={path} className="feature-tile glass-card" onClick={() => go(`${base}/${path}`)}>
              <Icon size={22} />
              <span>{label}</span>
            </button>
          ))}
        </div>
      </div>

      {opening && (
        <div className="opening" role="dialog" aria-label="Mở đầu">
          <div className="opening-book">
            {isXmas ? <ChristmasTree animate lights /> : <div className="theme-deco static">{tk.deco}</div>}
          </div>
          <p className="opening-title display">{j.title}</p>
          <p className="opening-sub">Every step has a story.</p>
          <div className="opening-actions">
            <button className="btn ghost small" onClick={() => setOpening(false)}>Bỏ qua</button>
            <button className="btn ghost small" onClick={() => (setOpening(false), go(`${base}/wallet`))}>Giấy tờ ngay</button>
            <button className="btn ghost small" onClick={() => (setOpening(false), updateJourneySettings(j.id, { openingAnimation: false }), toast('Sẽ không hiện phần mở đầu nữa'))}>Không hiện lại</button>
          </div>
        </div>
      )}
    </div>
  );
}
