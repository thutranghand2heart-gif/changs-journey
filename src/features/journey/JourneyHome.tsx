import { useEffect, useState } from 'react';
import {
  LuArrowLeft, LuSearch, LuPalette, LuVolume2, LuVolumeX, LuWallet, LuPhone, LuCopy, LuBookOpen, LuReceipt, LuUtensils, LuLanguages, LuListChecks,
  LuCar, LuCloudSun, LuSparkles, LuLayoutGrid, LuHeart, LuPlane, LuCalendar,
  LuPenLine,
} from 'react-icons/lu';
import type { WalletDoc } from '../../db/schema';
import { go, useStore, useToast } from '../../ui/core';
import { useApp } from '../../ui/app-context';
import { useJourney } from './JourneyShell';
import { JourneyTree } from '../../art/TreeArt';
import { useArtUrl } from '../../ui/art';
import { JourneyCover } from '../../ui/Cover';
import { Snow } from '../../art/Snow';
import { isPlaying, onAudio, startAmbience, stopAmbience } from '../../art/audio';
import { smartToday } from '../../lib/today';
import { copyText } from '../../lib/util';
import { fmtShort } from '../../lib/time';
import { updateJourneySettings } from '../../db/repo';
import { tokensFor } from '../../lib/themes';
import { hotelOf } from '../../lib/wallet';
import { LanguageButton } from '../../ui/Language';
import { getLang, t } from '../../lib/i18n';
import { Tx, TxNudge, useCt } from '../../ui/contentTx';
import { BalancedTitle } from '../../ui/BalancedTitle';
import { CountdownSleigh, countdownProgress } from './CountdownSleigh';
import { cityName } from '../../lib/cityNames';

const seenOpening = new Set<string>();
const NUM_VI = ['', 'Một', 'Hai', 'Ba', 'Bốn', 'Năm', 'Sáu', 'Bảy', 'Tám', 'Chín', 'Mười'];
const pagesTitle = (n: number) => (getLang() === 'vi' ? `${NUM_VI[n] ?? n} trang nhật ký` : t('{0} trang nhật ký', n));

