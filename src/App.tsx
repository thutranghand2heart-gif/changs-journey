import { useEffect, useState } from 'react';
import { getSettings, DEFAULT_SETTINGS } from './db/repo';
import { onChange } from './db/idb';
import type { GlobalSettings, Journey } from './db/schema';
import { AppCtx } from './ui/app-context';
import { UpdateNotice } from './ui/UpdateNotice';
import { AutoTranslate, ContentTxProvider } from './ui/contentTx';
import { TranslatePage } from './features/global/Translate';
import { go, ToastHost, useLive, useRoute } from './ui/core';
import * as db from './db/idb';
import { setLang, t } from './lib/i18n';
import { prefersReducedMotion } from './lib/util';
import { GlobalHome } from './features/global/GlobalHome';
import { JourneyCreator } from './features/global/JourneyCreator';
import { Library, EditJourney } from './features/global/Library';
import { TravelWorld } from './features/global/TravelWorld';
import { SettingsPage } from './features/global/Settings';
import { VaultPage } from './features/global/Vault';
import { BackupPage } from './features/global/Backup';
import { OfflinePage } from './features/global/Offline';
import { ImportJourneyPage } from './features/global/ImportJourney';
import { JourneyShell } from './features/journey/JourneyShell';
import { JourneyHome } from './features/journey/JourneyHome';
import { JourneyTab } from './features/journey/JourneyTab';
import { MapTab } from './features/journey/MapTab';
import { PoseTab } from './features/journey/PoseTab';
import { WalletTab } from './features/wallet/WalletTab';
import { BudgetPage } from './features/wallet/Budget';
import { TravelDocPage } from './features/wallet/TravelDoc';
import { MemoriesHub, MemoryView } from './features/memories/Memories';
import { MemoryEditorPage } from './features/memories/MemoryEditor';
import { Capsules, EndingPage, ExportPage, PostcardStudio } from './features/memories/Extras';
import { FoodPassport } from './features/extras/Food';
import { ChecklistPage, EmergencyPage, LanguagePage, TransportPage, WeatherPage } from './features/extras/Travel';
import { MagicPage } from './features/extras/Magic';
import { AppearancePage, FeatureLibrary, SearchPage } from './features/extras/Misc';
import { BackgroundEditor } from './features/journey/Background';

export function App() {
  const [settings, setSettings] = useState<GlobalSettings>(DEFAULT_SETTINGS);
  const [ready, setReady] = useState(false);
  const [fatal, setFatal] = useState<string | null>(null);
  const [sysReduced, setSysReduced] = useState(prefersReducedMotion('system'));

  useEffect(() => {
    getSettings()
      .then((s) => (setSettings(s), setReady(true)))
      .catch((e) => setFatal(String(e?.message ?? e)));
    const off = onChange(() => getSettings().then(setSettings).catch(() => {}));
    const mq = matchMedia('(prefers-reduced-motion: reduce)');
    const f = () => setSysReduced(mq.matches);
    mq.addEventListener?.('change', f);
    return () => (off(), mq.removeEventListener?.('change', f));
  }, []);
  setLang(settings.language);
  const reduced = settings.reducedMotion === 'on' || (settings.reducedMotion === 'system' && sysReduced);
  useEffect(() => {
    document.documentElement.classList.toggle('reduce-motion', reduced);
    document.documentElement.lang = settings.language === 'zh' ? 'zh-CN' : settings.language;
  }, [reduced, settings.language]);

  if (fatal)
    return (
      <div className="page theme-global">
        <h1>{t('Không mở được bộ nhớ')}</h1>
        <p className="error">{fatal}</p>
        <p>{t('Ứng dụng cần IndexedDB. Trên iPhone, chế độ Duyệt web riêng tư có thể chặn bộ nhớ — hãy mở trong tab thường hoặc từ Màn hình chính.')}</p>
      </div>
    );
  if (!ready) return <div className="boot" aria-busy="true" />;
  return (
    <AppCtx.Provider value={{ settings, reduced }}>
      <ToastHost>
        <UpdateNotice />
        <ContentTxProvider>
          <AutoTranslate />
          <Router key={settings.language} />
        </ContentTxProvider>
      </ToastHost>
    </AppCtx.Provider>
  );
}

function Router() {
  const r = useRoute();
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [r.join('/')]);
  const [a, b, c, d, e] = r;
  switch (a) {
    case undefined:
      return <GlobalHome />;
    case 'new':
      return <JourneyCreator />;
    case 'library':
      return <Library />;
    case 'world':
      return <TravelWorld />;
    case 'settings':
      return <SettingsPage />;
    case 'vault':
      return <VaultPage />;
    case 'backup':
      return <BackupPage />;
    case 'offline':
      return <OfflinePage />;
    case 'import':
      return <ImportJourneyPage />;
    case 'translate':
      return <TranslatePage />;
    case 'background':
      return <BackgroundEditor back="/" />;
    case 'j':
      if (!b) return <GlobalHome />;
      return <JourneyShell id={b} tab={c ?? ''}>{() => <JourneyRoute c={c} d={d} e={e} />}</JourneyShell>;
    default:
      go('/');
      return null;
  }
}

function JourneyRoute({ c, d, e }: { c?: string; d?: string; e?: string }) {
  switch (c) {
    case undefined:
      return <JourneyHome />;
    case 'journey':
      return <JourneyTab dayId={d} />;
    case 'map':
      return <MapTab />;
    case 'pose':
      return <PoseTab />;
    case 'wallet':
      return <WalletTab />;
    case 'budget':
      return <BudgetPage />;
    case 'travel-doc':
      return <TravelDocPage />;
    case 'memories':
      if (d === 'new') return <MemoryEditorPage />;
      if (d && ['book', 'gallery', 'keepsakes'].includes(d)) return <MemoriesHub view={d} />;
      if (d && e === 'edit') return <MemoryEditorPage memoryId={d} />;
      if (d) return <MemoryView id={d} />;
      return <MemoriesHub />;
    case 'postcards':
      return <PostcardStudio />;
    case 'capsules':
      return <Capsules />;
    case 'ending':
      return <EndingPage />;
    case 'export':
      return <ExportPage />;
    case 'food':
      return <FoodPassport />;
    case 'language':
      return <LanguagePage />;
    case 'transport':
      return <TransportPage />;
    case 'weather':
      return <WeatherPage />;
    case 'checklist':
      return <ChecklistPage />;
    case 'emergency':
      return <EmergencyPage />;
    case 'magic':
      return <MagicPage />;
    case 'features':
      return <FeatureLibrary />;
    case 'search':
      return <SearchPage />;
    case 'appearance':
      return <AppearancePage />;
    case 'background':
      return <BgRoute />;
    case 'edit':
      return <EditRoute />;
    default:
      return <JourneyHome />;
  }
}

function BgRoute() {
  const id = location.hash.split('/')[2];
  const [j] = useLive(() => db.get<Journey>('journeys', id), [id], undefined as Journey | undefined);
  if (!j) return null;
  return <BackgroundEditor journey={j} back={`/j/${id}/appearance`} />;
}
function EditRoute() {
  const id = location.hash.split('/')[2];
  const [j] = useLive(() => db.get<Journey>('journeys', id), [id], undefined as Journey | undefined);
  if (!j) return null;
  return <EditJourney j={j} onClose={() => go(`/j/${id}/appearance`)} />;
}
