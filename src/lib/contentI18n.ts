// Translation of USER-ENTERED content (titles, notes, diary…) into the four app languages.
// Translations are stored on the device (store 'translations') so they can be read offline.
// Never translated / never sent: private or encrypted items, booking details & references, flight/hotel
// structured fields, addresses, Chinese names, pinyin, phone numbers, capsule letters.
import type { ContentTranslation, StoreName, UiLang } from '../db/schema';

export const LANGS: UiLang[] = ['vi', 'zh', 'en', 'ko'];

/** Fields that may be translated, per store, grouped into user-selectable categories. */
export const FIELD_REGISTRY: { store: StoreName; fields: string[]; category: string }[] = [
  { store: 'journeys', fields: ['title', 'subtitle', 'notes', 'wardrobeHint', 'postcardDefault', 'transportNotes.*', 'adventMessages.*'], category: 'itinerary' },
  { store: 'days', fields: ['title', 'subtitle', 'notes'], category: 'itinerary' },
  { store: 'activities', fields: ['title', 'descriptionVi', 'notes', 'unverified'], category: 'itinerary' },
  { store: 'places', fields: ['name', 'city', 'notes'], category: 'places' },
  { store: 'checklist', fields: ['text', 'group'], category: 'checklist' },
  { store: 'memories', fields: ['title', 'body'], category: 'memories' },
  { store: 'food', fields: ['dish', 'place', 'city', 'notes'], category: 'food' },
  { store: 'expenses', fields: ['title', 'notes'], category: 'budget' },
  { store: 'poses', fields: ['title', 'description', 'notes', 'hands', 'body', 'camera', 'framing', 'lighting'], category: 'poses' },
  { store: 'docs', fields: ['title'], category: 'wallet' },
  { store: 'world', fields: ['name', 'story'], category: 'world' },
];
export const CATEGORY_DEFAULTS: Record<string, boolean> = { itinerary: true, places: true, checklist: true, memories: false, food: true, budget: true, poses: true, wallet: true, world: true };

/** Heuristic source-language detection for short user texts. */
export function detectLang(s: string): UiLang {
  if (/[가-힯ᄀ-ᇿ]/.test(s)) return 'ko';
  const han = (s.match(/[一-鿿]/g) ?? []).length;
  const latin = (s.match(/[A-Za-zÀ-ỹ]/g) ?? []).length;
  if (han && han >= latin) return 'zh';
  if (/[ăâđêôơưạảấầẩẫậắằẳẵặẹẻẽếềểễệỉịọỏốồổỗộớờởỡợụủứừửữựỳỵỷỹàáèéìíòóùúýãẽĩõũỹ]/i.test(s)) return 'vi';
  return latin ? 'en' : 'vi';
}

/** Stable 32-bit FNV-1a hash (hex) of the original text → detects when a translation is outdated. */
export function hashText(s: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(16).padStart(8, '0');
}

export function getField(rec: any, field: string): string | undefined {
  const [k, i] = field.split('.');
  const v = rec?.[k];
  if (i !== undefined) return Array.isArray(v) && typeof v[Number(i)] === 'string' ? v[Number(i)] : undefined;
  return typeof v === 'string' ? v : undefined;
}

export const txId = (store: string, recordId: string, field: string, lang: UiLang) => `${store}|${recordId}|${field}|${lang}`;

/** Is this record allowed to leave the device for translation? */
export function isTranslatable(store: StoreName, rec: any): boolean {
  if (!rec) return false;
  if (rec.privacy === 'private' || rec.encrypted) return false;
  return true;
}

export interface TxItem { store: StoreName; recordId: string; journeyId: string; field: string; text: string; srcLang: UiLang; srcHash: string }

/** All user texts that could be translated, honouring categories and privacy exclusions. */
export function collectItems(data: Partial<Record<StoreName, any[]>>, categories: Record<string, boolean>): TxItem[] {
  const out: TxItem[] = [];
  for (const reg of FIELD_REGISTRY) {
    if (!categories[reg.category]) continue;
    for (const rec of data[reg.store] ?? []) {
      if (!isTranslatable(reg.store, rec)) continue;
      for (const f of reg.fields) {
        const fields = f.endsWith('.*') ? (rec[f.slice(0, -2)] ?? []).map((_: unknown, i: number) => `${f.slice(0, -2)}.${i}`) : [f];
        for (const field of fields) {
          const text = getField(rec, field)?.trim();
          if (!text || !/\p{L}/u.test(text)) continue;
          out.push({ store: reg.store, recordId: rec.id, journeyId: reg.store === 'world' ? 'world' : reg.store === 'journeys' ? rec.id : rec.journeyId, field, text, srcLang: detectLang(text), srcHash: hashText(text) });
        }
      }
    }
  }
  return out;
}

export type TxMap = Map<string, ContentTranslation>;
export const buildTxMap = (rows: ContentTranslation[]): TxMap => new Map(rows.map((r) => [txId(r.store, r.recordId, r.field, r.lang), r]));

/**
 * Text to display for a user field in `lang`: the saved translation when it exists and matches the current
 * original; otherwise the original (never an invented translation).
 */
export function displayText(map: TxMap, store: StoreName, rec: any, field: string, lang: UiLang): { text: string | undefined; translated: boolean; stale: boolean } {
  const orig = getField(rec, field);
  if (!orig || !rec?.id) return { text: orig, translated: false, stale: false };
  const tr = map.get(txId(store, rec.id, field, lang));
  // a saved translation wins even when the text merely looks like this language (mixed text such as "Tàu 上海站 → 苏州站")
  if (!tr || (detectLang(orig) === lang && tr.srcHash !== hashText(orig.trim()))) return { text: orig, translated: false, stale: false };
  if (tr.srcHash !== hashText(orig.trim())) return { text: orig, translated: false, stale: true };
  return { text: tr.text, translated: true, stale: false };
}

/** Which (item, target-language) pairs still need a translation. */
export function missingPairs(items: TxItem[], map: TxMap, targets: UiLang[] = LANGS): { item: TxItem; lang: UiLang }[] {
  const out: { item: TxItem; lang: UiLang }[] = [];
  for (const item of items)
    for (const lang of targets) {
      if (lang === item.srcLang) continue;
      const tr = map.get(txId(item.store, item.recordId, item.field, lang));
      if (tr && (tr.srcHash === item.srcHash || tr.source === 'manual')) continue;
      out.push({ item, lang });
    }
  return out;
}
