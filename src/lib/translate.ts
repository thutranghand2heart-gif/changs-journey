// Online machine translation via MyMemory (https://mymemory.translated.net): free, no API key, CORS-enabled.
// Used ONLY after the user's explicit consent, ONLY for fields allowed by contentI18n.collectItems, and
// results are saved on the device. Limits: ~500 bytes per request; ~5,000 chars/day anonymous, more with an email.
import type { ContentTranslation, UiLang } from '../db/schema';
import { detectLang, txId, type TxItem } from './contentI18n';
import { nowIso } from './util';

export const PROVIDER_URL = 'https://api.mymemory.translated.net/get';
const CODE: Record<UiLang, string> = { vi: 'vi', zh: 'zh-CN', en: 'en', ko: 'ko' };
const MAX_BYTES = 450;

export class QuotaError extends Error {}
export class NetworkError extends Error {}

/** Split into chunks under the per-request byte limit, preferring sentence / line boundaries. */
export function chunkText(text: string, maxBytes = MAX_BYTES): string[] {
  const bytes = (s: string) => new TextEncoder().encode(s).length;
  if (bytes(text) <= maxBytes) return [text];
  const parts = text.split(/(?<=[.!?。！？\n])\s*/);
  const out: string[] = [];
  let cur = '';
  const push = (s: string) => s.trim() && out.push(s.trim());
  for (const p of parts) {
    if (bytes(p) > maxBytes) {
      push(cur);
      cur = '';
      let piece = '';
      for (const ch of Array.from(p)) {
        if (bytes(piece + ch) > maxBytes) (push(piece), (piece = ''));
        piece += ch;
      }
      cur = piece;
      continue;
    }
    if (bytes(cur + (cur ? ' ' : '') + p) > maxBytes) (push(cur), (cur = p));
    else cur = cur ? `${cur} ${p}` : p;
  }
  push(cur);
  return out;
}

export type Fetcher = (url: string) => Promise<{ ok: boolean; status: number; json(): Promise<any> }>;

export async function translateText(text: string, from: UiLang, to: UiLang, email?: string, fetcher: Fetcher = (u) => fetch(u)): Promise<string> {
  const out: string[] = [];
  for (const chunk of chunkText(text)) {
    const url = `${PROVIDER_URL}?q=${encodeURIComponent(chunk)}&langpair=${CODE[from]}|${CODE[to]}${email ? `&de=${encodeURIComponent(email)}` : ''}`;
    let res;
    try {
      res = await fetcher(url);
    } catch {
      throw new NetworkError('offline');
    }
    if (res.status === 429 || res.status === 403) throw new QuotaError('quota');
    if (!res.ok) throw new NetworkError(`HTTP ${res.status}`);
    const j = await res.json();
    const tr: string | undefined = j?.responseData?.translatedText;
    if (j?.responseStatus === 429 || /MYMEMORY WARNING|YOU USED ALL AVAILABLE FREE TRANSLATIONS/i.test(tr ?? '')) throw new QuotaError('quota');
    if (j?.responseStatus !== 200 && j?.responseStatus !== '200') throw new NetworkError(String(j?.responseDetails ?? j?.responseStatus));
    if (typeof tr !== 'string' || !tr.trim()) throw new NetworkError('empty');
    out.push(decodeEntities(tr));
  }
  return out.join(' ');
}
function decodeEntities(s: string) {
  return s.replace(/&#39;/g, "'").replace(/&quot;/g, '"').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>');
}

export interface JobResult { done: number; failed: number; stoppedBy?: 'quota' | 'offline' | 'cancel'; chars: number }

/** Han runs (Chinese place / shop names with their punctuation) inside mixed-language text. */
const HAN_RUN = /([㐀-鿿豈-﫿](?:[㐀-鿿豈-﫿　-〿！-｠·・]|\s*[→\-—–/]\s*(?=[㐀-鿿]))*)/g;
/** Split text into [segment, isHan] pieces. */
export function splitHan(text: string): [string, boolean][] {
  const out: [string, boolean][] = [];
  let last = 0;
  for (const m of text.matchAll(HAN_RUN)) {
    if (m.index! > last) out.push([text.slice(last, m.index), false]);
    out.push([m[0], true]);
    last = m.index! + m[0].length;
  }
  if (last < text.length) out.push([text.slice(last), false]);
  return out;
}
/**
 * V1.3: mixed text such as “Tàu 上海站 → 苏州站” keeps its Chinese names exactly as typed (they are what you show a
 * driver or read on a sign); only the other-language words around them are translated. Text that is entirely
 * Chinese (or has no Chinese) is translated as a whole, as before.
 */
export async function translateKeepHan(text: string, from: UiLang, to: UiLang, email?: string, fetcher?: Fetcher): Promise<string> {
  const parts = splitHan(text);
  const hasHan = parts.some(([, h]) => h);
  const hasOther = parts.some(([s, h]) => !h && /[\p{L}]/u.test(s));
  if (!hasHan || !hasOther) return translateText(text, from, to, email, fetcher);
  // the language of the words around the Chinese names (detectLang on the whole text would say 'zh')
  const other = parts.filter(([, h]) => !h).map(([x]) => x).join(' ');
  const src = detectLang(other);
  const out: string[] = [];
  for (const [seg, han] of parts) {
    if (han || !/[\p{L}]/u.test(seg) || src === to) { out.push(seg); continue; }
    const lead = seg.match(/^\s*/)![0], trail = seg.match(/\s*$/)![0];
    const core = seg.trim();
    const tx = await translateText(core, src, to, email, fetcher);
    out.push(lead + tx.trim() + trail);
  }
  return out.join('').replace(/\s{2,}/g, ' ').trim();
}

/** Translate the given (item, language) pairs one by one, saving each result as soon as it arrives. */
export async function runJob(
  pairs: { item: TxItem; lang: UiLang }[],
  opts: { email?: string; save: (t: ContentTranslation) => Promise<void>; onProgress?: (done: number, total: number) => void; signal?: { cancelled: boolean }; fetcher?: Fetcher; delayMs?: number; maxChars?: number },
): Promise<JobResult> {
  const r: JobResult = { done: 0, failed: 0, chars: 0 };
  for (const { item, lang } of pairs) {
    if (opts.signal?.cancelled) return { ...r, stoppedBy: 'cancel' };
    if (opts.maxChars && r.chars + item.text.length > opts.maxChars) break;
    try {
      const text = await translateKeepHan(item.text, item.srcLang, lang, opts.email, opts.fetcher);
      r.chars += item.text.length;
      await opts.save({ id: txId(item.store, item.recordId, item.field, lang), journeyId: item.journeyId, store: item.store, recordId: item.recordId, field: item.field, lang, text, srcHash: item.srcHash, srcLang: item.srcLang, source: 'machine', provider: 'mymemory', at: nowIso() });
      r.done++;
    } catch (e) {
      if (e instanceof QuotaError) return { ...r, stoppedBy: 'quota' };
      if (e instanceof NetworkError && e.message === 'offline') return { ...r, stoppedBy: 'offline' };
      r.failed++;
    }
    opts.onProgress?.(r.done + r.failed, pairs.length);
    if (opts.delayMs) await new Promise((res) => setTimeout(res, opts.delayMs));
  }
  return r;
}
