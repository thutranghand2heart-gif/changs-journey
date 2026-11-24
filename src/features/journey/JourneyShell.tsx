import { createContext, useContext, type ReactNode } from 'react';
import { LuHouse, LuBookOpen, LuMap, LuCamera, LuWallet } from 'react-icons/lu';
import type { Activity, Day, Journey, Place } from '../../db/schema';
import * as db from '../../db/idb';
import { go, useLive } from '../../ui/core';
import { themeStyle, tokensFor } from '../../lib/themes';
import { t } from '../../lib/i18n';
import { BgLayer } from './Background';
import { todayIn } from '../../lib/time';

export interface JourneyData { journey: Journey; days: Day[]; activities: Activity[]; places: Place[] }
const Ctx = createContext<JourneyData | null>(null);
export const useJourney = () => useContext(Ctx)!;

async function load(id: string): Promise<JourneyData | null> {
  const journey = await db.get<Journey>('journeys', id);
  if (!journey) return null;
  const [days, activities, places] = await Promise.all([db.getAll<Day>('days', id), db.getAll<Activity>('activities', id), db.getAll<Place>('places', id)]);
  days.sort((a, b) => a.index - b.index);
  activities.sort((a, b) => a.order - b.order);
  return { journey, days, activities, places };
}

export const TABS = [
  { key: '', label: 'home', icon: LuHouse },
  { key: 'journey', label: 'journey', icon: LuBookOpen },
  { key: 'map', label: 'map', icon: LuMap },
  { key: 'pose', label: 'pose', icon: LuCamera },
  { key: 'wallet', label: 'wallet', icon: LuWallet },
];

export function JourneyShell({ id, tab, children }: { id: string; tab: string; children: (d: JourneyData) => ReactNode }) {
  const [data, loaded, err] = useLive(() => load(id), [id], null as JourneyData | null);
  if (!loaded) return <div className="page center muted">{t('Đang mở nhật ký…')}</div>;
  if (err) return <div className="page"><p className="error">{t('Lỗi bộ nhớ:')}{' '}{err}</p></div>;
  if (!data)
    return (
      <div className="page center">
        <p>{t('Không tìm thấy chuyến đi này.')}</p>
        <button className="btn" onClick={() => go('/')}>{t('Về danh sách')}</button>
      </div>
    );
  const tk = tokensFor(data.journey);
  const s = data.journey.settings;
  // per-page background; Home may rotate by day
  let bg = s.backgrounds[tab || 'home'];
  if (!tab && s.rotateBackgrounds.length) {
    const d = data.days.find((x) => x.date === todayIn(data.journey.timeZone));
    if (d) bg = { blobId: s.rotateBackgrounds[(d.index - 1) % s.rotateBackgrounds.length], posX: 50, posY: 50, zoom: 1, darken: 0.4, blur: 0, ...(s.backgrounds.home ? { posX: s.backgrounds.home.posX, posY: s.backgrounds.home.posY, darken: s.backgrounds.home.darken, blur: s.backgrounds.home.blur } : {}) };
  }
  const primary = TABS.some((x) => x.key === tab);
  return (
    <Ctx.Provider value={data}>
      <div className={`journey-root theme-${s.theme} font-${s.fontStyle}`} style={themeStyle(tk, s.fontStyle)}>
        {bg && primary && <BgLayer bg={bg} />}
        <div className="journey-content">{children(data)}</div>
        <TabBar id={id} tab={tab} />
      </div>
    </Ctx.Provider>
  );
}

function TabBar({ id, tab }: { id: string; tab: string }) {
  return (
    <nav className="tabbar" aria-label={t('Điều hướng chuyến đi')}>
      {TABS.map((x) => {
        const Icon = x.icon;
        const on = tab === x.key;
        return (
          <button key={x.key} className={on ? 'on' : ''} aria-current={on ? 'page' : undefined} onClick={() => go(`/j/${id}${x.key ? '/' + x.key : ''}`)}>
            <Icon size={21} />
            <span>{t(x.label)}</span>
          </button>
        );
      })}
    </nav>
  );
}
