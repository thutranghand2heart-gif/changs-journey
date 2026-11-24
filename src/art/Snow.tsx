import { useEffect, useRef, useState } from 'react';

/**
 * V1.3 Celestial sky — one fixed canvas behind the content:
 *  • snow in three depth layers (far: tiny, faint, slow · mid · near: larger, clearer, faster), soft-edged sprites;
 *  • shooting stars across the whole background, at varied angles and lengths;
 *  • twinkling, slowly drifting gold star dust.
 * Density and speed are user settings (localStorage, per device). Pauses when the tab is hidden; uses a fixed-size
 * particle pool and pre-rendered sprites so scrolling stays smooth.
 */
export interface SkySettings { density: number; speed: number; stars: boolean; dust: boolean }
export const SKY_DEFAULT: SkySettings = { density: 1, speed: 1, stars: true, dust: true };
const KEY = 'chang-sky';
export function readSky(): SkySettings {
  try { return { ...SKY_DEFAULT, ...JSON.parse(localStorage.getItem(KEY) ?? '{}') }; } catch { return SKY_DEFAULT; }
}
export function writeSky(v: SkySettings) {
  try { localStorage.setItem(KEY, JSON.stringify(v)); } catch { /* */ }
  dispatchEvent(new Event('chang-sky'));
}
export function useSky(): SkySettings {
  const [s, setS] = useState(readSky);
  useEffect(() => {
    const h = () => setS(readSky());
    addEventListener('chang-sky', h);
    return () => removeEventListener('chang-sky', h);
  }, []);
  return s;
}

function sprite(color: string, size = 16) {
  const c = document.createElement('canvas');
  c.width = c.height = size * 2;
  const x = c.getContext('2d')!;
  const g = x.createRadialGradient(size, size, 0, size, size, size);
  g.addColorStop(0, `rgba(${color},1)`);
  g.addColorStop(0.35, `rgba(${color},0.75)`);
  g.addColorStop(1, `rgba(${color},0)`);
  x.fillStyle = g;
  x.fillRect(0, 0, size * 2, size * 2);
  return c;
}

