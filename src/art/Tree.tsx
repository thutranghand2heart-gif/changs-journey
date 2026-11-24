import { useMemo } from 'react';

// Original layered SVG Christmas tree — the defining element of the Christmas journey Home.
// Built procedurally: 8 scalloped branch tiers, each with a shadow layer, a
// two-tone emerald gradient, restrained champagne-gold rim, ornaments, warm lights and a star.

const W = 420;
const H = 1000;
const CX = 230;

interface Tier { top: number; bottom: number; half: number }


// Organic evergreen tier: irregular drooping branch tips with fine needle serrations instead of smooth scallops.
function rng(seed: number) {
  let x = seed;
  return () => ((x = (x * 9301 + 49297) % 233280) / 233280);
}
function branchTier(t: Tier, i: number): string {
  const r = rng(101 + i * 37);
  const left = CX - t.half;
  const right = CX + t.half;
  const pts: string[] = [`M ${CX + (r() - 0.5) * 4} ${t.top}`];
  // left flank: short needle clusters stepping outwards
  const steps = 7 + i;
  for (let k = 1; k <= steps; k++) {
    const f = k / steps;
    const y = t.top + (t.bottom - t.top) * f * 0.92;
    const x = CX - t.half * Math.pow(f, 0.85) * 0.96;
    pts.push(`L ${x - 4 - r() * 7} ${y + 2 + r() * 4}`, `L ${x + 3 + r() * 3} ${y - 1}`);
  }
  // hem: drooping branch tips of varied width & length, each tip serrated
  const tips = 4 + Math.round(i * 0.75);
  const seg = (right - left) / tips;
  for (let k = 0; k < tips; k++) {
    const x0 = left + seg * k;
    const w = seg * (0.85 + r() * 0.3);
    const curve = Math.sin(((k + 0.5) / tips) * Math.PI);
    const drop = 16 + i * 2 + curve * (10 + i) + r() * 10;
    const tipX = x0 + w * (0.45 + (r() - 0.5) * 0.2);
    const base = t.bottom - 4 + (1 - curve) * -6;
    // left side of tip with needles
    for (let n = 1; n <= 4; n++) {
      const f = n / 4;
      pts.push(`L ${x0 + (tipX - x0) * f - 2} ${base + drop * f + (n % 2 ? 3 : -2)}`);
    }
    pts.push(`L ${tipX} ${base + drop + 4}`);
    for (let n = 1; n <= 4; n++) {
      const f = n / 4;
      const xe = Math.min(right, x0 + seg);
      pts.push(`L ${tipX + (xe - tipX) * f + 2} ${base + drop * (1 - f) + (n % 2 ? 3 : -3)}`);
    }
  }
  for (let k = steps; k >= 1; k--) {
    const f = k / steps;
    const y = t.top + (t.bottom - t.top) * f * 0.92;
    const x = CX + t.half * Math.pow(f, 0.85) * 0.96;
    pts.push(`L ${x - 3 - r() * 3} ${y - 1}`, `L ${x + 4 + r() * 7} ${y + 2 + r() * 4}`);
  }
  return pts.join(' ') + ' Z';
}
/** Branch spines radiating from the trunk with needle ticks — gives each tier visible structure and depth. */
function fronds(t: Tier, i: number): string {
  const r = rng(7 + i * 13);
  const n = 5 + Math.round(i * 0.8);
  let d = '';
  for (let k = 0; k < n; k++) {
    const f = (k + 0.5) / n - 0.5;
    const x0 = CX + f * 10;
    const y0 = t.top + (t.bottom - t.top) * (0.25 + r() * 0.15);
    const x1 = CX + f * t.half * 1.75;
    const y1 = t.bottom + 6 + Math.cos(f * Math.PI) * (8 + i);
    const cx = (x0 + x1) / 2 + f * 18;
    const cy = Math.min(y0, y1) + (y1 - y0) * 0.35;
    d += `M ${x0} ${y0} Q ${cx} ${cy} ${x1} ${y1} `;
    for (let q = 1; q <= 6; q++) {
      const u = q / 7;
      const px = (1 - u) * (1 - u) * x0 + 2 * (1 - u) * u * cx + u * u * x1;
      const py = (1 - u) * (1 - u) * y0 + 2 * (1 - u) * u * cy + u * u * y1;
      const len = 5 + u * 9;
      d += `M ${px} ${py} l ${-len * 0.55} ${len * 0.8} M ${px} ${py} l ${len * 0.55} ${len * 0.8} `;
    }
  }
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
        return (
          <g key={i} className="tier" style={{ animationDelay: `${(tiers.length - i) * 70}ms` }}>
            <path d={branchTier({ ...t, top: t.top + 14, bottom: t.bottom + 10 }, i + 20)} fill="#04150f" opacity="0.55" transform="translate(9 5)" />
            <path d={branchTier(t, i)} fill="url(#tg-branch)" />
            <path d={branchTier(t, i)} fill="url(#tg-sheen)" />
            <path d={branchTier({ ...t, top: t.top + (t.bottom - t.top) * 0.55 }, i + 40)} fill="url(#tg-shadow)" opacity="0.65" />
            <path d={fronds(t, i)} stroke="#5fb894" strokeOpacity={0.16 + (i % 3) * 0.03} strokeWidth="1.3" strokeLinecap="round" fill="none" />
            <path d={fronds({ ...t, half: t.half * 0.7 }, i + 9)} stroke="#0a2e24" strokeOpacity="0.35" strokeWidth="1.1" strokeLinecap="round" fill="none" transform="translate(0 6)" />
            <path d={branchTier(t, i)} fill="none" stroke="#D5B477" strokeOpacity="0.28" strokeWidth="0.9" strokeLinejoin="round" />
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
