import { createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type { ContentTranslation, StoreName } from '../db/schema';
import * as db from '../db/idb';
import { getField, buildTxMap, CATEGORY_DEFAULTS, collectItems, displayText, missingPairs, type TxMap } from '../lib/contentI18n';
import { runJob } from '../lib/translate';
import { getLang, t } from '../lib/i18n';
import { getSettings, saveSettings } from '../db/repo';
import { useStore } from './core';
import { STORES } from '../db/schema';

interface Ctx { map: TxMap; showOriginal: boolean; setShowOriginal: (v: boolean) => void }
const C = createContext<Ctx>({ map: new Map(), showOriginal: false, setShowOriginal: () => {} });

export function ContentTxProvider({ children }: { children: ReactNode }) {
  const rows = useStore<ContentTranslation>('translations');
  const map = useMemo(() => buildTxMap(rows), [rows]);
  const [showOriginal, setShowOriginal] = useState(false);
  return <C.Provider value={{ map, showOriginal, setShowOriginal }}>{children}</C.Provider>;
}

/** ct(store, record, field) → the user's text in the current interface language (saved translation or original). */
export function useCt() {
  const { map, showOriginal } = useContext(C);
  return (store: StoreName, rec: any, field: string, fallback?: string): string => {
    if (showOriginal) return getField(rec, field) ?? fallback ?? '';
    return displayText(map, store, rec, field, getLang()).text ?? fallback ?? '';
  };
}
export function useCtState() {
  return useContext(C);
}
export function useIsTranslated() {
  const { map } = useContext(C);
  return (store: StoreName, rec: any, field: string) => displayText(map, store, rec, field, getLang()).translated;
}

export async function loadAllForTranslation() {
  const data: Partial<Record<StoreName, any[]>> = {};
  for (const s of STORES) if (!['blobs', 'settings', 'weather', 'translations', 'attachments'].includes(s)) data[s] = await db.getAll(s);
  return data;
}

const KICK = 'chang-translate-now';
/** Ask the background translator to run now (consent is still required inside). */
export const kickTranslate = () => dispatchEvent(new Event(KICK));

/** Background auto-translation (only with consent + auto enabled + online). Small batches, quota-aware. */
export function AutoTranslate() {
  const running = useRef(false);
  useEffect(() => {
    let timer: number | undefined;
    const run = async (force?: unknown) => {
      if (running.current || !navigator.onLine) return;
      const s = await getSettings();
      const ts = s.translation;
      if (!ts?.consentAt || (!ts.auto && !(force instanceof Event && force.type === KICK))) return; // 'Dịch ngay' works even with auto off
      running.current = true;
      try {
        const data = await loadAllForTranslation();
        const items = collectItems(data, { ...CATEGORY_DEFAULTS, ...ts.categories });
        const map = buildTxMap(await db.getAll<ContentTranslation>('translations'));
        const cur0 = getLang();
        const all = missingPairs(items, map);
        const pairs = [...all.filter((p) => p.lang === cur0), ...all.filter((p) => p.lang !== cur0)]; // current language first
        if (!pairs.length) return;
        const today = new Date().toISOString().slice(0, 10);
        const used = ts.usage?.day === today ? ts.usage.chars : 0;
        const budget = Math.max(0, (ts.email ? 45000 : 4500) - used);
        if (!budget) return;
        const r = await runJob(pairs, { email: ts.email, save: async (t) => void (await db.put('translations', t, true)), maxChars: Math.min(budget, 1500), delayMs: 250 });
        if (!r.chars) return; // nothing progressed (errors) — wait for the next change / online event
        db.notify();
        const cur = await getSettings();
        await saveSettings({ translation: { ...cur.translation!, usage: { day: today, chars: used + r.chars } } });
      } catch {
        /* offline or service error — try again later */
      } finally {
        running.current = false;
      }
    };
    const schedule = () => {
      clearTimeout(timer);
      timer = window.setTimeout(run, 3000);
    };
    schedule();
    addEventListener('online', schedule);
    const kick = (e: Event) => run(e);
    addEventListener(KICK, kick);
    const off = db.onChange(schedule);
    return () => (clearTimeout(timer), removeEventListener('online', schedule), removeEventListener(KICK, kick), off());
  }, []);
  return null;
}

/** Inline display of a user-entered field in the current interface language. */
export function Tx({ s, r, f, fallback }: { s: StoreName; r: any; f: string; fallback?: string }) {
  const ct = useCt();
  return <>{ct(s, r, f, fallback)}</>;
}

/** "Xem bản gốc / Xem bản dịch" switch shown in detail views when a translation is in use. */
export function OriginalToggle({ s, r, fields }: { s: StoreName; r: any; fields: string[] }) {
  const { map, showOriginal, setShowOriginal } = useContext(C);
  const any = fields.some((f) => displayText(map, s, r, f, getLang()).translated);
  if (!any && !showOriginal) return null;
  return (
    <button className="tx-toggle" data-testid="tx-toggle" onClick={() => setShowOriginal(!showOriginal)}>
      {showOriginal ? t('🌐 Xem bản dịch') : t('🌐 Bản dịch máy · Xem bản gốc')}
    </button>
  );
}

/**
 * Small notice on Home when the interface language has no translation yet for some of the user's own text.
 * Never sends anything by itself: without consent it opens the Translate page (consent screen).
 */
export function TxNudge({ journeyId }: { journeyId?: string }) {
  const { map } = useContext(C);
  const lang = getLang();
  const [settings, setSettings] = useState<any>(null);
  const [data, setData] = useState<Partial<Record<StoreName, any[]>> | null>(null);
  const [busy, setBusy] = useState(false);
  const [hidden, setHidden] = useState(false);
  useEffect(() => {
    let live = true;
    const load = async () => {
      const [s, d] = await Promise.all([getSettings(), loadAllForTranslation()]);
      if (live) (setSettings(s), setData(d));
    };
    load();
    const off = db.onChange(load);
    return () => ((live = false), off());
  }, []);
  if (hidden || !data || !settings) return null;
  const ts = settings.translation;
  const items = collectItems(data, { ...CATEGORY_DEFAULTS, ...(ts?.categories ?? {}) }).filter((i) => !journeyId || i.journeyId === journeyId);
  const missing = missingPairs(items, map, [lang]).length;
  if (!missing) return null;
  const consent = !!ts?.consentAt;
  const online = navigator.onLine;
  const go = () => {
    if (!consent) return void (location.hash = `#/translate${journeyId ? `?j=${journeyId}` : ''}`);
    setBusy(true);
    kickTranslate();
    setTimeout(() => setBusy(false), 20000);
  };
  return (
    <div className="tx-nudge glass-card small" data-testid="tx-nudge">
      <span className="grow">
        {busy ? t('Đang dịch nội dung của bạn… ({0} mục còn lại)', missing) : t('{0} mục bạn tự nhập chưa có bản dịch sang ngôn ngữ đang chọn.', missing)}
        {!online && <span className="xsmall muted block">{t('Cần có mạng để dịch. Các bản dịch đã lưu vẫn đọc được offline.')}</span>}
      </span>
      {!busy && <button className="btn small" disabled={consent && !online} onClick={go}>{consent ? t('Dịch ngay') : t('Bật dịch')}</button>}
      <button className="icon-btn" aria-label={t('Đóng')} onClick={() => setHidden(true)}>×</button>
    </div>
  );
}
