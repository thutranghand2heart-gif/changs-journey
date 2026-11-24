// Private Travel Vault. Private memories/documents are ENCRYPTED at rest with
// AES-GCM; the key exists only in memory while unlocked. This is real encryption,
// but it cannot protect against someone who has your unlocked phone and app open.
import * as db from '../db/idb';
import type { BlobRecord, Memory, WalletDoc } from '../db/schema';
import { getSettings, saveSettings } from '../db/repo';
import { b64, checkVerifier, createVerifier, decryptBytes, decryptJson, deriveKey, encryptBytes, encryptJson, PBKDF2_ITERATIONS, randomBytes } from './crypto';
import { nowIso } from './util';

let key: CryptoKey | null = null;
const subs = new Set<() => void>();
export const vaultUnlocked = () => key !== null;
export const onVault = (f: () => void) => (subs.add(f), () => subs.delete(f));
const emit = () => subs.forEach((f) => f());

export async function vaultConfigured(): Promise<boolean> {
  return !!(await getSettings()).vault;
}
export async function setupVault(passphrase: string) {
  if (passphrase.length < 6) throw new Error('Mật khẩu cần ít nhất 6 ký tự.');
  if (await vaultConfigured()) throw new Error('Két đã được thiết lập.');
  const salt = randomBytes(16);
  const k = await deriveKey(passphrase, salt);
  await saveSettings({ vault: { salt: b64.enc(salt), verifier: await createVerifier(k), iterations: PBKDF2_ITERATIONS, createdAt: nowIso() } });
  key = k;
  emit();
}
export async function unlockVault(passphrase: string): Promise<boolean> {
  const s = await getSettings();
  if (!s.vault) return false;
  const k = await deriveKey(passphrase, b64.dec(s.vault.salt), s.vault.iterations);
  if (!(await checkVerifier(k, s.vault.verifier))) return false;
  key = k;
  emit();
  return true;
}
export function lockVault() {
  key = null;
  emit();
}
function need(): CryptoKey {
  if (!key) throw new Error('Két riêng tư đang khóa.');
  return key;
}

interface MemorySecret { title: string; body: string }

/** Encrypts a memory's text and its photos. Plain fields are blanked. */
export async function makeMemoryPrivate(m: Memory): Promise<Memory> {
  const k = need();
  for (const id of m.photoBlobIds) await encryptBlob(id);
  const box = await encryptJson(k, { title: m.title, body: m.body } satisfies MemorySecret);
  return { ...m, privacy: 'private', encrypted: box, title: '', body: '' };
}
export async function readPrivateMemory(m: Memory): Promise<MemorySecret> {
  if (!m.encrypted) return { title: m.title, body: m.body };
  return decryptJson<MemorySecret>(need(), m.encrypted);
}
export async function saveEncryptedMemory(m: Memory, secret: MemorySecret): Promise<Memory> {
  const box = await encryptJson(need(), secret);
  return { ...m, privacy: 'private', encrypted: box, title: '', body: '', updatedAt: nowIso() };
}
export async function makeMemoryPublic(m: Memory): Promise<Memory> {
  const s = await readPrivateMemory(m);
  for (const id of m.photoBlobIds) await decryptBlobInPlace(id);
  return { ...m, privacy: 'normal', encrypted: undefined, title: s.title, body: s.body, updatedAt: nowIso() };
}

export async function encryptBlob(id: string) {
  const rec = await db.get<BlobRecord>('blobs', id);
  if (!rec || rec.encrypted) return;
  const plain = rec.data instanceof Blob ? await rec.data.arrayBuffer() : rec.data;
  const r = await encryptBytes(need(), plain);
  await db.put('blobs', { ...rec, data: r.data, encrypted: { iv: r.iv } }, true);
}
async function decryptBlobInPlace(id: string) {
  const rec = await db.get<BlobRecord>('blobs', id);
  if (!rec || !rec.encrypted) return;
  const pt = await decryptBytes(need(), rec.encrypted.iv, rec.data as ArrayBuffer);
  await db.put('blobs', { ...rec, data: pt, encrypted: undefined }, true);
}
/** Decrypt for display only (does not persist plaintext). */
export async function readEncryptedBlob(id: string): Promise<Blob | null> {
  const rec = await db.get<BlobRecord>('blobs', id);
  if (!rec) return null;
  if (!rec.encrypted) return rec.data instanceof Blob ? rec.data : new Blob([rec.data], { type: rec.mime });
  const pt = await decryptBytes(need(), rec.encrypted.iv, rec.data as ArrayBuffer);
  return new Blob([pt], { type: rec.mime });
}

export async function makeDocPrivate(d: WalletDoc): Promise<WalletDoc> {
  const k = need();
  if (d.blobId) await encryptBlob(d.blobId);
  const box = await encryptJson(k, { title: d.title, details: d.details });
  return { ...d, privacy: 'private', encrypted: true, title: '', details: JSON.stringify(box) };
}
export async function readPrivateDoc(d: WalletDoc): Promise<{ title: string; details: string }> {
  if (!d.encrypted) return { title: d.title, details: d.details };
  return decryptJson(need(), JSON.parse(d.details));
}
