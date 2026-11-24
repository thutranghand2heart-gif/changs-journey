import * as db from './idb';
import type {
  Activity, BlobRecord, Day, Expense, GlobalSettings, Journey, JourneySettings, StoreName, ThemeId,
} from './schema';
import { STORES } from './schema';
import { bundleEntries, type JourneyBundle } from '../lib/journeyFile';
import { remapAsNew } from '../lib/backup';
import { nowIso, uid } from '../lib/util';
import { addDays, daysBetween, weekdayVi } from '../lib/time';

export const DEFAULT_SETTINGS: GlobalSettings = { id: 'global', language: 'vi', reducedMotion: 'system', performanceMode: false, backups: [], seeded: [] };

export async function getSettings(): Promise<GlobalSettings> {
  const s = await db.get<GlobalSettings>('settings', 'global');
  return { ...DEFAULT_SETTINGS, ...(s ?? {}) };
}
export async function saveSettings(patch: Partial<GlobalSettings>): Promise<GlobalSettings> {
  const cur = await getSettings();
  const next = { ...cur, ...patch, id: 'global' as const };
  await db.put('settings', next);
  return next;
}

export type ImportResult = { status: 'imported' | 'copied'; journeyId: string };

/** Is a journey from this import file already on the device (same id or same import key)? */
export async function findExistingImport(b: JourneyBundle): Promise<Journey | undefined> {
  const all = await db.getAll<Journey>('journeys');
  return all.find((j) => j.id === b.journey.id || (!!b.journey.seedKey && j.seedKey === b.journey.seedKey));
}

/**
 * Imports a private journey file into IndexedDB in ONE transaction.
 * mode 'add': only when not already present (never overwrites user edits).
 * mode 'copy': adds it again with fresh ids, leaving the existing journey untouched.
 */
export async function importJourney(b: JourneyBundle, mode: 'add' | 'copy'): Promise<ImportResult> {
  if (mode === 'add') {
    if (await findExistingImport(b)) throw new db.StorageError('Chuyến đi này đã có trên máy. Hãy mở nó, hoặc nhập thành bản sao.');
    await db.putMany(bundleEntries(b));
    return { status: 'imported', journeyId: b.journey.id };
  }
  const fresh = remapAsNew({ stores: { journeys: [b.journey], days: b.days, activities: b.activities, places: b.places, docs: b.docs, expenses: b.expenses, poses: b.poses, checklist: b.checklist }, blobs: new Map() }, ' (bản sao)');
  const entries: { store: StoreName; value: unknown }[] = [];
  for (const [store, rows] of Object.entries(fresh.stores)) for (const value of rows ?? []) entries.push({ store: store as StoreName, value });
  await db.putMany(entries);
  return { status: 'copied', journeyId: fresh.stores.journeys![0].id };
}

export function defaultJourneySettings(theme: ThemeId = 'christmas-emerald'): JourneySettings {
  return { theme, fontStyle: 'storybook', animations: 'full', openingAnimation: theme === 'christmas-emerald', decorations: true, sound: false, backgrounds: {}, rotateBackgrounds: [] };
}

export interface NewJourneyInput {
  title: string; destinations: string[]; startDate: string; endDate: string; timeZone: string; currency: string; notes: string; theme: ThemeId; coverEmoji: string; templateFrom?: string;
}

export async function createJourney(input: NewJourneyInput): Promise<Journey> {
  const id = uid('j');
  const t = nowIso();
  const j: Journey = {
    id, title: input.title.trim() || 'Chuyến đi mới', destinations: input.destinations, startDate: input.startDate, endDate: input.endDate,
    timeZone: input.timeZone, currency: input.currency, notes: input.notes, coverEmoji: input.coverEmoji || '📖', pinned: false, archived: false,
    createdAt: t, updatedAt: t, settings: defaultJourneySettings(input.theme),
  };
  const n = Math.max(1, Math.min(60, daysBetween(input.startDate, input.endDate) + 1));
  const days: Day[] = Array.from({ length: n }, (_, i) => ({
    id: uid('d'), journeyId: id, index: i + 1, date: addDays(input.startDate, i), title: `Ngày ${i + 1}`, subtitle: weekdayVi(addDays(input.startDate, i)), freeDay: false, privateByDefault: false, notes: '',
  }));
  const entries: { store: StoreName; value: unknown }[] = [{ store: 'journeys', value: j }, ...days.map((value) => ({ store: 'days' as const, value }))];

  // Template: copy ONLY day titles + activity skeletons as drafts. Never documents, bookings, payments or private data.
  if (input.templateFrom) {
    const srcDays = (await db.getAll<Day>('days', input.templateFrom)).sort((a, b) => a.index - b.index);
    const srcActs = await db.getAll<Activity>('activities', input.templateFrom);
    srcDays.forEach((sd, i) => {
      const nd = days[i];
      if (!nd) return;
      nd.title = sd.title;
      nd.freeDay = sd.freeDay;
      for (const a of srcActs.filter((x) => x.dayId === sd.id)) {
        const copy: Activity = {
          ...a, id: uid('a'), journeyId: id, dayId: nd.id, status: 'draft', placeId: undefined, documentIds: [], expenseIds: [], photoBlobIds: [], poseIds: [], notes: '', unverified: undefined, timeZone: a.timeZone === 'Asia/Seoul' ? a.timeZone : input.timeZone,
        };
        entries.push({ store: 'activities', value: copy });
      }
    });
  }
  await db.putMany(entries);
  return j;
}

