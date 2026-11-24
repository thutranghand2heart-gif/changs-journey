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
    // V1.2.2: small, soft flakes with depth — far flakes are tiny, faint and slow; near flakes a little larger and clearer.
    // Drawn from a pre-blurred sprite so edges are soft (no hard white dots).
    const n = Math.round(70 * density + burst);
    const sprite = document.createElement('canvas');
    const SR = 16;
    sprite.width = sprite.height = SR * 2;
    const sc = sprite.getContext('2d')!;
    const g = sc.createRadialGradient(SR, SR, 0, SR, SR, SR);
    g.addColorStop(0, 'rgba(255,255,255,1)');
    g.addColorStop(0.35, 'rgba(255,255,255,0.75)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    sc.fillStyle = g;
    sc.fillRect(0, 0, SR * 2, SR * 2);
    type P = { x: number; y: number; r: number; vy: number; ph: number; sway: number; a: number; gold: boolean };
    const ps: P[] = Array.from({ length: n }, (_, i) => {
      const depth = Math.random() ** 1.6; // most flakes far away
      return {
        x: Math.random() * w,
        y: burst ? Math.random() * h * 0.6 : Math.random() * h,
        r: 0.9 + depth * 2.1, // sprite radius incl. soft edge → visible core ≈ 0.4–1.2px
        vy: 0.18 + depth * 0.5 + Math.random() * 0.08,
        ph: Math.random() * 6.28,
        sway: 0.1 + depth * 0.35,
        a: 0.16 + depth * 0.42 + Math.random() * 0.06,
        gold: gold && i % 11 === 0,
      };
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
        p.x += Math.sin(p.ph) * p.sway * dt;
        if (p.y > h + 6) {
          p.y = -6;
          p.x = Math.random() * w;
        }
        if (p.gold) {
          ctx.globalAlpha = 1;
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.r * 0.45, 0, 6.283);
          ctx.fillStyle = `rgba(229,200,140,${0.25 + 0.2 * Math.sin(p.ph * 3)})`;
          ctx.fill();
        } else {
          ctx.globalAlpha = p.a;
          ctx.drawImage(sprite, p.x - p.r, p.y - p.r, p.r * 2, p.r * 2);
        }
      }
      ctx.globalAlpha = 1;
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
