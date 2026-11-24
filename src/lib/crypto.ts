// Real encryption with Web Crypto: PBKDF2-SHA256 → AES-GCM-256.
// The passphrase is never stored. Only a salt and an encrypted verifier are kept.

export const PBKDF2_ITERATIONS = 310_000;
const VERIFIER_TEXT = 'chang-vault-ok';

export const b64 = {
  enc(buf: ArrayBuffer | Uint8Array): string {
    const u = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
    let s = '';
    for (let i = 0; i < u.length; i += 0x8000) s += String.fromCharCode(...u.subarray(i, i + 0x8000));
    return btoa(s);
  },
  dec(s: string): Uint8Array {
    const bin = atob(s);
    const u = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i);
    return u;
  },
};

export function randomBytes(n: number): Uint8Array {
  const u = new Uint8Array(n);
  crypto.getRandomValues(u);
  return u;
}

export async function deriveKey(passphrase: string, salt: Uint8Array, iterations = PBKDF2_ITERATIONS): Promise<CryptoKey> {
  const base = await crypto.subtle.importKey('raw', new TextEncoder().encode(passphrase), 'PBKDF2', false, ['deriveKey']);
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt: salt as BufferSource, iterations, hash: 'SHA-256' },
    base,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  );
}

export async function encryptBytes(key: CryptoKey, data: ArrayBuffer | Uint8Array): Promise<{ iv: string; data: ArrayBuffer }> {
  const iv = randomBytes(12);
  const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv: iv as BufferSource }, key, data as BufferSource);
  return { iv: b64.enc(iv), data: ct };
}
export async function decryptBytes(key: CryptoKey, iv: string, data: ArrayBuffer | Uint8Array): Promise<ArrayBuffer> {
  return crypto.subtle.decrypt({ name: 'AES-GCM', iv: b64.dec(iv) as BufferSource }, key, data as BufferSource);
}
export async function encryptJson(key: CryptoKey, value: unknown): Promise<{ iv: string; data: string }> {
  const r = await encryptBytes(key, new TextEncoder().encode(JSON.stringify(value)));
  return { iv: r.iv, data: b64.enc(r.data) };
}
export async function decryptJson<T>(key: CryptoKey, box: { iv: string; data: string }): Promise<T> {
  const pt = await decryptBytes(key, box.iv, b64.dec(box.data));
  return JSON.parse(new TextDecoder().decode(pt)) as T;
}

export async function createVerifier(key: CryptoKey) {
  return encryptJson(key, VERIFIER_TEXT);
}
export async function checkVerifier(key: CryptoKey, box: { iv: string; data: string }): Promise<boolean> {
  try {
    return (await decryptJson<string>(key, box)) === VERIFIER_TEXT;
  } catch {
    return false;
  }
}

export async function sha256Hex(data: ArrayBuffer | Uint8Array): Promise<string> {
  const h = await crypto.subtle.digest('SHA-256', data as BufferSource);
  return Array.from(new Uint8Array(h)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

// Encrypted backup container: "CHANGENC1" | salt(16) | iv(12) | ciphertext
const MAGIC = new TextEncoder().encode('CHANGENC1');
export async function sealBackup(passphrase: string, zip: Uint8Array): Promise<Uint8Array> {
  const salt = randomBytes(16);
  const key = await deriveKey(passphrase, salt);
  const iv = randomBytes(12);
  const ct = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv: iv as BufferSource }, key, zip as BufferSource));
  const out = new Uint8Array(MAGIC.length + 16 + 12 + ct.length);
  out.set(MAGIC, 0);
  out.set(salt, MAGIC.length);
  out.set(iv, MAGIC.length + 16);
  out.set(ct, MAGIC.length + 28);
  return out;
}
export function isSealed(bytes: Uint8Array): boolean {
  return MAGIC.every((b, i) => bytes[i] === b);
}
export async function openSealed(passphrase: string, bytes: Uint8Array): Promise<Uint8Array> {
  const salt = bytes.slice(MAGIC.length, MAGIC.length + 16);
  const iv = bytes.slice(MAGIC.length + 16, MAGIC.length + 28);
  const key = await deriveKey(passphrase, salt);
  return new Uint8Array(await crypto.subtle.decrypt({ name: 'AES-GCM', iv: iv as BufferSource }, key, bytes.slice(MAGIC.length + 28) as BufferSource));
}
