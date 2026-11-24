// Portable, versioned backup (.changbackup = zip, optionally AES-GCM sealed).
// Integrity: SHA-256 of every file recorded in manifest.json and re-checked on read.
import JSZip from 'jszip';
import { BACKUP_FORMAT, BACKUP_FORMAT_VERSION, SCHEMA_VERSION, STORES, type BlobRecord, type StoreName } from '../db/schema';
import { isSealed, openSealed, sealBackup, sha256Hex } from './crypto';
import { uid } from './util';
import { t } from './i18n';

export type Records = Partial<Record<StoreName, any[]>>;
export interface Dataset { stores: Records; blobs: Map<string, Uint8Array> }

export interface Manifest {
  format: typeof BACKUP_FORMAT;
  formatVersion: number;
  schemaVersion: number;
  createdAt: string;
  app: string;
  journeys: { id: string; title: string; counts: Record<string, number> }[];
  files: Record<string, string>; // path -> sha256
  note: string;
}

export interface ParsedBackup { manifest: Manifest; data: Dataset; integrityOk: boolean; problems: string[] }

export async function buildBackupZip(data: Dataset, createdAt: string): Promise<{ bytes: Uint8Array; manifest: Manifest }> {
  const zip = new JSZip();
  const files: Record<string, string> = {};
  const storesOut: Records = {};
  for (const s of STORES) {
    const rows = data.stores[s] ?? [];
    // blob payloads are written as separate files, not JSON
    storesOut[s] = s === 'blobs' ? rows.map((r: BlobRecord) => ({ ...r, data: undefined })) : rows;
  }
  const dataJson = new TextEncoder().encode(JSON.stringify(storesOut));
  zip.file('data.json', dataJson);
  files['data.json'] = await sha256Hex(dataJson);
  for (const [id, bytes] of data.blobs) {
    const p = `blobs/${id}.bin`;
    zip.file(p, bytes);
    files[p] = await sha256Hex(bytes);
  }
  const journeys = (data.stores.journeys ?? []).map((j: any) => ({
    id: j.id,
    title: j.title,
    counts: Object.fromEntries(STORES.filter((s) => !['journeys', 'settings', 'world'].includes(s)).map((s) => [s, (data.stores[s] ?? []).filter((r: any) => r.journeyId === j.id).length])),
  }));
  const manifest: Manifest = {
    format: BACKUP_FORMAT, formatVersion: BACKUP_FORMAT_VERSION, schemaVersion: SCHEMA_VERSION, createdAt, app: t('Những bước chân của Chang'), journeys, files,
    note: t('Nội dung riêng tư nằm trong bản sao lưu ở dạng đã mã hóa; cần mật khẩu Két để đọc.'),
  };
  zip.file('manifest.json', JSON.stringify(manifest, null, 2));
  const bytes: Uint8Array = await zip.generateAsync({ type: 'uint8array', compression: 'DEFLATE', compressionOptions: { level: 6 } });
  return { bytes, manifest };
}

export async function packBackup(data: Dataset, createdAt: string, passphrase?: string) {
  const { bytes, manifest } = await buildBackupZip(data, createdAt);
  const out = passphrase ? await sealBackup(passphrase, bytes) : bytes;
  return { bytes: out, manifest, sha256: await sha256Hex(out) };
}

export class BackupError extends Error {}

