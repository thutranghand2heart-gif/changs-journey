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
  const [drag, setDrag] = useState<number | null>(null); // x while dragging
  const start = useRef<{ px: number; x: number } | null>(null);
  const lastSpark = useRef(0);
  const [sparks, setSparks] = useState<{ id: number; x: number; y: number; dx: number; s: number }[]>([]);
  const thumbW = url ? Math.min(340, Math.max(200, w * 0.8)) : 56; // V1.2: ~35% larger than 1.1
  const thumbH = url ? thumbW / aspect : 30;
  const maxX = Math.max(0, w - thumbW);
  const realX = progress * maxX;
  const x = drag ?? realX;

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
    const p = { id, x: atX + thumbW * 0.12, y: thumbH * (0.35 + Math.random() * 0.5), dx: -10 - Math.random() * 26, s: 3 + Math.random() * 4 };
    setSparks((a) => [...a.slice(-28), p]);
    setTimeout(() => setSparks((a) => a.filter((q) => q.id !== id)), 950);
  };

  const onDown = (e: PointerEvent) => {
    (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
    start.current = { px: e.clientX, x };
    setDrag(x);
  };
  const onMove = (e: PointerEvent) => {
    if (!start.current) return;
    const nx = Math.min(maxX, Math.max(0, start.current.x + (e.clientX - start.current.px)));
    setDrag(nx);
    spark(nx);
  };
  const onUp = () => {
    start.current = null;
    setDrag(null); // glides back to the real countdown position (CSS transition)
  };

  return (
    <div className="sleigh-countdown" data-testid="sleigh-countdown">
      <div className="sleigh-track" ref={track} style={{ height: thumbH + 14 }}>
        <div className="sleigh-rail" style={{ left: thumbW / 2, right: thumbW / 2, top: thumbH * 0.78 }}>
          <div className="sleigh-rail-done" style={{ width: `${progress * 100}%` }} />
        </div>
        {sparks.map((p) => (
          <span key={p.id} className="stardust" style={{ left: p.x, top: p.y, width: p.s, height: p.s, ['--dx' as any]: `${p.dx}px` }} />
        ))}
        {drag != null && maxX > 0 && (() => {
          const pv = previewDate(j, drag / maxX);
          return (
            <span className="sleigh-preview" data-testid="sleigh-preview" style={{ left: Math.min(Math.max(drag + thumbW / 2, 74), w - 74) }}>
              {fmtShort(pv.date)} · {pv.left ? t('còn {0} ngày', pv.left) : t('Ngày khởi hành')}
            </span>
          );
        })()}
        <button
          type="button"
          className={`sleigh-thumb ${drag == null ? 'settle' : ''}`}
          data-testid="sleigh-thumb"
          aria-label={t('Xe tuần lộc đếm ngược — kéo để chơi, thả ra sẽ quay về đúng vị trí')}
          style={{ width: thumbW, height: thumbH, transform: `translateX(${x}px)` }}
          onPointerDown={onDown}
          onPointerMove={onMove}
          onPointerUp={onUp}
          onPointerCancel={onUp}
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
      <div className="sleigh-labels xsmall muted">
        <span>{leftLabel}</span>
        <span>{rightLabel}</span>
      </div>
    </div>
  );
}
