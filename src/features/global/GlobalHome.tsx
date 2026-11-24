import { useState } from 'react';
import { LuPlus, LuFileUp, LuMenu, LuLibrary, LuGlobe, LuShieldCheck, LuWifiOff, LuLock, LuSettings, LuPin, LuImage, LuLanguages } from 'react-icons/lu';
import type { Journey } from '../../db/schema';
import { BlobImg, go, Sheet, useStore } from '../../ui/core';
import { t } from '../../lib/i18n';
import { fmtShort } from '../../lib/time';
import { useApp } from '../../ui/app-context';
import { BgLayer } from '../journey/Background';
import { BookMark } from '../../art/BookMark';
import { LanguageButton } from '../../ui/Language';
import { APP_VERSION } from '../../ui/UpdateNotice';
import { Tx } from '../../ui/contentTx';
import { TxNudge } from '../../ui/contentTx';
import { useArtUrl } from '../../ui/art';

export function GlobalHome() {
  const coverUrl = useArtUrl('cover', 'thumb');
  const journeys = useStore<Journey>('journeys');
  const { settings } = useApp();
  const [menu, setMenu] = useState(false);
  const list = journeys.filter((j) => !j.archived).sort((a, b) => Number(b.pinned) - Number(a.pinned) || a.startDate.localeCompare(b.startDate));
  const archivedCount = journeys.filter((j) => j.archived).length;

  return (
    <div className="global-home theme-global">
      {settings.homeBackground && <BgLayer bg={settings.homeBackground} />}
      <div className="global-inner">
        <header className="global-head">
          <BookMark size={44} />
          <div className="grow">
            <h1 className="display">{t('appName')}</h1>
            <p className="muted small italic">{t('subtitle')}</p>
          </div>
          <LanguageButton />
          <button className="icon-btn" aria-label={t('menu')} onClick={() => setMenu(true)}>
            <LuMenu size={22} />
          </button>
        </header>

        {!journeys.length && (
          <section className="welcome glass-card" aria-label={t('Bắt đầu')}>
            <h2 className="display">{t('Chào mừng đến với cuốn nhật ký ✨')}</h2>
            <p className="small">{t('Nếu bạn đã có tệp hành trình riêng (ví dụ lưu trong ứng dụng Tệp), hãy nhập nó một lần. Mọi dữ liệu chỉ nằm trên iPhone này.')}</p>
            <button className="btn primary big" onClick={() => go('/import')}><LuFileUp size={20} /> {' '}{t('Nhập hành trình từ tệp')}</button>
          </section>
        )}
        <button className="add-journey" onClick={() => go('/new')}>
          <LuPlus size={22} /> {t('addJourney')}
        </button>
        {journeys.length > 0 && (
          <button className="link-btn center" onClick={() => go('/import')}><LuFileUp size={14} /> {' '}{t('Nhập hành trình từ tệp')}</button>
        )}

        <TxNudge />
        <h2 className="section-title">{t('myJourneys')}</h2>
        <div className="journey-list">
          {list.map((j) => (
            <button key={j.id} className="journey-card" onClick={() => go(`/j/${j.id}`)} aria-label={t('Mở {0}', j.title)}>
              <div className="journey-cover">{j.settings.coverBlobId ? <BlobImg id={j.settings.coverBlobId} className="cover-img" /> : j.settings.theme === 'christmas-emerald' && coverUrl ? <img src={coverUrl} alt="" className="cover-img cover-book" data-testid="card-cover" /> : j.coverArt === 'xmas-skyline' ? <img src="./icons/xmas-skyline-emblem.svg" alt="" className="cover-img" /> : <span className="cover-emoji">{j.coverEmoji}</span>}</div>
              <div className="journey-meta">
                <strong><Tx s="journeys" r={j} f="title" /></strong>
                <span className="muted small">{j.destinations.join(' · ')}</span>
                <span className="muted small">
                  {fmtShort(j.startDate)} – {fmtShort(j.endDate)}/{j.endDate.slice(0, 4)}
                </span>
              </div>
              {j.pinned && <span className="pin" aria-label={t('Đã ghim')}><LuPin size={16} /></span>}
            </button>
          ))}
          {!list.length && <p className="muted center">{t('Chưa có chuyến đi nào. Nhấn “')}{t('addJourney')}”.</p>}
          {archivedCount > 0 && (
            <button className="link-btn" onClick={() => go('/library?f=archived')}>
              {archivedCount} {' '}{t('chuyến đi đã lưu trữ →')}</button>
          )}
        </div>
      </div>

      <p className="version-tag">{t('v')}{APP_VERSION}</p>
      <Sheet open={menu} onClose={() => setMenu(false)} title={t('Menu')}>
        <nav className="menu-list">
          <button onClick={() => go('/import')}><LuFileUp /> {' '}{t('Nhập hành trình từ tệp')}</button>
          <button onClick={() => go('/library')}><LuLibrary /> {' '}{t('Thư viện hành trình')}</button>
          <button onClick={() => go('/world')}><LuGlobe /> {' '}{t('My Travel World')}</button>
          <button onClick={() => go('/backup')}><LuShieldCheck /> {' '}{t('Trung tâm bảo vệ kỷ niệm (sao lưu)')}</button>
          <button onClick={() => go('/translate')}><LuLanguages /> {' '}{t('Dịch nội dung bạn nhập (4 ngôn ngữ)')}</button>
          <button onClick={() => go('/offline')}><LuWifiOff /> {' '}{t('Kiểm tra sẵn sàng offline')}</button>
          <button onClick={() => go('/vault')}><LuLock /> {' '}{t('Két riêng tư')}</button>
          <button onClick={() => go('/background/global')}><LuImage /> {' '}{t('Ảnh nền trang chủ')}</button>
          <button onClick={() => go('/settings')}><LuSettings /> {' '}{t('Cài đặt')}</button>
        </nav>
      </Sheet>
    </div>
  );
}
