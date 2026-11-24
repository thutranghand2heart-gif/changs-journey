import { useEffect, useRef, useState } from 'react';
import type { Journey } from '../../db/schema';
import { useBlobUrl } from '../../ui/core';
import { daysBetween } from '../../lib/time';
import { t } from '../../lib/i18n';
import { fmtShort } from '../../lib/time';

/** Where the sleigh sits on the countdown track (0 = when the trip was planned, 1 = departure day). Never changes any date. */
function totalDays(j: Journey) {
  const planned = (j.createdAt ?? '').slice(0, 10);
  return Math.max(30, planned ? daysBetween(planned, j.startDate) : 30);
}
/** Date shown while dragging: the countdown day that position corresponds to (preview only). */
function previewDate(j: Journey, p: number): { date: string; left: number } {
  const left = Math.round((1 - p) * totalDays(j));
  const d = new Date(j.startDate + 'T12:00:00Z');
  d.setUTCDate(d.getUTCDate() - left);
  return { date: d.toISOString().slice(0, 10), left };
}

export function countdownProgress(j: Journey, phase: 'before' | 'during' | 'after', daysUntil: number): number {
  if (phase !== 'before') return 1;
  const planned = (j.createdAt ?? '').slice(0, 10);
  const total = Math.max(30, planned ? daysBetween(planned, j.startDate) : 30);
  return Math.min(1, Math.max(0, 1 - daysUntil / total));
}

const reduced = () => document.documentElement.classList.contains('reduce-motion');

/**
 * Countdown track with a draggable personal sticker as the thumb. The sticker image is shown exactly as imported
 * (object-fit: contain, original aspect ratio, no filters). Dragging is only play: on release it glides back to the
 * real countdown position.
 */
