// Private journey import file (.changjourney.json).
// A journey's full itinerary lives in a file the user keeps in the iPhone Files app,
// is imported ONCE into IndexedDB, and is never part of the app source or deployment.
import { IMPORT_FORMAT, IMPORT_FORMAT_VERSION } from '../db/schema';
import type { Activity, ChecklistItem, Day, Expense, Journey, Place, Pose, StoreName, WalletDoc } from '../db/schema';
import { sha256Hex } from './crypto';

export interface JourneyBundle {
  journey: Journey;
  days: Day[];
  activities: Activity[];
  places: Place[];
  docs: WalletDoc[];
  expenses: Expense[];
  poses: Pose[];
  checklist: ChecklistItem[];
}
export interface JourneyFile extends JourneyBundle {
  format: typeof IMPORT_FORMAT;
  version: number;
  createdAt: string;
  sha256: string; // of the canonical JSON of the bundle fields
}

const KEYS = ['journey', 'days', 'activities', 'places', 'docs', 'expenses', 'poses', 'checklist'] as const;
const canonical = (b: JourneyBundle) => new TextEncoder().encode(JSON.stringify(KEYS.map((k) => b[k])));

export async function makeJourneyFile(b: JourneyBundle, createdAt: string): Promise<JourneyFile> {
  return { format: IMPORT_FORMAT, version: IMPORT_FORMAT_VERSION, createdAt, ...b, sha256: await sha256Hex(canonical(b)) };
}

export class ImportError extends Error {}

/** Parses and fully validates an import file. Throws ImportError with a Vietnamese message. */
export async function parseJourneyFile(text: string): Promise<JourneyBundle> {
  let f: any;
  try {
    f = JSON.parse(text.replace(/^﻿/, ''));
  } catch {
    throw new ImportError('Tệp không phải JSON hợp lệ.');
  }
  if (f?.format !== IMPORT_FORMAT) throw new ImportError('Đây không phải tệp hành trình của ứng dụng.');
  if (typeof f.version !== 'number' || f.version > IMPORT_FORMAT_VERSION) throw new ImportError('Tệp được tạo bởi phiên bản ứng dụng mới hơn.');
  for (const k of KEYS.slice(1)) if (!Array.isArray(f[k])) throw new ImportError(`Thiếu danh sách “${k}”.`);
  const j = f.journey;
  if (!j || typeof j.id !== 'string' || typeof j.title !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(j.startDate) || !/^\d{4}-\d{2}-\d{2}$/.test(j.endDate) || typeof j.timeZone !== 'string' || !j.settings)
    throw new ImportError('Thông tin chuyến đi không đầy đủ.');
  const bundle = Object.fromEntries(KEYS.map((k) => [k, f[k]])) as unknown as JourneyBundle;
  if (f.sha256 !== (await sha256Hex(canonical(bundle)))) throw new ImportError('Tệp bị thay đổi hoặc hỏng (mã kiểm tra không khớp).');
  // referential integrity
  const own = (r: { journeyId?: string }) => r.journeyId === j.id;
  for (const k of KEYS.slice(1)) for (const r of f[k]) if (!r || typeof r.id !== 'string' || !own(r)) throw new ImportError(`Bản ghi trong “${k}” không thuộc chuyến đi này.`);
  const dayIds = new Set(bundle.days.map((d) => d.id));
  const placeIds = new Set(bundle.places.map((p) => p.id));
  for (const a of bundle.activities) {
    if (!dayIds.has(a.dayId)) throw new ImportError(`Hoạt động “${a.title}” trỏ tới ngày không tồn tại.`);
    if (a.placeId && !placeIds.has(a.placeId)) throw new ImportError(`Hoạt động “${a.title}” trỏ tới địa điểm không tồn tại.`);
  }
  const ids = KEYS.slice(1).flatMap((k) => (bundle[k] as { id: string }[]).map((r) => r.id));
  if (new Set(ids).size !== ids.length) throw new ImportError('Tệp có mã bản ghi bị trùng.');
  return bundle;
}

export function bundleEntries(b: JourneyBundle): { store: StoreName; value: unknown }[] {
  return [
    { store: 'journeys', value: b.journey },
    ...b.days.map((value) => ({ store: 'days' as const, value })),
    ...b.activities.map((value) => ({ store: 'activities' as const, value })),
    ...b.places.map((value) => ({ store: 'places' as const, value })),
    ...b.docs.map((value) => ({ store: 'docs' as const, value })),
    ...b.expenses.map((value) => ({ store: 'expenses' as const, value })),
    ...b.poses.map((value) => ({ store: 'poses' as const, value })),
    ...b.checklist.map((value) => ({ store: 'checklist' as const, value })),
  ];
}

export function summary(b: JourneyBundle) {
  return { title: b.journey.title, dates: `${b.journey.startDate} → ${b.journey.endDate}`, days: b.days.length, activities: b.activities.length, places: b.places.length, docs: b.docs.length, expenses: b.expenses.length };
}
