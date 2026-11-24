/** @jsxRuntime automatic */
// Renders the approved 22A icon (single source: src/art/BookMark.tsx) to SVG, then PNG via rsvg-convert.
import { renderToStaticMarkup } from 'react-dom/server';
import { writeFileSync, mkdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { IconArt } from '../src/art/BookMark';

const out = process.argv[2] ?? 'public/icons';
mkdirSync(out, { recursive: true });
const svg = (inner: string, vb = '0 0 512 512') => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${vb}" width="512" height="512">${inner}</svg>`;
const icon = svg(renderToStaticMarkup(<IconArt />));
writeFileSync(`${out}/icon.svg`, icon);
// maskable: same art scaled into the 80% safe zone on the emerald field
const mask = svg(`<rect width="512" height="512" fill="#103B31"/><g transform="translate(51.2 51.2) scale(0.8)">${renderToStaticMarkup(<IconArt />)}</g>`);
writeFileSync(`${out}/icon-maskable.svg`, mask);

const png = (src: string, size: number, name: string) => execFileSync('rsvg-convert', ['-w', String(size), '-h', String(size), '-o', `${out}/${name}`, `${out}/${src}`]);
png('icon.svg', 192, 'icon-192.png');
png('icon.svg', 512, 'icon-512.png');
png('icon.svg', 180, 'apple-touch-icon.png');
png('icon-maskable.svg', 512, 'icon-maskable-512.png');

// Christmas journey emblem (separate from the global icon): Christmas tree + city skyline + travel diary.
const emblem = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" width="256" height="256">
<defs><linearGradient id="e-t" x1="0" x2="1"><stop offset="0" stop-color="#2f7a5f"/><stop offset="1" stop-color="#0d3a2d"/></linearGradient></defs>
<rect width="256" height="256" rx="56" fill="#103B31"/>
<g fill="#D5B477" opacity="0.55">
<rect x="30" y="128" width="12" height="52"/><rect x="46" y="112" width="9" height="68"/>
<path d="M190 180 L190 104 L194 88 L198 64 L202 88 L206 104 L206 180 Z"/><circle cx="198" cy="112" r="6"/><circle cx="198" cy="92" r="3.5"/>
<path d="M214 180 L214 110 L221 98 L228 110 L228 180 Z"/></g>
<path d="M128 40 L168 104 L152 104 L180 146 L160 146 L190 184 L66 184 L96 146 L76 146 L104 104 L88 104 Z" fill="url(#e-t)" stroke="#D5B477" stroke-width="2"/>
<path d="M128 26 l5 12 13 1 -10 8 3 13 -11 -7 -11 7 3 -13 -10 -8 13 -1 z" fill="#D5B477"/>
<circle cx="112" cy="128" r="5" fill="#8B1E2D"/><circle cx="146" cy="160" r="5" fill="#D5B477"/><circle cx="124" cy="170" r="4" fill="#FFF8EE"/><circle cx="138" cy="118" r="4" fill="#D5B477"/>
<path d="M60 196 L128 188 L196 196 L196 222 L128 214 L60 222 Z" fill="#FFF8EE"/><path d="M128 188 L128 214" stroke="#cdb994" stroke-width="2"/>
<path d="M60 196 L128 188 L196 196" fill="none" stroke="#D5B477" stroke-width="2"/>
</svg>`;
writeFileSync(`${out}/xmas-skyline-emblem.svg`, emblem);
console.log('icons written to', out);
