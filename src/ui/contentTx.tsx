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

/** Background auto-translation (only with consent + auto enabled + online). Small batches, quota-aware. */
export function AutoTranslate() {
  const running = useRef(false);
  useEffect(() => {
    let timer: number | undefined;
    const run = async () => {
      if (running.current || !navigator.onLine) return;
      const s = await getSettings();
      const ts = s.translation;
      if (!ts?.consentAt || !ts.auto) return;
      running.current = true;
      try {
        const data = await loadAllForTranslation();
        const items = collectItems(data, { ...CATEGORY_DEFAULTS, ...ts.categories });
        const map = buildTxMap(await db.getAll<ContentTranslation>('translations'));
        const pairs = missingPairs(items, map);
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
      timer = window.setTimeout(run, 8000);
    };
    schedule();
    addEventListener('online', schedule);
    const off = db.onChange(schedule);
    return () => (clearTimeout(timer), removeEventListener('online', schedule), off());
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
