// Privacy & secrets guard. Fails if anything personal or secret would be published.
//   node scripts/check-repo.mjs              → checks repository files
//   node scripts/check-repo.mjs --dist dist  → also checks the build output (deployment artifact)
//
// Personal journeys, tickets, QR codes, photos and passwords live ONLY in the phone's
// IndexedDB or in the user's private .changjourney.json file — never in this repository.
//
// Layer 4 (private itinerary fingerprints) needs the private key:
//   PRIVACY_GUARD_KEY=<key>  or  PRIVACY_GUARD_KEY_FILE=<path>
// The repo stores only keyed hashes (privacy-fingerprints.json), which reveal nothing without the key.
import { execSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const args = process.argv.slice(2);
const distDir = args.includes('--dist') ? args[args.indexOf('--dist') + 1] : null;
const problems = [];
const notes = [];

const repoFiles = execSync('git ls-files -co --exclude-standard', { encoding: 'utf8' }).split('\n').filter(Boolean).filter((f) => existsSync(f) && statSync(f).isFile());
const walk = (d) => readdirSync(d, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(join(d, e.name)) : [join(d, e.name)]));
const distFiles = distDir && existsSync(distDir) ? walk(distDir) : [];
const files = [...repoFiles, ...distFiles];

function decodeEscapes(t) {
  return t
    .replace(/\\u\{([0-9a-fA-F]{1,6})\}/g, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/\\u([0-9a-fA-F]{4})/g, (_, h) => String.fromCharCode(parseInt(h, 16)))
    .replace(/\\x([0-9a-fA-F]{2})/g, (_, h) => String.fromCharCode(parseInt(h, 16)));
}
const SELF = new Set(['scripts/check-repo.mjs', 'privacy-fingerprints.json']);
const allowedBinary = [/^public\/icons\//, /^tests\/fixtures\/ticket\.(png|pdf|svg)$/, /^dist\/icons\//]; // generated artwork + synthetic test ticket
const allowedImportFile = /^tests\/fixtures\/demo-[\w-]+\.changjourney\.json$/; // fictional demo journey
const binary = /\.(png|jpe?g|heic|heif|webp|gif|pdf|mov|mp4|m4a|zip|changbackup|sqlite|db)$/i;
const secretPatterns = [
  [/ghp_[A-Za-z0-9]{30,}|github_pat_[A-Za-z0-9_]{40,}/, 'GitHub token'],
  [/AKIA[0-9A-Z]{16}/, 'AWS key'],
  [/-----BEGIN [A-Z ]*PRIVATE KEY-----/, 'private key'],
  [/AIza[0-9A-Za-z_\-]{35}/, 'Google API key'],
  [/\bsk-[A-Za-z0-9]{32,}/, 'API secret key'],
];
// Chinese street address with house number (e.g. "…路12号"); fictional demo addresses start with 演示.
const zhAddress = /(?<!演示[一-鿿]{0,6})[一-鿿]{1,8}(?:路|街|道|大道)\d{1,5}号/;

// ── fingerprints (layer 4)
let key = process.env.PRIVACY_GUARD_KEY?.trim();
if (!key && process.env.PRIVACY_GUARD_KEY_FILE && existsSync(process.env.PRIVACY_GUARD_KEY_FILE)) key = readFileSync(process.env.PRIVACY_GUARD_KEY_FILE, 'utf8').trim();
const fp = existsSync('privacy-fingerprints.json') ? JSON.parse(readFileSync('privacy-fingerprints.json', 'utf8')) : null;
const fpSet = fp ? new Set(fp.hmacs) : null;
const fingerprintHit = (text) => {
  for (const L of fp.lengths) for (let i = 0; i + L <= text.length; i++) if (fpSet.has(createHash('sha256').update(key + '\0' + text.slice(i, i + L), 'utf8').digest('hex'))) return i;
  return -1;
};

for (const f of files) {
  const rel = f.replace(/\\/g, '/');
  if (/(^|\/)\.env(\.|$)/.test(rel)) problems.push(`${rel}: environment file`);
  if (/\.changjourney(\.json)?$/i.test(rel) && !allowedImportFile.test(rel)) problems.push(`${rel}: private journey import file must never be committed or deployed`);
  if (binary.test(rel)) {
    const inDistIcons = distDir && rel.startsWith(distDir.replace(/\/$/, '') + '/icons/') && /\.(png|svg)$/.test(rel);
    if (!inDistIcons && !allowedBinary.some((r) => r.test(rel))) problems.push(`${rel}: personal media/document files must not be committed or deployed`);
    continue;
  }
  if (statSync(f).size > 5_000_000 || SELF.has(rel)) continue;
  // Build tools write non-ASCII as \uXXXX / \u{…} / \xNN escapes — decode so Chinese & Vietnamese text is visible to every check.
  const text = decodeEscapes(readFileSync(f, 'utf8'));
  for (const [re, label] of secretPatterns) if (re.test(text)) problems.push(`${rel}: looks like a ${label}`);
  if (/"format"\s*:\s*"chang-journey-import"/.test(text) && !allowedImportFile.test(rel)) problems.push(`${rel}: contains a journey import file`);
  const addr = text.match(zhAddress);
  if (addr && !/^tests\/fixtures\/demo/.test(rel)) problems.push(`${rel}: contains a Chinese street address (${addr[0].length} chars) — keep real addresses in your private journey file`);
  if (key && fp) {
    const at = fingerprintHit(text);
    if (at >= 0) problems.push(`${rel}: contains private itinerary text (offset ${at}) — move it to the private journey file`);
  }
}

// ── deployment artifact must not cache anything except the app shell
if (distDir) {
  const sw = readFileSync(join(distDir, 'sw.js'), 'utf8');
  const shell = sw.match(/const SHELL = \[([^\]]*)\]/)?.[1] ?? '';
  for (const u of shell.split(',').map((s) => s.trim().replace(/^'|'$/g, '')).filter(Boolean))
    if (!/^\.\/(|index\.html|app\.js|app\.css|manifest\.webmanifest|icons\/[\w.-]+\.(png|svg))$/.test(u)) problems.push(`dist/sw.js: unexpected precached asset ${u}`);
  if (!distFiles.length) problems.push(`${distDir}: build output missing`);
}

if (!key) notes.push('Private itinerary fingerprint check SKIPPED (no PRIVACY_GUARD_KEY). Other layers ran.');
else notes.push(`Private itinerary fingerprint check ran (${fp?.hmacs.length ?? 0} fingerprints).`);
for (const n of notes) console.log('ℹ︎', n);
if (problems.length) {
  console.error('Privacy/secret check FAILED:\n' + problems.map((p) => '  ✘ ' + p).join('\n'));
  process.exit(1);
}
console.log(`Privacy/secret check passed (${repoFiles.length} repo files${distDir ? ` + ${distFiles.length} build files` : ''}).`);
