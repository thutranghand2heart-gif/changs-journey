// Artwork manager: Chang's Christmas Collection lives ONLY on the device (IndexedDB), imported from a private pack.
// Nothing here is bundled into the public app. Each asset keeps its original file plus optional display/thumb/mask
// versions; a user replacement keeps the pack version so "restore default" works.
import JSZip from 'jszip';
import * as db from '../db/idb';
import type { BlobRecord } from '../db/schema';
import { uid, nowIso } from './util';
import { tr } from './i18n';

export type ArtGroup = 'tree' | 'globe' | 'icon' | 'cover' | 'page' | 'frame' | 'postcard' | 'charm';
export type ArtVariant = 'orig' | 'disp' | 'thumb' | 'mask';
export interface ArtFiles { orig: string; disp?: string; thumb?: string; mask?: string } // blob ids
export interface ArtAsset {
  id: string;
  name: string;
  group: ArtGroup;
  theme: string;
  placement: string;
  width: number;
  height: number;
  aspect: number;
  alpha: boolean;
  privacy: 'private-local';
  source: 'pack' | 'custom';
  files: ArtFiles;
  packFiles?: ArtFiles; // kept when replaced by a custom image → restore default
  hole?: [number, number, number, number]; // frames: inner opening (relative)
  textBox?: [number, number, number, number]; // postcards: writing area (relative)
  safe?: [number, number, number, number]; // storybook page: text-safe area (relative)
  glass?: [number, number, number]; // snow globe: cx, cy (relative to W/H), r (relative to W)
  note?: string;
  importedAt: string;
}
export interface ArtworkState { id: 'artwork'; assets: Record<string, ArtAsset>; packVersion?: number; importedAt?: string }

export const GROUP_LABEL: Record<ArtGroup, string> = {
  tree: tr('Cây thông'),
  globe: tr('Quả cầu tuyết'),
  icon: tr('Biểu tượng'),
  cover: tr('Bìa nhật ký'),
  page: tr('Trang nhật ký'),
  frame: tr('Khung ảnh'),
  postcard: tr('Bưu thiếp'),
  charm: tr('Sticker trang trí'),
};
export const ART_OWNER = 'artwork'; // blob journeyId marker (global, not tied to one journey)

let cache: ArtworkState | null = null;
export async function getArtwork(): Promise<ArtworkState> {
  if (cache) return cache;
  const s = (await db.get<any>('settings', 'artwork')) as ArtworkState | undefined;
  cache = s ?? { id: 'artwork', assets: {} };
  return cache;
}
async function saveArtwork(s: ArtworkState) {
  cache = s;
  await db.put('settings', s as any);
}
db.onChange(() => (cache = null));

async function putBlob(data: ArrayBuffer, mime: string, name: string): Promise<string> {
  const rec: BlobRecord = { id: uid('b'), journeyId: ART_OWNER, mime, name, size: data.byteLength, data, createdAt: nowIso() };
  await db.put('blobs', rec, true);
  return rec.id;
}
const mimeOf = (p: string) => (p.endsWith('.webp') ? 'image/webp' : p.endsWith('.png') ? 'image/png' : p.endsWith('.jpg') || p.endsWith('.jpeg') ? 'image/jpeg' : 'application/octet-stream');