export function JourneyHome() {
  const { journey: j, days, activities } = useJourney();
  const docs = useStore<WalletDoc>('docs', j.id);
  const { reduced, settings } = useApp();
  const toast = useToast();
  const s = j.settings;
  const ct = useCt();
  const motionOff = reduced || s.animations === 'off';
  const isXmas = s.theme === 'christmas-emerald';
  const treeArt = useArtUrl('tree', 'thumb');
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

  const today = smartToday(j, days, activities, docs, new Date(), ct);
  const hotel = hotelOf(j, docs);
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
        !treeArt && (
          <div className="tree-stage" aria-hidden="true">
            <JourneyTree journey={j} animate={!motionOff} lights={s.decorations} />
          </div>
        )
      ) : (
        <div className="theme-deco" aria-hidden="true">{tk.deco}</div>
      )}
      {s.decorations && !motionOff && <Snow density={settings.performanceMode ? 0.4 : isXmas ? 1 : 0.5} gold={isXmas && !settings.performanceMode} />}

      <div className="jhome-inner">
        <div className="jhome-top">
          <button className="icon-btn glass" aria-label={t('Về danh sách chuyến đi')} onClick={() => go('/')}><LuArrowLeft size={20} /></button>
          <div className="grow" />
          <LanguageButton glass />
          <button className="icon-btn glass" aria-label={t('Tìm kiếm')} onClick={() => go(`${base}/search`)}><LuSearch size={20} /></button>
          <button className="icon-btn glass" aria-label={playing ? t('Tắt nhạc nền') : t('Bật nhạc nền')} onClick={toggleSound}>{playing ? <LuVolume2 size={20} /> : <LuVolumeX size={20} />}</button>
          <button className="icon-btn glass" aria-label={t('Giao diện & ảnh nền')} onClick={() => go(`${base}/appearance`)}><LuPalette size={20} /></button>
        </div>

        <section className={`hero ${isXmas && treeArt ? 'hero-tree' : ''}`} style={isXmas && treeArt ? ({ '--tree-w': `${Math.round(52 * (s.treeArt?.scale ?? 1))}%` } as any) : undefined}>
          <div className="hero-text">
            <p className="hero-kicker">{j.subtitle ? <Tx s="journeys" r={j} f="subtitle" /> : j.destinations.join(' · ')}</p>
            <h1 className="hero-title display"><BalancedTitle text={ct('journeys', j, 'title')} lang={getLang()} /></h1>
            <p className="hero-dates"><LuCalendar size={14} /> {fmtShort(j.startDate)} – {fmtShort(j.endDate)}, {j.endDate.slice(0, 4)}</p>
          </div>
          {isXmas && treeArt && (
            <div className="hero-tree-art" aria-hidden="true">
              <JourneyTree journey={j} animate={!motionOff} lights={s.decorations} />
            </div>
          )}
        </section>

        <section className="countdown-card" aria-label={t('Đếm ngược')}>
          {today.phase === 'before' && (
            <CountdownLine days={today.daysUntil} city={j.destinations[0] ? cityName(j.destinations[0], getLang()) ?? j.destinations[0] : ''} />
          )}
          <CountdownSleigh
            journey={j}
            progress={countdownProgress(j, today.phase, today.daysUntil)}
            leftLabel={today.phase === 'before' ? t('Hôm nay') : ''}
            rightLabel={today.phase === 'before' ? `${fmtShort(j.startDate)} · ${cityName(j.destinations[0] ?? '', getLang()) ?? j.destinations[0] ?? ''}` : t('Đã đến nơi ✨')}
          />
        </section>

        <TxNudge journeyId={j.id} />
        <section className="glass-card today-card" aria-label={t('Hôm nay')}>
          {today.phase === 'after' && <p>{t('Chuyến đi đã khép lại. Những bước chân vẫn còn đây ✨')}</p>}
          {today.phase === 'during' && today.day && (
            <div>
              <p className="muted small">{t('Hôm nay · Ngày')}{' '}{today.day.index} · {today.localTime} {' '}{t('(giờ địa phương)')}</p>
              <h3 className="display"><Tx s="days" r={today.day} f="title" /></h3>
              {today.calm ? (
                <p className="calm">{t('Một ngày của riêng bạn. Không có lịch, không có nhắc nhở. 🕯️')}</p>
              ) : (
                <ul className="upcoming">
                  {today.upcoming.map((a) => (
                    <li key={a.id}><button className="link-btn" onClick={() => go(`${base}/journey/${a.dayId}?a=${a.id}`)}>{a.start && <b>{a.approxTime ? '~' : ''}{a.start}</b>} <Tx s="activities" r={a} f="title" /></button></li>
                  ))}
                  {!today.upcoming.length && <li className="muted small">{t('Không còn hoạt động nào cho hôm nay.')}</li>}
                </ul>
              )}
            </div>
          )}
          {today.reminders.length > 0 && (
            <ul className="reminders" aria-label={t('Nhắc nhở trong ứng dụng')}>
              {today.reminders.map((r, i) => (
                <li key={i} className={r.priority ? 'priority' : ''}>
                  {r.priority ? <LuPlane size={14} /> : '•'} {r.link ? <button className="link-btn" onClick={() => go(r.link!)}>{r.text}</button> : r.text}
                </li>
              ))}
            </ul>
          )}
          <p className="muted xsmall">{t('Nhắc nhở chỉ hiển thị khi bạn mở ứng dụng.')}</p>
        </section>

        <section className="quick-row" aria-label={t('Truy cập nhanh')}>
          <button className="quick glass-card" onClick={() => go(`${base}/wallet`)}><LuWallet size={22} /><span>{t('Giấy tờ')}</span></button>
          <button className="quick glass-card" onClick={() => go(`${base}/travel-doc`)}><LuPlane size={22} /><span>{t('Thẻ nhập cảnh')}</span></button>
          <button className="quick glass-card" onClick={() => go(`${base}/emergency`)}><LuPhone size={22} /><span>{t('Khẩn cấp')}</span></button>
        </section>

        {hotel && (
          <section className="glass-card hotel-card">
            <p className="muted xsmall">{t('KHÁCH SẠN · thông tin bạn cung cấp')}</p>
            <h3>{hotel.name}</h3>
            {hotel.addressZh && <p className="zh big-zh" lang="zh-CN">{hotel.addressZh}</p>}
            {hotel.addressEn && <p className="small muted">{hotel.addressEn}</p>}
            <div className="row gap-s">
              <button className="btn small" onClick={async () => toast((await copyText(hotel!.addressZh ?? hotel!.addressEn ?? '')) ? t('Đã sao chép địa chỉ') : t('Không sao chép được'), 'ok')}><LuCopy size={14} /> {' '}{t('Sao chép')}</button>
              <button className="btn small" onClick={() => go(`${base}/transport?card=hotel`)}><LuCar size={14} /> {' '}{t('Thẻ taxi')}</button>
            </div>
          </section>
        )}

        <h2 className="section-title display">{pagesTitle(days.length)}</h2>
        <div className="day-strip">
          {days.map((d) => (
            <button key={d.id} className={`day-chip glass-card ${today.day?.id === d.id ? 'is-today' : ''} ${d.freeDay ? 'free' : ''}`} onClick={() => go(`${base}/journey/${d.id}`)}>
              <span className="day-n">{t('Ngày {0}', d.index)}</span>
              <span className="day-date">{fmtShort(d.date)}</span>
              <span className="day-t"><Tx s="days" r={d} f="title" /></span>
            </button>
          ))}
        </div>

        <h2 className="section-title display">{t('Góc nhỏ của Chang')}</h2>
        <div className="feature-grid">
          {[
            [LuHeart, t('Kỷ niệm'), 'memories'], [LuReceipt, t('Ngân sách'), 'budget'], [LuUtensils, t('Food Passport'), 'food'], [LuLanguages, t('Ngôn ngữ'), 'language'],
            [LuListChecks, t('Checklist'), 'checklist'], [LuCar, t('Di chuyển'), 'transport'], [LuCloudSun, t('Thời tiết & trang phục'), 'weather'], [LuSparkles, isXmas ? t('Phép màu Giáng sinh') : t('Phép màu'), 'magic'],
            [LuBookOpen, t('Storybook'), 'storybook'], [LuPenLine, t('Viết kỷ niệm'), 'memories/new'],
          ].map(([Icon, label, path]: any) => (
            <button key={path} className="feature-tile glass-card" onClick={() => go(`${base}/${path}`)}>
              <Icon size={22} />
              <span>{label}</span>
            </button>
          ))}
        </div>

        <button className="library-banner" data-testid="home-library" onClick={() => go(`${base}/features`)}>
          <span className="library-ic"><LuLayoutGrid size={22} /></span>
          <span className="grow">
            <b>{t('Thư viện tính năng')}</b>
            <span className="small muted block">{t('Tất cả công cụ của chuyến đi, chia theo nhóm')}</span>
          </span>
          <span aria-hidden="true">›</span>
        </button>
      </div>

      {opening && (
        <div className="opening" role="dialog" aria-label={t('Mở đầu')}>
          <div className="opening-book">
            {isXmas ? <JourneyCover journey={j} /> : <div className="theme-deco static">{tk.deco}</div>}
          </div>
          <p className="opening-title display"><Tx s="journeys" r={j} f="title" /></p>
          <p className="opening-sub">{t('Every step has a story.')}</p>
          <div className="opening-actions">
            <button className="btn ghost small" onClick={() => setOpening(false)}>{t('Bỏ qua')}</button>
            <button className="btn ghost small" onClick={() => (setOpening(false), go(`${base}/wallet`))}>{t('Giấy tờ ngay')}</button>
            <button className="btn ghost small" onClick={() => (setOpening(false), updateJourneySettings(j.id, { openingAnimation: false }), toast(t('Sẽ không hiện phần mở đầu nữa')))}>{t('Không hiện lại')}</button>
          </div>
        </div>
      )}
    </div>
  );
}

/** “Còn 26 ngày nữa là đến chuyến đi …” / “距离…之旅还有26天” — natural word order per language; the day count
 * is always computed (never stored) and shown large inline. */
function CountdownLine({ days, city }: { days: number; city: string }) {
  const tpl = city ? t('Còn {0} ngày nữa là đến chuyến đi {1}') : t('Còn {0} ngày nữa');
  const [a, b = ''] = tpl.replace('{1}', city).split('{0}');
  return (
    <p className="countdown" data-testid="countdown-line">
      {a}<b className="big-num">{days}</b>{b}
    </p>
  );
}