export async function updateJourney(id: string, patch: Partial<Journey>): Promise<void> {
  const j = await db.get<Journey>('journeys', id);
  if (!j) throw new db.StorageError('Không tìm thấy chuyến đi.');
  await db.put('journeys', { ...j, ...patch, id, updatedAt: nowIso() });
}
export async function updateJourneySettings(id: string, patch: Partial<JourneySettings>): Promise<void> {
  const j = await db.get<Journey>('journeys', id);
  if (!j) return;
  await db.put('journeys', { ...j, settings: { ...j.settings, ...patch }, updatedAt: nowIso() });
}

const JOURNEY_STORES: StoreName[] = STORES.filter((s) => !['settings', 'weather', 'world', 'journeys'].includes(s)) as StoreName[];

/** Permanent deletion of a journey and everything that belongs to it. Caller must confirm. */
export async function deleteJourney(id: string): Promise<void> {
  const conn = await db.openDb();
  const tx = conn.transaction([...JOURNEY_STORES, 'journeys', 'weather'], 'readwrite');
  for (const s of JOURNEY_STORES) {
    const idx = tx.objectStore(s).index('journeyId');
    const r = idx.openCursor(IDBKeyRange.only(id));
    r.onsuccess = () => {
      const c = r.result;
      if (c) {
        c.delete();
        c.continue();
      }
    };
  }
  tx.objectStore('journeys').delete(id);
  tx.objectStore('weather').delete(id);
  await new Promise<void>((res, rej) => {
    tx.oncomplete = () => res();
    tx.onerror = () => rej(tx.error);
  });
  db.notify();
}

/** Deleting an activity keeps linked photos, receipts, memories & expenses; only unlinks them. */
export async function deleteActivity(a: Activity): Promise<void> {
  const exps = await db.getAll<Expense>('expenses', a.journeyId);
  const entries = exps.filter((e) => e.activityId === a.id).map((e) => ({ store: 'expenses' as const, value: { ...e, activityId: undefined } }));
  await db.putMany(entries);
  await db.del('activities', a.id);
}

export async function saveFileAsBlob(file: Blob, name: string, journeyId?: string): Promise<BlobRecord> {
  if (!file.size) throw new db.StorageError('Tệp trống — không thể lưu.');
  // Store as ArrayBuffer: Safari has historically had bugs persisting Blob objects in IndexedDB.
  const data = await file.arrayBuffer();
  const rec: BlobRecord = { id: uid('b'), journeyId, mime: file.type || guessMime(name), name, size: file.size, data, createdAt: nowIso() };
  await db.put('blobs', rec, true);
  return rec;
}
export function guessMime(name: string): string {
  const ext = name.split('.').pop()?.toLowerCase();
  return ({ pdf: 'application/pdf', png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', heic: 'image/heic', webp: 'image/webp', gif: 'image/gif', mp4: 'video/mp4', mov: 'video/quicktime' } as Record<string, string>)[ext ?? ''] ?? 'application/octet-stream';
}

/** Reads a blob back and confirms it has bytes. Returns null when missing/unreadable. */
export async function readBlob(id: string): Promise<{ rec: BlobRecord; blob: Blob } | null> {
  const rec = await db.get<BlobRecord>('blobs', id);
  if (!rec || rec.encrypted) return rec ? { rec, blob: new Blob([]) } : null;
  const blob = rec.data instanceof Blob ? rec.data : new Blob([rec.data], { type: rec.mime });
  if (!blob.size) return null;
  return { rec, blob };
}

export { db };
