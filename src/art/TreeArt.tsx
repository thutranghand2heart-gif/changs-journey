import type { Journey } from '../db/schema';
import { useArtUrl } from '../ui/art';
import { ChristmasTree } from './Tree';

// Warm light points over the official tree artwork (relative x, y, size) — an independent animated layer;
// the image file itself is never altered.
const LIGHTS: [number, number, number][] = [
  [0.485, 0.055, 0.16], [0.535, 0.24, 0.07], [0.245, 0.425, 0.07], [0.785, 0.655, 0.08], [0.815, 0.815, 0.08],
  [0.405, 0.69, 0.09], [0.58, 0.745, 0.06], [0.33, 0.6, 0.04], [0.66, 0.5, 0.04], [0.45, 0.35, 0.035], [0.7, 0.3, 0.035],
];

/** Official "Chang's Tree of Wanderlust" when imported; otherwise the built-in SVG tree. */
export function JourneyTree({ journey: j, animate, lights }: { journey: Journey; animate: boolean; lights: boolean }) {
  const url = useArtUrl('tree', 'disp');
  if (!url) return <ChristmasTree animate={animate} lights={lights} />;
  const ta = j.settings.treeArt ?? {};
  return (
    <div className={`tree-art ${animate ? 'animated' : ''}`} style={{ transform: `translate(${ta.dx ?? 0}%, ${ta.dy ?? 0}%)` }} data-testid="tree-art">
      <img src={url} alt="" draggable={false} decoding="async" />
      {lights && (
        <div className="tree-lights" aria-hidden="true">
          {LIGHTS.map(([x, y, s], i) => (
            <span key={i} style={{ left: `${x * 100}%`, top: `${y * 100}%`, width: `${s * 100}%`, animationDelay: `${(i * 0.37) % 2.6}s` }} />
          ))}
        </div>
      )}
    </div>
  );
}
