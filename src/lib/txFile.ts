// Import a multilingual update file (format 'chang-content-i18n') into the translations store.
// Safe merge by stable record IDs: a translation is applied only when the record still has the exact original text
// the file was made for (srcHash). Fields you edited since are left alone; your own hand-made translations are kept.
import type { ContentTranslation, StoreName, UiLang } from '../db/schema';
import { getField, hashText, txId } from './contentI18n';
import { nowIso } from './util';

export interface TxFileEntry { store: StoreName; recordId: string; field: string; srcHash: string; srcLang: UiLang; translations: Partial<Record<UiLang, string>> }
export interface TxFile { format: 'chang-content-i18n'; version: number; journeyId?: string; entries: TxFileEntry[] }
export interface TxImportPlan { rows: ContentTranslation[]; applied: number; editedSkipped: number; manualKept: number; missing: number }

const LANGS: UiLang[] = ['vi', 'zh', 'en', 'ko'];

export function parseTxFile(text: string): TxFile {
  const f = JSON.parse(text);
  if (f?.format !== 'chang-content-i18n' || !Array.isArray(f.entries)) throw new Error('not-a-translation-file');
  return f;
}

export function planTxImport(file: TxFile, records: Map<string, any>, existing: Map<string, ContentTranslation>): TxImportPlan {
  const plan: TxImportPlan = { rows: [], applied: 0, editedSkipped: 0, manualKept: 0, missing: 0 };
  for (const e of file.entries) {
    const rec = records.get(`${e.store}|${e.recordId}`);
    const orig = rec ? getField(rec, e.field)?.trim() : undefined;
    if (!rec || !orig) { plan.missing++; continue; }
    if (hashText(orig) !== e.srcHash) { plan.editedSkipped++; continue; }
    for (const lang of LANGS) {
      const text = e.translations[lang]?.trim();
      if (!text || lang === e.srcLang) continue;
      const id = txId(e.store, e.recordId, e.field, lang);
      const prev = existing.get(id);
      if (prev && prev.source === 'manual' && prev.provider !== 'file') { plan.manualKept++; continue; }
      plan.rows.push({ id, journeyId: rec.journeyId ?? (e.store === 'journeys' ? rec.id : 'world'), store: e.store, recordId: e.recordId, field: e.field, lang, text, srcHash: e.srcHash, srcLang: e.srcLang, source: 'manual', provider: 'file', at: nowIso() });
      plan.applied++;
    }
  }
  return plan;
}