export function CountdownSleigh({ journey: j, progress, leftLabel, rightLabel }: { journey: Journey; progress: number; leftLabel: string; rightLabel: string }) {
  const blobId = j.settings.countdownStickerBlobId;
  const { url } = useBlobUrl(blobId);
  const track = useRef<HTMLDivElement | null>(null);
  const [w, setW] = useState(0);
  const [aspect, setAspect] = useState(2.7);
  const [drag, setDrag] = useState<number | null>(null); // progress 0..1 while dragging (preview only)
  const start = useRef<{ px: number; p: number; mode: 'sticker' | 'rail' } | null>(null);
  const lastSpark = useRef(0);
  const [sparks, setSparks] = useState<{ id: number; x: number; y: number; dx: number; s: number }[]>([]);
  // V1.2.2 geometry — one control, two views of the same progress value p:
  //  • the visual rail spans 88% of the card width, centred, the knob sits at p along it;
  //  • the sticker travels the real free range [0, w − thumbW] at the same p, so it is never clipped at either end.
  const thumbW = url ? Math.round(Math.min(300, Math.max(180, w * 0.62))) : 56;
  const thumbH = url ? thumbW / aspect : 30;
  const maxX = Math.max(0, w - thumbW);
  const cardPad = 16; // .countdown-card horizontal padding — the rail is measured against the whole card
  const railW = Math.max(1, Math.min(w - 8, (w + cardPad * 2) * 0.88));
  const railL = (w - railW) / 2;
  const p = drag ?? progress;
  const x = p * maxX;
  const railTop = thumbH + 14;

  useEffect(() => {
    const el = track.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setW(el.clientWidth));
    ro.observe(el);
    setW(el.clientWidth);
    return () => ro.disconnect();
  }, []);

  const spark = (atX: number) => {
    if (reduced()) return;
    const now = performance.now();
    if (now - lastSpark.current < 45) return;
    lastSpark.current = now;
    const id = now + Math.random();
    const q = { id, x: atX + thumbW * 0.12, y: thumbH * (0.35 + Math.random() * 0.5), dx: -10 - Math.random() * 26, s: 3 + Math.random() * 4 };
    setSparks((arr) => [...arr.slice(-28), q]);
    setTimeout(() => setSparks((arr) => arr.filter((r) => r.id !== id)), 950);
  };

  const clamp = (v: number) => Math.min(1, Math.max(0, v));
  const down = (mode: 'sticker' | 'rail') => (e: PointerEvent) => {
    (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
    const box = track.current?.getBoundingClientRect();
    const p0 = mode === 'rail' && box ? clamp((e.clientX - box.left - railL) / railW) : p;
    start.current = { px: e.clientX, p: p0, mode };
    setDrag(p0);
  };
  const move = (e: PointerEvent) => {
    const st = start.current;
    if (!st) return;
    const dx = e.clientX - st.px;
    // Dragging the sticker moves it 1:1 with the finger; dragging the knob follows the finger along the rail.
    const np = clamp(st.p + dx / (st.mode === 'sticker' ? Math.max(1, maxX) : railW));
    setDrag(np);
    spark(np * maxX);
  };
  const up = () => {
    start.current = null;
    setDrag(null); // glides back to the real countdown position (CSS transition)
  };
  const handlers = { onPointerMove: move, onPointerUp: up, onPointerCancel: up };
  const settle = drag == null ? 'settle' : '';

  return (
    <div className="sleigh-countdown" data-testid="sleigh-countdown" data-progress={p.toFixed(3)}>
      <div className="sleigh-track" ref={track} style={{ height: railTop + 22 }}>
        <div className="sleigh-lane" style={{ height: thumbH + 6 }} aria-hidden="true" />
        <div className="sleigh-rail" data-testid="sleigh-rail" style={{ left: railL, width: railW, top: railTop }} {...handlers} onPointerDown={down('rail')}>
          <div className={`sleigh-rail-done ${settle}`} style={{ width: `${p * 100}%` }} />
          <span className="rail-mark start" />
          <span className="rail-mark end">★</span>
          <span className={`rail-knob ${settle}`} data-testid="sleigh-knob" style={{ left: `${p * 100}%` }} aria-hidden="true" />
        </div>
        {sparks.map((q) => (
          <span key={q.id} className="stardust" style={{ left: q.x, top: q.y, width: q.s, height: q.s, ['--dx' as any]: `${q.dx}px` }} />
        ))}
        {drag != null && (() => {
          const pv = previewDate(j, drag);
          return (
            <span className="sleigh-preview" data-testid="sleigh-preview" style={{ left: Math.min(Math.max(railL + drag * railW, 74), w - 74) }}>
              {fmtShort(pv.date)} · {pv.left ? t('còn {0} ngày', pv.left) : t('Ngày khởi hành')}
            </span>
          );
        })()}
        <button
          type="button"
          className={`sleigh-thumb ${settle}`}
          data-testid="sleigh-thumb"
          aria-label={t('Xe tuần lộc đếm ngược — kéo để chơi, thả ra sẽ quay về đúng vị trí')}
          style={{ width: thumbW, height: thumbH, transform: `translateX(${x}px)` }}
          onPointerDown={down('sticker')}
          {...handlers}
        >
          {url ? (
            <img src={url} alt="" draggable={false} onLoad={(e: any) => e.target.naturalWidth && setAspect(e.target.naturalWidth / e.target.naturalHeight)} />
          ) : (
            <svg viewBox="0 0 56 30" width="56" height="30" aria-hidden="true">
              <path d="M6 20h34c6 0 9-4 9-9" fill="none" stroke="#D5B477" strokeWidth="2.4" strokeLinecap="round" />
              <path d="M10 8h18c3 0 5 2 5 5v4H12c-3 0-5-2-5-5" fill="#8B1E2D" stroke="#D5B477" strokeWidth="1.6" />
              <path d="M2 24h40c4 0 6-2 6-4" fill="none" stroke="#D5B477" strokeWidth="2" strokeLinecap="round" />
            </svg>
          )}
        </button>
      </div>
      <div className="sleigh-labels xsmall muted" style={{ paddingLeft: Math.max(0, railL - 4), paddingRight: Math.max(0, railL - 4) }}>
        <span>{leftLabel}</span>
        <span>{rightLabel}</span>
      </div>
    </div>
  );
}