export function Snow({ density = 1, gold = true, burst = 0, stars = true }: { density?: number; gold?: boolean; burst?: number; stars?: boolean }) {
  const ref = useRef<HTMLCanvasElement | null>(null);
  const sky = useSky();
  useEffect(() => {
    const c = ref.current;
    if (!c) return;
    const ctx = c.getContext('2d');
    if (!ctx) return;
    let w = 0;
    let h = 0;
    const dpr = Math.min(2, devicePixelRatio || 1);
    const resize = () => {
      w = c.clientWidth;
      h = c.clientHeight;
      c.width = w * dpr;
      c.height = h * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    const dens = density * sky.density;
    const spd = sky.speed;
    const white = sprite('255,255,255');
    const goldS = sprite('240,214,150');
    // area-scaled so small and large iPhones look equally full
    const area = Math.max(0.6, (w * h) / (390 * 844));
    const n = Math.min(420, Math.round((150 * dens + burst) * area));
    type P = { x: number; y: number; r: number; vy: number; ph: number; sway: number; a: number };
    const layer = (): number => { const u = Math.random(); return u < 0.55 ? 0 : u < 0.87 ? 1 : 2; };
    const ps: P[] = Array.from({ length: n }, () => {
      const L = layer();
      const depth = [0.12, 0.5, 0.95][L] + Math.random() * 0.12;
      return {
        x: Math.random() * w,
        y: burst ? Math.random() * h * 0.6 : Math.random() * h,
        r: 0.8 + depth * 2.4,
        vy: 0.16 + depth * 0.62 + Math.random() * 0.08,
        ph: Math.random() * 6.28,
        sway: 0.08 + depth * 0.4,
        a: 0.14 + depth * 0.5 + Math.random() * 0.06,
      };
    });
    type D = { x: number; y: number; r: number; ph: number; vx: number; vy: number };
    const dust: D[] = gold && sky.dust ? Array.from({ length: Math.round(34 * Math.min(2, dens) * area) }, () => ({ x: Math.random() * w, y: Math.random() * h, r: 1.6 + Math.random() * 2.4, ph: Math.random() * 6.28, vx: (Math.random() - 0.5) * 0.08, vy: -0.03 - Math.random() * 0.06 })) : [];
    type S = { x: number; y: number; vx: number; vy: number; life: number; max: number; len: number };
    const shooting: S[] = [];
    const useStars = stars && sky.stars;
    let nextStar = 400 + Math.random() * 900;
    let raf = 0;
    let last = performance.now();
    const tick = (t: number) => {
      const dt = Math.min(3, (t - last) / 16.7) * spd;
      last = t;
      ctx.clearRect(0, 0, w, h);
      // gold dust (behind snow)
      for (const d of dust) {
        d.ph += 0.025 * dt;
        d.x += d.vx * dt;
        d.y += d.vy * dt;
        if (d.y < -4) { d.y = h + 4; d.x = Math.random() * w; }
        if (d.x < -4) d.x = w + 4;
        if (d.x > w + 4) d.x = -4;
        ctx.globalAlpha = 0.18 + 0.32 * (0.5 + 0.5 * Math.sin(d.ph));
        ctx.drawImage(goldS, d.x - d.r, d.y - d.r, d.r * 2, d.r * 2);
      }
      // shooting stars
      if (useStars) {
        nextStar -= 16.7 * dt;
        if (nextStar <= 0 && shooting.length < 4) {
          const ang = (Math.PI / 180) * (18 + Math.random() * 28) * (Math.random() < 0.5 ? 1 : -1);
          const v = 7 + Math.random() * 6;
          const fromLeft = ang > 0;
          shooting.push({ x: fromLeft ? Math.random() * w * 0.7 : w * 0.3 + Math.random() * w * 0.7, y: Math.random() * h * 0.7, vx: Math.cos(ang) * v * (fromLeft ? 1 : -1), vy: Math.abs(Math.sin(ang)) * v, life: 0, max: 38 + Math.random() * 30, len: 60 + Math.random() * 80 });
          nextStar = (1400 + Math.random() * 2600) / Math.max(0.4, dens);
        }
        for (let i = shooting.length - 1; i >= 0; i--) {
          const s = shooting[i];
          s.life += dt;
          s.x += s.vx * dt;
          s.y += s.vy * dt;
          const k = s.life / s.max;
          if (k >= 1) { shooting.splice(i, 1); continue; }
          const fade = Math.sin(Math.PI * k);
          const m = Math.hypot(s.vx, s.vy);
          const tx = s.x - (s.vx / m) * s.len, ty = s.y - (s.vy / m) * s.len;
          const g = ctx.createLinearGradient(s.x, s.y, tx, ty);
          g.addColorStop(0, `rgba(255,248,230,${0.85 * fade})`);
          g.addColorStop(0.3, `rgba(240,214,150,${0.4 * fade})`);
          g.addColorStop(1, 'rgba(240,214,150,0)');
          ctx.globalAlpha = 1;
          ctx.strokeStyle = g;
          ctx.lineWidth = 1.4;
          ctx.lineCap = 'round';
          ctx.beginPath();
          ctx.moveTo(s.x, s.y);
          ctx.lineTo(tx, ty);
          ctx.stroke();
          ctx.globalAlpha = 0.9 * fade;
          ctx.drawImage(white, s.x - 3, s.y - 3, 6, 6);
        }
      }
      // snow
      for (const p of ps) {
        p.ph += 0.01 * dt;
        p.y += p.vy * dt;
        p.x += Math.sin(p.ph) * p.sway * dt;
        if (p.y > h + 6) {
          p.y = -6;
          p.x = Math.random() * w;
        }
        ctx.globalAlpha = p.a;
        ctx.drawImage(white, p.x - p.r, p.y - p.r, p.r * 2, p.r * 2);
      }
      ctx.globalAlpha = 1;
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    const vis = () => {
      cancelAnimationFrame(raf);
      if (!document.hidden) {
        last = performance.now();
        raf = requestAnimationFrame(tick);
      }
    };
    document.addEventListener('visibilitychange', vis);
    addEventListener('resize', resize);
    return () => {
      cancelAnimationFrame(raf);
      document.removeEventListener('visibilitychange', vis);
      removeEventListener('resize', resize);
    };
  }, [density, gold, burst, stars, sky.density, sky.speed, sky.stars, sky.dust]);
  return <canvas ref={ref} className="snow-canvas" data-testid="sky-canvas" aria-hidden="true" />;
}

/** Density / speed / shooting stars / gold dust controls (Christmas Magic + Appearance). */
export function SkyControls({ t }: { t: (s: string, ...a: any[]) => string }) {
  const s = useSky();
  const set = (p: Partial<SkySettings>) => writeSky({ ...s, ...p });
  const lvl = (v: number) => (v < 0.75 ? t('Nhẹ') : v < 1.25 ? t('Vừa') : v < 1.75 ? t('Dày') : t('Rất dày'));
  return (
    <div className="sky-controls" data-testid="sky-controls">
      <label className="field">
        <span>{t('Mật độ tuyết & sao')}: {lvl(s.density)}</span>
        <input type="range" min={0.4} max={2} step={0.1} value={s.density} onChange={(e: any) => set({ density: Number(e.target.value) })} data-testid="sky-density" />
      </label>
      <label className="field">
        <span>{t('Tốc độ')}: {s.speed.toFixed(1)}×</span>
        <input type="range" min={0.4} max={1.8} step={0.1} value={s.speed} onChange={(e: any) => set({ speed: Number(e.target.value) })} data-testid="sky-speed" />
      </label>
      <label className="toggle-row"><input type="checkbox" checked={s.stars} onChange={(e: any) => set({ stars: e.target.checked })} /> {t('Sao băng')}</label>
      <label className="toggle-row"><input type="checkbox" checked={s.dust} onChange={(e: any) => set({ dust: e.target.checked })} /> {t('Bụi sao vàng')}</label>
      <button className="link-btn" onClick={() => writeSky(SKY_DEFAULT)}>{t('Khôi phục mặc định')}</button>
    </div>
  );
}
