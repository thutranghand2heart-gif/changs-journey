import type { Activity, FoodEntry, Memory, Place, WalletDoc, Day } from '../db/schema';
import { fold } from './util';

export interface SearchHit { kind: 'activity' | 'place' | 'food' | 'memory' | 'document' | 'day'; id: string; title: string; snippet: string; dayId?: string }

export interface SearchCorpus { days: Day[]; activities: Activity[]; places: Place[]; food: FoodEntry[]; memories: Memory[]; docs: WalletDoc[] }

/** Privacy filter: private or encrypted items never enter the public corpus. */
export function publicMemories(m: Memory[]): Memory[] {
  return m.filter((x) => x.privacy !== 'private' && !x.encrypted);
}
export function publicDocs(d: WalletDoc[]): WalletDoc[] {
  return d.filter((x) => x.privacy !== 'private' && !x.encrypted);
}

function hay(...parts: (string | undefined)[]): string {
  return fold(parts.filter(Boolean).join(' | '));
}
/** Tone-less pinyin without spaces also matches ("waitan" → "Wàitān"). */
function matches(h: string, q: string): boolean {
  if (h.includes(q)) return true;
  return h.replace(/\s+/g, '').includes(q.replace(/\s+/g, ''));
}

export function search(corpus: SearchCorpus, query: string): SearchHit[] {
  const q = fold(query);
  if (!q) return [];
  const hits: SearchHit[] = [];
  const placeById = new Map(corpus.places.map((p) => [p.id, p]));
  for (const p of corpus.places) {
    if (matches(hay(p.name, p.nameZh, p.pinyin, p.city, p.addressZh, p.addressEn, p.notes, ...p.aliases), q))
      hits.push({ kind: 'place', id: p.id, title: p.name, snippet: [p.nameZh, p.addressZh].filter(Boolean).join(' · ') });
  }
  for (const d of corpus.days) {
    if (d.freeDay) continue; // free day stays uncluttered & private
    if (matches(hay(d.title, d.subtitle, d.notes), q)) hits.push({ kind: 'day', id: d.id, title: `Ngày ${d.index}: ${d.title}`, snippet: d.subtitle ?? '', dayId: d.id });
  }
  for (const a of corpus.activities) {
    const p = a.placeId ? placeById.get(a.placeId) : undefined;
    if (matches(hay(a.title, a.nameZh, a.pinyin, a.descriptionVi, a.notes, p?.name, p?.nameZh, p?.pinyin, ...(p?.aliases ?? [])), q))
      hits.push({ kind: 'activity', id: a.id, title: a.title, snippet: [a.start, a.nameZh].filter(Boolean).join(' · '), dayId: a.dayId });
  }
  for (const f of corpus.food) {
    if (matches(hay(f.dish, f.place, f.city, f.notes, f.address), q)) hits.push({ kind: 'food', id: f.id, title: f.dish, snippet: [f.place, f.city].filter(Boolean).join(' · ') });
  }
  for (const m of publicMemories(corpus.memories)) {
    if (matches(hay(m.title, m.body), q)) hits.push({ kind: 'memory', id: m.id, title: m.title || 'Kỷ niệm', snippet: m.body.slice(0, 80), dayId: m.dayId });
  }
  for (const d of publicDocs(corpus.docs)) {
    // documents: title + category only (booking details are not shown as snippets)
    if (matches(hay(d.title, d.category), q)) hits.push({ kind: 'document', id: d.id, title: d.title, snippet: d.category });
  }
  return hits;
}
