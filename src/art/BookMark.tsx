/** @jsxRuntime automatic */
/** The Illuminated Storybook mark (same artwork as the app icon, approved 22A). */
export function BookMark({ size = 48, bg = true }: { size?: number; bg?: boolean }) {
  return (
    <svg width={size} height={size} viewBox="0 0 512 512" aria-hidden="true">
      <IconArt bg={bg} />
    </svg>
  );
}

export function IconArt({ bg = true }: { bg?: boolean }) {
  return (
    <g>
      <defs>
        <radialGradient id="ic-bg" cx="0.5" cy="0.42" r="0.75">
          <stop offset="0" stopColor="#1a5544" />
          <stop offset="0.6" stopColor="#103B31" />
          <stop offset="1" stopColor="#0a271f" />
        </radialGradient>
        <linearGradient id="ic-pageL" x1="0" x2="1">
          <stop offset="0" stopColor="#efe3cc" />
          <stop offset="1" stopColor="#FFF8EE" />
        </linearGradient>
        <linearGradient id="ic-pageR" x1="0" x2="1">
          <stop offset="0" stopColor="#FFF8EE" />
          <stop offset="1" stopColor="#f1e5cf" />
        </linearGradient>
        <linearGradient id="ic-gold" x1="0" x2="1" y1="0" y2="1">
          <stop offset="0" stopColor="#f3e2b8" />
          <stop offset="0.5" stopColor="#D5B477" />
          <stop offset="1" stopColor="#a98446" />
        </linearGradient>
        <radialGradient id="ic-glow" cx="0.5" cy="0.5" r="0.5">
          <stop offset="0" stopColor="#ffe9b8" stopOpacity="0.8" />
          <stop offset="1" stopColor="#ffe9b8" stopOpacity="0" />
        </radialGradient>
      </defs>
      {bg && <rect width="512" height="512" fill="url(#ic-bg)" />}
      {/* star: width ≈ 12% (62px), sits ≈ 9% (46px) above the book */}
      <circle cx="256" cy="150" r="58" fill="url(#ic-glow)" />
      <path d="M256 119 C260 140 266 146 287 150 C266 154 260 160 256 181 C252 160 246 154 225 150 C246 146 252 140 256 119 Z" fill="url(#ic-gold)" />
      {/* book: width ≈ 68% (348px) */}
      <path d="M82 246 L256 228 L430 246 L430 388 L256 372 L82 388 Z" fill="#071f19" opacity="0.55" transform="translate(0 14)" />
      <path d="M82 238 L256 224 L256 372 L82 386 Z" fill="#8B1E2D" />
      <path d="M430 238 L256 224 L256 372 L430 386 Z" fill="#7a1726" />
      <path d="M94 230 C150 216 214 218 256 236 L256 366 C214 348 150 346 94 360 Z" fill="url(#ic-pageL)" />
      <path d="M256 236 C298 218 362 216 418 230 L418 344 C404 352 392 356 376 360 C342 350 296 350 256 366 Z" fill="url(#ic-pageR)" />
      {/* raised right-hand page corner */}
      <path d="M418 344 C404 352 392 356 376 360 C388 344 398 332 418 318 Z" fill="#e6d6b8" />
      {/* champagne illumination along the page edge */}
      <path d="M256 236 C298 218 362 216 418 230 L418 318" fill="none" stroke="url(#ic-gold)" strokeWidth="5" strokeLinecap="round" />
      <path d="M94 230 C150 216 214 218 256 236" fill="none" stroke="url(#ic-gold)" strokeWidth="3" strokeOpacity="0.8" />
      <line x1="256" y1="236" x2="256" y2="366" stroke="#cdb994" strokeWidth="2" />
      {/* faint text lines */}
      {[262, 284, 306, 328].map((y, i) => (
        <g key={i} stroke="#cdb994" strokeOpacity="0.55" strokeWidth="3" strokeLinecap="round">
          <line x1="120" y1={y - 4} x2="228" y2={y + 4} />
          <line x1="284" y1={y + 4} x2={i === 3 ? 360 : 392} y2={y - 4} />
        </g>
      ))}
    </g>
  );
}
