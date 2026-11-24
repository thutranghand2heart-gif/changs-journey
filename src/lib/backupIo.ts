import * as db from '../db/idb';
import { STORES, type BlobRecord, type StoreName } from '../db/schema';
import type { Dataset } from './backup';
import { remapAsNew, sliceJourney } from './backup';

export async function collectAll(): Promise<Dataset> {
  const stores: Dataset['stores'] = {};
  for (const s of STORES) stores[s] = await db.getAll(s);
  const blobs = new Map<string, Uint8Array>();
  for (const b of (stores.blobs ?? []) as BlobRecord[]) {
    const buf = b.data instanceof Blob ? await b.data.arrayBuffer() : b.data;
    blobs.set(b.id, new Uint8Array(buf));
  }
  return { stores, blobs };
}

function entriesOf(data: Dataset): { store: StoreName; value: unknown }[] {
  const out: { store: StoreName; value: unknown }[] = [];
  for (const s of STORES) {
    for (const r of data.stores[s] ?? []) {
      if (s === 'blobs') {
        const bytes = data.blobs.get(r.id);
        if (!bytes) continue;
        out.push({ store: s, value: { ...r, data: bytes.slice().buffer } });
      } else out.push({ store: s, value: r });
    }
  }
  return out;
}

/** Adds a journey from the backup as a brand-new journey (new ids). Never touches existing data. */
export async function restoreAsNew(data: Dataset, journeyId: string) {
  const fresh = remapAsNew(sliceJourney(data, journeyId));
  await db.putMany(entriesOf(fresh));
  return fresh.stores.journeys?.[0]?.id as string;
}

/** Selective: journeys that don't exist are added with their ids; existing ones are added as copies. */
export async function restoreSelective(data: Dataset, journeyIds: string[]) {
  const existing = new Set((await db.getAll<{ id: string }>('journeys')).map((j) => j.id));
  for (const id of journeyIds) {
    if (existing.has(id)) await restoreAsNew(data, id);
    else await db.putMany(entriesOf(sliceJourney(data, id)));
  }
}

/** Full replace. Caller must have obtained explicit typed confirmation. */
export async function restoreFull(data: Dataset) {
  await db.clearAll();
  await db.putMany(entriesOf(data));
}