async function sha256(buf: ArrayBuffer) {
  const h = await crypto.subtle.digest('SHA-256', buf);
  return [...new Uint8Array(h)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

export interface PackResult { added: number; updated: number; keptCustom: number; failed: string[] }

/** Import the private artwork pack (.zip). Verifies every file's SHA-256; keeps user replacements (custom) as they are. */
export async function importArtworkPack(file: Blob, onProgress?: (done: number, total: number) => void): Promise<PackResult> {
  const zip = await JSZip.loadAsync(await file.arrayBuffer());
  const manFile = zip.file('manifest.json');
  if (!manFile) throw new Error(tr('Tệp này không phải gói artwork của ứng dụng.'));
  const man = JSON.parse(await manFile.async('string'));
  if (man.format !== 'chang-artwork-pack' || !Array.isArray(man.assets)) throw new Error(tr('Tệp này không phải gói artwork của ứng dụng.'));
  const state = await getArtwork();
  const next: ArtworkState = { ...state, assets: { ...state.assets }, packVersion: man.version, importedAt: nowIso() };
  const res: PackResult = { added: 0, updated: 0, keptCustom: 0, failed: [] };
  const oldPackBlobs: string[] = [];
  let i = 0;
  for (const a of man.assets) {
    onProgress?.(i++, man.assets.length);
    try {
      const files: ArtFiles = { orig: '' };
      for (const [variant, path] of Object.entries(a.files as Record<string, string>)) {
        const f = zip.file(path);
        if (!f) throw new Error('missing ' + path);
        const buf: ArrayBuffer = await f.async('arraybuffer');
        if (a.sha256?.[variant] && (await sha256(buf)) !== a.sha256[variant]) throw new Error('checksum ' + path);
        (files as any)[variant] = await putBlob(buf, mimeOf(path), path.split('/').pop()!);
      }
      const prev = next.assets[a.id];
      const base: ArtAsset = {
        id: a.id, name: a.name, group: a.group, theme: a.theme, placement: a.placement, width: a.width, height: a.height, aspect: a.aspect,
        alpha: !!a.alpha, privacy: 'private-local', source: 'pack', files, hole: a.hole, textBox: a.textBox, safe: a.safe, glass: a.glass, note: a.note, importedAt: nowIso(),
      };
      if (prev?.source === 'custom') {
        if (prev.packFiles) oldPackBlobs.push(...Object.values(prev.packFiles));
        next.assets[a.id] = { ...prev, packFiles: files };
        res.keptCustom++;
      } else {
        if (prev) oldPackBlobs.push(...Object.values(prev.files));
        next.assets[a.id] = base;
        prev ? res.updated++ : res.added++;
      }
    } catch (e) {
      res.failed.push(`${a.id}: ${(e as Error).message}`);
    }
  }
  await saveArtwork(next);
  for (const id of oldPackBlobs) if (id) await db.del('blobs', id);
  onProgress?.(man.assets.length, man.assets.length);
  db.notify();
  return res;
}

/** Replace one asset with the user's own image (the original pack version is kept for "restore default"). */
export async function replaceAsset(id: string, file: File) {
  const s = await getArtwork();
  const a = s.assets[id];
  if (!a) return;
  const img = await createImageBitmap(file);
  const blobId = await putBlob(await file.arrayBuffer(), file.type || 'image/png', file.name);
  if (a.source === 'custom') for (const b of Object.values(a.files)) if (b) await db.del('blobs', b);
  s.assets[id] = { ...a, source: 'custom', files: { orig: blobId, mask: a.packFiles?.mask ?? a.files.mask }, packFiles: a.packFiles ?? a.files, width: img.width, height: img.height, aspect: +(img.width / img.height).toFixed(4) };
  img.close?.();
  await saveArtwork(s);
  db.notify();
}
export async function restoreDefault(id: string) {
  const s = await getArtwork();
  const a = s.assets[id];
  if (!a || a.source !== 'custom' || !a.packFiles) return;
  for (const [k, b] of Object.entries(a.files)) if (b && b !== a.packFiles[k as ArtVariant]) await db.del('blobs', b);
  s.assets[id] = { ...a, source: 'pack', files: a.packFiles, packFiles: undefined };
  await saveArtwork(s);
  db.notify();
}
export async function removeAllArtwork() {
  const s = await getArtwork();
  for (const a of Object.values(s.assets)) for (const b of [...Object.values(a.files), ...Object.values(a.packFiles ?? {})]) if (b) await db.del('blobs', b);
  await saveArtwork({ id: 'artwork', assets: {} });
  db.notify();
}

/** Best blob id for a use: display version when present, else the original. */
export function artBlob(a: ArtAsset | undefined, v: ArtVariant = 'disp'): string | undefined {
  if (!a) return undefined;
  if (v === 'mask') return a.files.mask;
  if (v === 'thumb') return a.files.thumb ?? a.files.disp ?? a.files.orig;
  if (v === 'disp') return a.files.disp ?? a.files.orig;
  return a.files.orig;
}
