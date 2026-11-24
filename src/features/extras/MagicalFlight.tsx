import { createPortal } from 'react-dom';
import { useEffect, useRef, useState } from 'react';
import { useBlobUrl } from '../../ui/core';
import { t } from '../../lib/i18n';

/**
 * V1.3 Chang's Magical Flight — the personal countdown sticker (never a default Santa) flies across the WHOLE viewport:
 * several passes left↔right, a loop, a figure-8, altitude changes, near/far scaling, gold star-dust trail.
 * The artwork itself is never altered: only CSS transforms (position, scale, a slight tilt, and a horizontal mirror
 * so the sleigh faces where it is flying).
 */

// Waypoints in viewport units (x 0..1, y 0..1) with depth z (0 far … 1 near). Off-screen x lets it fly in/out.
type Pt = [number, number, number];
const loop = (cx: number, cy: number, r: number, z: number, n = 8, start = 0, dir = 1): Pt[] =>
  Array.from({ length: n }, (_, i) => { const a = start + dir * (i / n) * Math.PI * 2; return [cx + Math.cos(a) * r * 0.85, cy + Math.sin(a) * r, z] as Pt; });
const eight = (cx: number, cy: number, rx: number, ry: number, z: number, n = 14): Pt[] =>
  Array.from({ length: n }, (_, i) => { const a = (i / n) * Math.PI * 2; return [cx + Math.sin(a) * rx, cy + Math.sin(2 * a) * ry, z + 0.25 * Math.cos(a)] as Pt; });
export const FLIGHT: Pt[] = [
  [-0.45, 0.22, 0.55],
  [0.25, 0.16, 0.6],
  [0.6, 0.26, 0.7],
  ...loop(0.72, 0.36, 0.14, 0.8, 8, -Math.PI / 2, 1), // a full loop on the right
  [0.95, 0.3, 0.75],
  [1.4, 0.4, 0.5], // out to the right
  [1.3, 0.62, 0.35], // turn around off-screen, lower and farther
  [0.7, 0.66, 0.4],
  [0.3, 0.58, 0.55],
  ...eight(0.5, 0.45, 0.32, 0.12, 0.65), // figure-8 in the middle
  [0.15, 0.4, 0.8],
  [-0.4, 0.3, 0.95], // out to the left, close
  [-0.35, 0.12, 0.45], // around, high and far
  [0.4, 0.08, 0.5],
  [0.8, 0.18, 0.65],
  [1.45, 0.24, 0.6], // final exit right
];

function catmull(p0: number, p1: number, p2: number, p3: number, u: number) {
  const u2 = u * u, u3 = u2 * u;
  return 0.5 * (2 * p1 + (-p0 + p2) * u + (2 * p0 - 5 * p1 + 4 * p2 - p3) * u2 + (-p0 + 3 * p1 - 3 * p2 + p3) * u3);
}
/** Position on the path at s ∈ [0, 1] (closed = continuous mode, wraps around). */
export function flightAt(s: number, closed: boolean): Pt {
  const P = FLIGHT;
  const n = closed ? P.length : P.length - 1;
  const f = Math.min(n - 1e-6, Math.max(0, s * n));
  const i = Math.floor(f), u = f - i;
  const at = (k: number) => (closed ? P[(k + P.length) % P.length] : P[Math.min(P.length - 1, Math.max(0, k))]);
  const a = at(i - 1), b = at(i), c = at(i + 1), d = at(i + 2);
  return [catmull(a[0], b[0], c[0], d[0], u), catmull(a[1], b[1], c[1], d[1], u), catmull(a[2], b[2], c[2], d[2], u)];
}

