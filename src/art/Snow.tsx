import { useEffect, useRef } from 'react';

/** Layered gentle snow + very subtle gold particles on one canvas. Pauses when hidden. */
export function Snow({ density = 1, gold = true, burst = 0 }: { density?: number; gold?: boolean; burst?: number }) {
  const ref = useRef<HTMLCanvasElement | null>(null);
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
    const n = Math.round(55 * density + burst);
    type P = { x: number; y: number; r: number; vy: number; vx: number; ph: number; layer: number; gold: boolean };
    const ps: P[] = Array.from({ length: n }, (_, i) => {
      const layer = i % 3;
      return { x: Math.random() * w, y: burst ? Math.random() * h * 0.6 : Math.random() * h, r: 0.8 + layer * 0.9 + Math.random() * 0.8, vy: 0.25 + layer * 0.3 + Math.random() * 0.2, vx: 0, ph: Math.random() * 6.28, layer, gold: gold && i % 9 === 0 };
    });
    let raf = 0;
    let last = performance.now();
    const tick = (t: number) => {
      const dt = Math.min(3, (t - last) / 16.7);
      last = t;
      ctx.clearRect(0, 0, w, h);
      for (const p of ps) {
        p.ph += 0.01 * dt;
        p.y += p.vy * dt;
        p.x += Math.sin(p.ph) * 0.25 * (p.layer + 1) * dt;
        if (p.y > h + 4) {
          p.y = -4;
          p.x = Math.random() * w;
        }
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, 6.283);
        ctx.fillStyle = p.gold ? `rgba(229,200,140,${0.35 + 0.25 * Math.sin(p.ph * 3)})` : `rgba(255,255,255,${0.35 + p.layer * 0.18})`;
        ctx.fill();
      }
      raf = requestAnimationFrame(tick);
    };
    const vis = () => {
      cancelAnimationFrame(raf);
      if (!document.hidden) {
        last = performance.now();
        raf = requestAnimationFrame(tick);
      }
    };
    vis();
    addEventListener('resize', resize);
    document.addEventListener('visibilitychange', vis);
    return () => {
      cancelAnimationFrame(raf);
      removeEventListener('resize', resize);
      document.removeEventListener('visibilitychange', vis);
    };
  }, [density, gold, burst]);
  return <canvas ref={ref} className="snow-canvas" aria-hidden="true" />;
}
