import { useEffect, useRef, useState } from 'react';
import { useArt, useArtUrl } from '../ui/art';
import { t } from '../lib/i18n';

interface Flake { x: number; y: number; r: number; vx: number; vy: number; fall: number; rest: boolean; drift: boolean }

/**
 * Official "Shanghai Enchanted Snow Globe": the artwork is shown unchanged; snow is drawn on a canvas clipped to the
 * glass (never over the base). Tap → warm glow; swipe → stir; optional shake via motion sensor (asks permission only
 * when the user taps the button).
 */
export function SnowGlobeArt({ reduced }: { reduced: boolean }) {
  const a = useArt('globe');
  const url = useArtUrl('globe', 'disp');
  const wrap = useRef<HTMLDivElement | null>(null);
  const cv = useRef<HTMLCanvasElement | null>(null);
  const flakes = useRef<Flake[]>([]);
  const stir = useRef(0);
  const last = useRef<{ x: number; y: number } | null>(null);
  const [on, setOn] = useState(() => { try { return localStorage.getItem('chang-globe-fx') !== 'off'; } catch { return true; } });
  const [glow, setGlow] = useState(0);
  const [motion, setMotion] = useState<'off' | 'on' | 'denied' | 'unsupported'>(typeof DeviceMotionEvent === 'undefined' ? 'unsupported' : 'off');
  const [cx0, cy0, r0] = a?.glass ?? [0.497, 0.372, 0.37];
  const FLOOR = 0.6; // relative to height: snow bank inside the glass

  useEffect(() => {
    const c = cv.current;
    if (!c || !url || !on) return;
    const ctx = c.getContext('2d')!;
    let raf = 0;
    let visible = !document.hidden;
    const fit = () => {
      const r = c.getBoundingClientRect();
      const d = Math.min(2, devicePixelRatio || 1);
      c.width = r.width * d;
      c.height = r.height * d;
    };
    fit();
    const W = () => c.width, H = () => c.height;
    const R = () => r0 * W(), CX = () => cx0 * W(), CY = () => cy0 * H();
    const inside = (x: number, y: number) => (x - CX()) ** 2 + (y - CY()) ** 2 < (R() * 0.9) ** 2 && y < FLOOR * H() - 4;
    if (!flakes.current.length)
      for (let i = 0; i < 150; i++) {
        let x = 0, y = 0;
        do { x = CX() + (Math.random() * 2 - 1) * R(); y = CY() + (Math.random() * 2 - 1) * R(); } while (!inside(x, y));
        flakes.current.push({ x, y, r: (0.7 + Math.random() * 1.7) * (W() / 400), vx: 0, vy: 0, fall: (0.12 + Math.random() * 0.3) * (W() / 400), rest: false, drift: i % 3 === 0 });
      }
    const step = () => {
      const s = stir.current;
      ctx.clearRect(0, 0, W(), H());
      ctx.save();
      ctx.beginPath();
      ctx.arc(CX(), CY(), R() * 0.97, 0, Math.PI * 2);
      ctx.rect(0, FLOOR * H(), W(), H()); // remove the base region via even-odd
      ctx.clip('evenodd');
      // V1.3: tap/swipe/shake → a swirling vortex that slowly calms; flakes then drift down and settle on the snow
      // bank inside the glass (never below it, never through the base).
      const k = W() / 400;
      const floorY = FLOOR * H();
      for (const f of flakes.current) {
        if (f.rest) {
          if (s > 0.12 && Math.random() < s * 0.08) { f.rest = false; f.vy = -(1 + Math.random() * 2.5) * k * s; f.vx = (Math.random() - 0.5) * 3 * k * s; }
        } else {
          const dx = f.x - CX(), dy = f.y - CY();
          const d = Math.hypot(dx, dy) || 1;
          // swirl (tangential) + a little lift while stirred
          f.vx += (-dy / d) * 0.09 * s * k + (Math.random() - 0.5) * 0.05 * (1 + s * 5) * k;
          f.vy += (dx / d) * 0.09 * s * k - s * 0.025 * k * Math.random();
          // gravity toward a gentle terminal fall speed
          f.vy += (f.fall - f.vy) * 0.03;
          f.vx *= 0.965;
          f.x += f.vx;
          f.y += f.vy;
          // keep inside the glass: reflect softly off the wall
          const nx = f.x - CX(), ny = f.y - CY(), nd = Math.hypot(nx, ny);
          const lim = R() * 0.93;
          if (nd > lim) { f.x = CX() + (nx / nd) * lim; f.y = CY() + (ny / nd) * lim; f.vx *= -0.4; f.vy *= -0.4; }
          if (f.y > floorY - f.r) {
            if (s < 0.25 && f.drift) {
              // a third of the flakes keep falling gently forever: re-enter at the top of the glass
              f.x = CX() + (Math.random() * 2 - 1) * R() * 0.7;
              f.y = CY() - Math.sqrt(Math.max(0, (R() * 0.9) ** 2 - (f.x - CX()) ** 2)) + 6;
              f.vx = 0; f.vy = f.fall;
            } else if (s < 0.25) { f.rest = true; f.y = floorY - f.r - Math.random() * 3 * k; f.vx = f.vy = 0; }
            else { f.y = floorY - f.r; f.vy = -Math.abs(f.vy) * 0.6; }
          }
        }
        ctx.globalAlpha = f.rest ? 0.7 : 0.88;
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(f.x, f.y, f.r, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
      stir.current = Math.max(0, s * 0.985 - 0.0015); // slow, natural settling
      if (visible && !reduced) raf = requestAnimationFrame(step);
    };
    const vis = () => { visible = !document.hidden && onScreen; cancelAnimationFrame(raf); if (visible && !reduced) raf = requestAnimationFrame(step); };
    document.addEventListener('visibilitychange', vis);
    addEventListener('resize', fit);
    // pause while the globe is scrolled out of view → no work during scrolling elsewhere
    let onScreen = true;
    const io = new IntersectionObserver(([e]) => {
      const was = onScreen;
      onScreen = e.isIntersecting;
      visible = onScreen && !document.hidden;
      if (onScreen && !was) { cancelAnimationFrame(raf); if (!reduced) raf = requestAnimationFrame(step); }
      if (!onScreen) cancelAnimationFrame(raf);
    });
    io.observe(c);
    step();
    return () => { cancelAnimationFrame(raf); io.disconnect(); document.removeEventListener('visibilitychange', vis); removeEventListener('resize', fit); };
  }, [url, on, reduced, cx0, cy0, r0]);

  useEffect(() => {
    if (motion !== 'on') return;
    const h = (e: DeviceMotionEvent) => {
      const g = e.accelerationIncludingGravity;
      const m = Math.hypot(g?.x ?? 0, g?.y ?? 0, g?.z ?? 0);
      if (m > 16) stir.current = Math.min(2.2, stir.current + 0.5);
    };
    addEventListener('devicemotion', h);
    return () => removeEventListener('devicemotion', h);
  }, [motion]);

  if (!url) return null;
  const toggle = () => { const v = !on; setOn(v); try { localStorage.setItem('chang-globe-fx', v ? 'on' : 'off'); } catch { /* */ } };
  const enableMotion = async () => {
    try {
      const DM: any = DeviceMotionEvent;
      if (typeof DM.requestPermission === 'function') setMotion((await DM.requestPermission()) === 'granted' ? 'on' : 'denied');
      else setMotion('on');
    } catch { setMotion('denied'); }
  };
  return (
    <div className="globe-art-wrap">
      <div
        ref={wrap}
        className={`globe-art ${glow ? 'glow' : ''}`}
        data-testid="globe-art"
        style={{ aspectRatio: `${a?.width ?? 1192} / ${a?.height ?? 1320}` }}
        onPointerDown={(e: any) => { last.current = { x: e.clientX, y: e.clientY }; setGlow((g) => g + 1); stir.current = Math.min(2.2, stir.current + 0.6); setTimeout(() => setGlow(0), 1200); }}
        onPointerMove={(e: any) => { if (!last.current) return; const d = Math.hypot(e.clientX - last.current.x, e.clientY - last.current.y); stir.current = Math.min(2.2, stir.current + d / 160); last.current = { x: e.clientX, y: e.clientY }; }}
        onPointerUp={() => (last.current = null)}
        onPointerCancel={() => (last.current = null)}
      >
        <img src={url} alt={t('Quả cầu tuyết Thượng Hải')} draggable={false} />
        <span className="globe-warm" aria-hidden="true" style={{ left: `${cx0 * 100}%`, top: `${cy0 * 100}%`, width: `${r0 * 200}%` }} />
        {on && <canvas ref={cv} className="globe-snow" aria-hidden="true" />}
      </div>
      <div className="row gap-s wrap center-row">
        <button className="btn small" data-testid="globe-fx" onClick={toggle}>{on ? t('Tắt hiệu ứng tuyết') : t('Bật hiệu ứng tuyết')}</button>
        {motion !== 'unsupported' && motion !== 'on' && <button className="btn small ghost" onClick={enableMotion}>{t('Lắc điện thoại để khuấy tuyết')}</button>}
      </div>
      <p className="muted xsmall center">{motion === 'denied' ? t('Chưa được phép dùng cảm biến chuyển động — vẫn có thể chạm và vuốt.') : t('Chạm để sáng ấm · vuốt để khuấy tuyết.')}</p>
    </div>
  );
}
