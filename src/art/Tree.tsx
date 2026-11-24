import { useMemo } from 'react';

// Original layered SVG Christmas tree — the defining element of the Christmas journey Home.
// Built procedurally: 8 scalloped branch tiers, each with a shadow layer, a
// two-tone emerald gradient, restrained champagne-gold rim, ornaments, warm lights and a star.

const W = 420;
const H = 1000;
const CX = 230;

interface Tier { top: number; bottom: number; half: number }

function tierPath(t: Tier, scallops: number, droop: number): string {
  const left = CX - t.half;
  const right = CX + t.half;
  const shoulder = t.top + (t.bottom - t.top) * 0.18;
  let d = `M ${CX} ${t.top} C ${CX - t.half * 0.25} ${shoulder}, ${left + t.half * 0.18} ${t.bottom - droop * 2.2}, ${left} ${t.bottom}`;
  const seg = (right - left) / scallops;
  for (let i = 0; i < scallops; i++) {
    const x0 = left + seg * i;
    const x1 = x0 + seg;
    const mid = (x0 + x1) / 2;
    // each scallop droops; edges slightly lifted for a 3D, curved-hem feel
    const curve = Math.sin(((i + 0.5) / scallops) * Math.PI);
    d += ` Q ${mid} ${t.bottom + droop * (0.65 + 0.55 * curve)}, ${x1} ${t.bottom + (i === scallops - 1 ? 0 : droop * 0.12 * curve)}`;
  }
  d += ` C ${right - t.half * 0.18} ${t.bottom - droop * 2.2}, ${CX + t.half * 0.25} ${shoulder}, ${CX} ${t.top} Z`;
  return d;
}

