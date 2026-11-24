import { SCHEMA_VERSION, STORES, type StoreName } from './schema';

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
    if (typeof indexedDB === 'undefined') return reject(new StorageError('IndexedDB không khả dụng trên trình duyệt này.'));
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
      // future: if (old < 2) { ... }
    };
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(new StorageError(String(r.error?.message || r.error)));
    r.onblocked = () => reject(new StorageError('Cơ sở dữ liệu đang bị khóa bởi một tab khác.'));
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
  if (!e) return 'Lỗi lưu trữ không xác định.';
  if (e.name === 'QuotaExceededError') return 'Bộ nhớ trình duyệt đã đầy. Hãy sao lưu và xóa bớt ảnh/tệp lớn.';
  return `${e.name}: ${e.message}`;
}
