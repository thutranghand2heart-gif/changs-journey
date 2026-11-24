import { useEffect, useRef, useState } from 'react';
import { useArt, useArtUrl } from '../ui/art';
import { t } from '../lib/i18n';

interface Flake { x: number; y: number; r: number; vx: number; vy: number }

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
    const inside = (x: number, y: number) => (x - CX()) ** 2 + (y - CY()) ** 2 < (R() * 0.96) ** 2 && y < FLOOR * H();
    if (!flakes.current.length)
      for (let i = 0; i < 90; i++) {
        let x = 0, y = 0;
        do { x = CX() + (Math.random() * 2 - 1) * R(); y = CY() + (Math.random() * 2 - 1) * R(); } while (!inside(x, y));
        flakes.current.push({ x, y, r: (0.8 + Math.random() * 1.8) * (W() / 400), vx: 0, vy: (0.15 + Math.random() * 0.35) * (W() / 400) });
      }
    const step = () => {
      const s = stir.current;
      ctx.clearRect(0, 0, W(), H());
      ctx.save();
      ctx.beginPath();
      ctx.arc(CX(), CY(), R() * 0.97, 0, Math.PI * 2);
      ctx.rect(0, FLOOR * H(), W(), H()); // remove the base region via even-odd
      ctx.clip('evenodd');
      for (const f of flakes.current) {
        f.vx += (Math.random() - 0.5) * 0.06 * (1 + s * 6) * (W() / 400);
        f.vx *= 0.96;
        f.x += f.vx;
        f.y += f.vy * (1 + s * 0.5) - s * (Math.random() * 2.2) * (W() / 400);
        if (!inside(f.x, f.y)) {
          // re-enter at the top of the glass
          f.x = CX() + (Math.random() * 2 - 1) * R() * 0.8;
          f.y = CY() - Math.sqrt(Math.max(0, R() ** 2 - (f.x - CX()) ** 2)) * 0.9 + 4;
          f.vx = 0;
        }
        ctx.globalAlpha = 0.85;
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(f.x, f.y, f.r, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
      stir.current = Math.max(0, s * 0.965 - 0.002);
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
      if (m > 18) stir.current = Math.min(1.5, stir.current + 0.4);
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
        onPointerDown={(e: any) => { last.current = { x: e.clientX, y: e.clientY }; setGlow((g) => g + 1); stir.current = Math.min(1.5, stir.current + 0.25); setTimeout(() => setGlow(0), 1200); }}
        onPointerMove={(e: any) => { if (!last.current) return; const d = Math.hypot(e.clientX - last.current.x, e.clientY - last.current.y); stir.current = Math.min(1.5, stir.current + d / 300); last.current = { x: e.clientX, y: e.clientY }; }}
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