export function ChristmasTree({ lights = true, animate = true, className = '' }: { lights?: boolean; animate?: boolean; className?: string }) {
  const tiers = useMemo<Tier[]>(() => {
    const out: Tier[] = [];
    const n = 8;
    for (let i = 0; i < n; i++) {
      const p = i / (n - 1);
      const top = 95 + i * 88;
      const bottom = top + 150 + p * 40;
      const half = 48 + Math.pow(p, 0.92) * 175;
      out.push({ top, bottom, half });
    }
    return out;
  }, []);

  const ornaments = useMemo(() => {
    const list: { x: number; y: number; r: number; kind: 'gold' | 'red' | 'cream' }[] = [];
    let seed = 7;
    const rnd = () => ((seed = (seed * 9301 + 49297) % 233280) / 233280);
    tiers.forEach((t, i) => {
      if (i === 0) return;
      const count = 2 + Math.floor(i * 0.7);
      for (let k = 0; k < count; k++) {
        const fx = (k + 0.5) / count - 0.5;
        list.push({ x: CX + fx * t.half * 1.6 + (rnd() - 0.5) * 12, y: t.bottom - 10 + rnd() * 16, r: 7 + rnd() * 5, kind: (['gold', 'red', 'gold', 'cream'] as const)[(k + i) % 4] });
      }
    });
    return list;
  }, [tiers]);

  const garlands = useMemo(
    () =>
      tiers.slice(1).map((t, i) => {
        const y0 = t.top + (t.bottom - t.top) * 0.55;
        const hw = t.half * 0.78;
        const pts: { x: number; y: number }[] = [];
        for (let k = 0; k <= 9; k++) {
          const f = k / 9;
          pts.push({ x: CX - hw + f * hw * 2, y: y0 + Math.sin(f * Math.PI) * 26 + (i % 2 ? 6 : -4) * (f - 0.5) });
        }
        return pts;
      }),
    [tiers],
  );

  return (
    <svg className={`xmas-tree ${animate ? 'animated' : ''} ${className}`} viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMax meet" aria-hidden="true" focusable="false">
      <defs>
        <linearGradient id="tg-branch" x1="0" x2="1" y1="0" y2="0.3">
          <stop offset="0" stopColor="#2f7a5f" />
          <stop offset="0.42" stopColor="#1a5a45" />
          <stop offset="1" stopColor="#0a2e24" />
        </linearGradient>
        <linearGradient id="tg-shadow" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" stopColor="#061c16" stopOpacity="0" />
          <stop offset="1" stopColor="#03120e" stopOpacity="0.85" />
        </linearGradient>
        <radialGradient id="tg-sheen" cx="0.3" cy="0.25" r="0.75">
          <stop offset="0" stopColor="#7fd1ad" stopOpacity="0.35" />
          <stop offset="1" stopColor="#7fd1ad" stopOpacity="0" />
        </radialGradient>
        <radialGradient id="tg-gold" cx="0.35" cy="0.3" r="0.7">
          <stop offset="0" stopColor="#fff3cf" />
          <stop offset="0.45" stopColor="#D5B477" />
          <stop offset="1" stopColor="#8a6a2f" />
        </radialGradient>
        <radialGradient id="tg-red" cx="0.35" cy="0.3" r="0.7">
          <stop offset="0" stopColor="#ff9aa4" />
          <stop offset="0.45" stopColor="#a8283a" />
          <stop offset="1" stopColor="#4d0c16" />
        </radialGradient>
        <radialGradient id="tg-cream" cx="0.35" cy="0.3" r="0.7">
          <stop offset="0" stopColor="#ffffff" />
          <stop offset="0.5" stopColor="#FFF8EE" />
          <stop offset="1" stopColor="#c9b89a" />
        </radialGradient>
        <radialGradient id="tg-glow" cx="0.5" cy="0.5" r="0.5">
          <stop offset="0" stopColor="#ffe7a8" stopOpacity="0.95" />
          <stop offset="0.4" stopColor="#ffd27a" stopOpacity="0.45" />
          <stop offset="1" stopColor="#ffd27a" stopOpacity="0" />
        </radialGradient>
        <filter id="tg-soft" x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="6" />
        </filter>
      </defs>

      {/* ground glow + trunk */}
      <ellipse cx={CX} cy={H - 22} rx="210" ry="22" fill="#000" opacity="0.35" filter="url(#tg-soft)" />
      <path d={`M ${CX - 26} ${H - 120} L ${CX + 26} ${H - 120} L ${CX + 32} ${H - 30} L ${CX - 32} ${H - 30} Z`} fill="#3b2416" />
      <path d={`M ${CX - 26} ${H - 120} L ${CX - 4} ${H - 120} L ${CX - 8} ${H - 30} L ${CX - 32} ${H - 30} Z`} fill="#5a3a24" />
      <rect x={CX - 70} y={H - 62} width="140" height="44" rx="6" fill="#8B1E2D" />
      <rect x={CX - 70} y={H - 62} width="140" height="10" rx="4" fill="#a8283a" />
      <rect x={CX - 70} y={H - 62} width="140" height="44" rx="6" fill="none" stroke="#D5B477" strokeOpacity="0.7" strokeWidth="1.5" />

      {/* tiers: bottom first so upper tiers overlap */}
      {[...tiers].reverse().map((t, ri) => {
        const i = tiers.length - 1 - ri;
        const sc = 4 + Math.round(i * 0.6);
        const droop = 14 + i * 1.5;
        return (
          <g key={i} className="tier" style={{ animationDelay: `${(tiers.length - i) * 70}ms` }}>
            <path d={tierPath({ ...t, top: t.top + 14, bottom: t.bottom + 12 }, sc, droop)} fill="#04150f" opacity="0.55" transform="translate(10 4)" />
            <path d={tierPath(t, sc, droop)} fill="url(#tg-branch)" />
            <path d={tierPath(t, sc, droop)} fill="url(#tg-sheen)" />
            <path d={tierPath({ ...t, top: t.top + (t.bottom - t.top) * 0.55 }, sc, droop)} fill="url(#tg-shadow)" opacity="0.7" />
            {/* needle texture strokes */}
            {Array.from({ length: 6 + i }, (_, k) => {
              const f = (k + 0.5) / (6 + i) - 0.5;
              const x = CX + f * t.half * 1.7;
              const y = t.bottom - 8;
              return <path key={k} d={`M ${x} ${y} q ${f * 10} -${22 + i * 2} ${f * 28} -${44 + i * 3}`} stroke="#4fa585" strokeOpacity="0.22" strokeWidth="1.4" fill="none" />;
            })}
            <path d={tierPath(t, sc, droop)} fill="none" stroke="#D5B477" strokeOpacity="0.55" strokeWidth="1.2" />
          </g>
        );
      })}

      {/* garlands of warm lights */}
      {garlands.map((pts, gi) => (
        <g key={gi}>
          <path d={'M ' + pts.map((p) => `${p.x} ${p.y}`).join(' L ')} stroke="#D5B477" strokeOpacity="0.35" strokeWidth="1" fill="none" />
          {lights &&
            pts.map((p, k) =>
              k % 2 === 0 ? (
                <g key={k} className="tw" style={{ animationDelay: `${((gi * 7 + k * 3) % 11) * 0.27}s` }}>
                  <circle cx={p.x} cy={p.y} r="9" fill="url(#tg-glow)" />
                  <circle cx={p.x} cy={p.y} r="2.4" fill="#fff4d0" />
                </g>
              ) : null,
            )}
        </g>
      ))}

      {/* ornaments */}
      {ornaments.map((o, k) => (
        <g key={k}>
          <line x1={o.x} y1={o.y - o.r - 6} x2={o.x} y2={o.y - o.r} stroke="#D5B477" strokeOpacity="0.6" strokeWidth="1" />
          <circle cx={o.x} cy={o.y} r={o.r} fill={`url(#tg-${o.kind})`} />
          <circle cx={o.x - o.r * 0.35} cy={o.y - o.r * 0.38} r={o.r * 0.22} fill="#fff" opacity="0.7" />
        </g>
      ))}

      {/* star */}
      <g className="star" transform={`translate(${CX} 70)`}>
        <circle r="58" fill="url(#tg-glow)" />
        <path d="M0 -40 L9 -11 L40 -11 L15 7 L24 37 L0 19 L-24 37 L-15 7 L-40 -11 L-9 -11 Z" fill="url(#tg-gold)" stroke="#fff3cf" strokeWidth="1.2" />
      </g>
    </svg>
  );
}