export async function parseBackup(raw: Uint8Array, passphrase?: string): Promise<ParsedBackup> {
  let bytes = raw;
  if (isSealed(raw)) {
    if (!passphrase) throw new BackupError('NEED_PASSPHRASE');
    try {
      bytes = await openSealed(passphrase, raw);
    } catch {
      throw new BackupError(t('Sai mật khẩu sao lưu hoặc tệp bị hỏng.'));
    }
  }
  let zip: any;
  try {
    zip = await JSZip.loadAsync(bytes);
  } catch {
    throw new BackupError(t('Tệp không phải bản sao lưu hợp lệ.'));
  }
  const mf = zip.file('manifest.json');
  if (!mf) throw new BackupError(t('Thiếu manifest.json.'));
  const manifest = JSON.parse(await mf.async('string')) as Manifest;
  if (manifest.format !== BACKUP_FORMAT) throw new BackupError(t('Định dạng sao lưu không đúng.'));
  if (manifest.formatVersion > BACKUP_FORMAT_VERSION) throw new BackupError(t('Bản sao lưu được tạo bởi phiên bản ứng dụng mới hơn.'));
  const problems: string[] = [];
  const dataFile = zip.file('data.json');
  if (!dataFile) throw new BackupError(t('Thiếu data.json.'));
  const dataBytes: Uint8Array = await dataFile.async('uint8array');
  if ((await sha256Hex(dataBytes)) !== manifest.files['data.json']) problems.push(t('data.json: mã kiểm tra không khớp'));
  const stores = JSON.parse(new TextDecoder().decode(dataBytes)) as Records;
  const blobs = new Map<string, Uint8Array>();
  for (const [path, hash] of Object.entries(manifest.files)) {
    if (!path.startsWith('blobs/')) continue;
    const f = zip.file(path);
    if (!f) {
      problems.push(t('{0}: thiếu', path));
      continue;
    }
    const b: Uint8Array = await f.async('uint8array');
    if ((await sha256Hex(b)) !== hash) problems.push(t('{0}: mã kiểm tra không khớp', path));
    blobs.set(path.slice(6, -4), b);
  }
  for (const r of stores.blobs ?? []) if (!blobs.has(r.id)) problems.push(t('Tệp đính kèm {0} không có dữ liệu', r.name ?? r.id));
  return { manifest, data: { stores, blobs }, integrityOk: problems.length === 0, problems };
}

/** Extract one journey's records (+ its blobs). */
export function sliceJourney(data: Dataset, journeyId: string): Dataset {
  const stores: Records = {};
  for (const s of STORES) {
    if (s === 'settings' || s === 'world') continue;
    stores[s] = (data.stores[s] ?? []).filter((r: any) => (s === 'journeys' ? r.id === journeyId : r.journeyId === journeyId));
  }
  const blobIds = new Set((stores.blobs ?? []).map((b: any) => b.id));
  return { stores, blobs: new Map([...data.blobs].filter(([id]) => blobIds.has(id))) };
}

/** Give every record (and blob) of a journey slice new ids, rewriting references, so it can be added as a NEW journey. */
export function remapAsNew(slice: Dataset, titleSuffix = t(' (khôi phục)')): Dataset {
  const map = new Map<string, string>();
  for (const s of STORES) for (const r of slice.stores[s] ?? []) if (r && typeof r.id === 'string') map.set(r.id, uid(s.slice(0, 2)));
  // weather is keyed by journeyId
  const walk = (v: any): any => {
    if (typeof v === 'string') return map.get(v) ?? v;
    if (Array.isArray(v)) return v.map(walk);
    if (v && typeof v === 'object' && !(v instanceof Uint8Array) && !(v instanceof ArrayBuffer)) {
      const o: any = {};
      for (const [k, val] of Object.entries(v)) o[k] = k === 'encrypted' || k === 'details' && typeof val === 'string' && val.startsWith('{"iv"') ? val : walk(val);
      return o;
    }
    return v;
  };
  const stores: Records = {};
  for (const s of STORES) if (slice.stores[s]) stores[s] = slice.stores[s]!.map(walk);
  for (const j of stores.journeys ?? []) {
    j.title = j.title + titleSuffix;
    j.seedKey = undefined;
    j.pinned = false;
  }
  const blobs = new Map<string, Uint8Array>();
  for (const [id, b] of slice.blobs) blobs.set(map.get(id) ?? id, b);
  return { stores, blobs };
}