export function MagicalFlight({ blobId, mode, onEnd }: { blobId?: string; mode: 'once' | 'loop'; onEnd: () => void }) {
  const { url } = useBlobUrl(blobId);
  const el = useRef<HTMLDivElement | null>(null);
  const cv = useRef<HTMLCanvasElement | null>(null);
  const [aspect, setAspect] = useState(2.7);

  useEffect(() => {
    if (!url) return;
    const node = el.current, c = cv.current;
    if (!node || !c) return;
    const ctx = c.getContext('2d')!;
    const dpr = Math.min(2, devicePixelRatio || 1);
    let W = innerWidth, H = innerHeight;
    const fit = () => { W = innerWidth; H = innerHeight; c.width = W * dpr; c.height = H * dpr; ctx.setTransform(dpr, 0, 0, dpr, 0, 0); };
    fit();
    addEventListener('resize', fit);
    const DUR = 26000; // one full flight
    const t0 = performance.now();
    let prev = flightAt(0, mode === 'loop');
    let face = 1;
    type Dust = { x: number; y: number; vx: number; vy: number; life: number; r: number };
    const dust: Dust[] = [];
    let raf = 0;
    const frame = (now: number) => {
      const el2 = now - t0;
      let s = el2 / DUR;
      if (mode === 'once' && s >= 1) { onEnd(); return; }
      s = s % 1;
      const p = flightAt(s, mode === 'loop');
      const baseW = Math.min(300, Math.max(170, W * 0.5));
      const scale = 0.5 + p[2] * 0.6; // near/far
      const w = baseW * scale, h = w / aspect;
      const x = p[0] * W, y = p[1] * H;
      const vx = x - prev[0] * W, vy = y - prev[1] * H;
      if (Math.abs(vx) > 0.4) face = vx >= 0 ? 1 : -1; // turn naturally with the direction of travel (hysteresis)
      const tilt = Math.max(-16, Math.min(16, (Math.atan2(vy, Math.abs(vx) + 0.001) * 180) / Math.PI));
      node.style.transform = `translate3d(${x - w / 2}px, ${y - h / 2}px, 0) rotate(${tilt * face}deg) scaleX(${face})`;
      node.style.width = `${w}px`;
      node.style.height = `${h}px`;
      node.style.zIndex = p[2] > 0.7 ? '2602' : '2600';
      node.style.filter = `drop-shadow(0 ${4 + p[2] * 8}px ${6 + p[2] * 10}px rgba(0,0,0,${0.25 + p[2] * 0.2})) brightness(${0.85 + p[2] * 0.15})`;
      prev = p;
      // star dust from behind the sleigh
      const tailX = x - face * w * 0.42, tailY = y + h * 0.12;
      for (let k = 0; k < 2; k++) dust.push({ x: tailX + (Math.random() - 0.5) * 10, y: tailY + (Math.random() - 0.5) * h * 0.35, vx: -face * (0.3 + Math.random() * 0.8), vy: 0.15 + Math.random() * 0.5, life: 1, r: (1.5 + Math.random() * 2.8) * scale });
      ctx.clearRect(0, 0, W, H);
      for (let i = dust.length - 1; i >= 0; i--) {
        const d = dust[i];
        d.life -= 0.018;
        if (d.life <= 0) { dust.splice(i, 1); continue; }
        d.x += d.vx;
        d.y += d.vy;
        ctx.globalAlpha = d.life * 0.9;
        const g = ctx.createRadialGradient(d.x, d.y, 0, d.x, d.y, d.r * 2.2);
        g.addColorStop(0, '#fff8e0');
        g.addColorStop(0.4, '#f0d28a');
        g.addColorStop(1, 'rgba(213,180,119,0)');
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(d.x, d.y, d.r * 2.2, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => { cancelAnimationFrame(raf); removeEventListener('resize', fit); };
  }, [url, mode, aspect]);

  if (!url) return null;
  return createPortal(
    <div className="flight-layer" aria-hidden="true" data-testid="magical-flight" data-mode={mode}>
      <canvas ref={cv} className="flight-dust" />
      <div ref={el} className="flight-sleigh">
        <img src={url} alt="" draggable={false} onLoad={(e: any) => e.target.naturalWidth && setAspect(e.target.naturalWidth / e.target.naturalHeight)} />
      </div>
      <button className="btn flight-stop" data-testid="flight-stop" onClick={onEnd} style={{ pointerEvents: 'auto' }}>{t('Dừng bay')}</button>
    </div>,
    document.body,
  );
}
