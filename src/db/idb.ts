import { SCHEMA_VERSION, STORES, type Journey, type StoreName, type WalletDoc } from './schema';
import { linkHotelV2, migrateDocV2 } from './migrate';
import { t } from '../lib/i18n';

const DB_NAME = 'chang-journeys';
let dbPromise: Promise<IDBDatabase> | null = null;
const listeners = new Set<() => void>();

export class StorageError extends Error {}

function req<T>(r: IDBRequest<T>): Promise<T> {
  return new Promise((res, rej) => {
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
  });
}

export function openDb(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') return reject(new StorageError(t('IndexedDB không khả dụng trên trình duyệt này.')));
    const r = indexedDB.open(DB_NAME, SCHEMA_VERSION);
    r.onupgradeneeded = (ev) => {
      const db = r.result;
      const old = ev.oldVersion;
      // Migration ladder. v0 -> v1 creates all stores.
      if (old < 1) {
        for (const s of STORES) {
          if (db.objectStoreNames.contains(s)) continue;
          const keyPath = s === 'weather' ? 'journeyId' : 'id';
          const os = db.createObjectStore(s, { keyPath });
          if (s !== 'settings' && s !== 'weather' && s !== 'world') os.createIndex('journeyId', 'journeyId');
        }
      }
      // v1 -> v2 (app 1.0.1): attachments store + canonical booking records. Runs inside the upgrade
      // transaction, so it either completes fully or not at all. Never deletes or copies file bytes.
      if (old >= 1 && old < 2) {
        try { localStorage.setItem('chang-db-upgraded-from', String(old)); } catch { /* storage unavailable */ }
        if (!db.objectStoreNames.contains('attachments')) db.createObjectStore('attachments', { keyPath: 'id' }).createIndex('journeyId', 'journeyId');
        const tx = r.transaction!;
        const docsOs = tx.objectStore('docs');
        const attOs = tx.objectStore('attachments');
        const jOs = tx.objectStore('journeys');
        const all = docsOs.getAll();
        all.onsuccess = () => {
          const docs = (all.result as WalletDoc[]).map((d) => {
            const m = migrateDocV2(d);
            if (m.attachment) attOs.put(m.attachment);
            if (m.doc !== d) docsOs.put(m.doc);
            return m.doc;
          });
          const js = jOs.getAll();
          js.onsuccess = () => {
            for (const j of js.result as Journey[]) {
              const h = linkHotelV2(j, docs);
              if (h.journey) jOs.put(h.journey);
              if (h.doc) docsOs.put(h.doc);
            }
          };
        };
      }
      // v2 -> v3 (app 1.0.2): saved translations of user content. Purely additive.
      if (old >= 1 && old < 3 && !db.objectStoreNames.contains('translations')) {
        db.createObjectStore('translations', { keyPath: 'id' }).createIndex('journeyId', 'journeyId');
      }
    };
    r.onsuccess = () => {
      const conn = r.result;
      conn.onversionchange = () => {
        conn.close();
        location.reload();
      };
      resolve(conn);
    };
    r.onerror = () => reject(new StorageError(String(r.error?.message || r.error)));
    r.onblocked = () => reject(new StorageError(t('Cơ sở dữ liệu đang bị khóa bởi một tab khác.')));
  });
  return dbPromise;
}

export function onChange(fn: () => void) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}
let pending = false;
export function notify() {
  if (pending) return;
  pending = true;
  queueMicrotask(() => {
    pending = false;
    listeners.forEach((l) => l());
  });
}

export async function getAll<T>(store: StoreName, journeyId?: string): Promise<T[]> {
  const db = await openDb();
  const tx = db.transaction(store, 'readonly');
  const os = tx.objectStore(store);
  if (journeyId && os.indexNames.contains('journeyId')) return req(os.index('journeyId').getAll(journeyId)) as Promise<T[]>;
  return req(os.getAll()) as Promise<T[]>;
}

export async function get<T>(store: StoreName, id: string): Promise<T | undefined> {
  const db = await openDb();
  return req(db.transaction(store, 'readonly').objectStore(store).get(id)) as Promise<T | undefined>;
}

export async function put<T>(store: StoreName, value: T, silent = false): Promise<T> {
  const db = await openDb();
  const tx = db.transaction(store, 'readwrite');
  tx.objectStore(store).put(value as any);
  await txDone(tx);
  if (!silent) notify();
  return value;
}

export async function putMany(entries: { store: StoreName; value: unknown }[]): Promise<void> {
  if (!entries.length) return;
  const db = await openDb();
  const stores = Array.from(new Set(entries.map((e) => e.store)));
  const tx = db.transaction(stores, 'readwrite');
  for (const e of entries) tx.objectStore(e.store).put(e.value as any);
  await txDone(tx);
  notify();
}

export async function del(store: StoreName, id: string): Promise<void> {
  const db = await openDb();
  const tx = db.transaction(store, 'readwrite');
  tx.objectStore(store).delete(id);
  await txDone(tx);
  notify();
}

export async function clearAll(): Promise<void> {
  const db = await openDb();
  const tx = db.transaction([...STORES], 'readwrite');
  for (const s of STORES) tx.objectStore(s).clear();
  await txDone(tx);
  notify();
}

function txDone(tx: IDBTransaction): Promise<void> {
  return new Promise((res, rej) => {
    tx.oncomplete = () => res();
    tx.onerror = () => rej(new StorageError(humanize(tx.error)));
    tx.onabort = () => rej(new StorageError(humanize(tx.error)));
  });
}

function humanize(e: DOMException | null): string {
  if (!e) return t('Lỗi lưu trữ không xác định.');
  if (e.name === 'QuotaExceededError') return t('Bộ nhớ trình duyệt đã đầy. Hãy sao lưu và xóa bớt ảnh/tệp lớn.');
  return `${e.name}: ${e.message}`;
}
