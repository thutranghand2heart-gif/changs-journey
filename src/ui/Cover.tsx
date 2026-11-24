import type { Journey } from '../db/schema';
import { ChristmasTree } from '../art/Tree';
import { useArtUrl } from './art';

/** Official diary cover for the Christmas journey (falls back to the built-in tree). Never stretched. */
export function JourneyCover({ journey: j, small }: { journey: Journey; small?: boolean }) {
  const url = useArtUrl('cover', small ? 'thumb' : 'disp');
  if (j.settings.theme !== 'christmas-emerald' || !url) return small ? null : <ChristmasTree animate lights />;
  return <img className="diary-cover" src={url} alt="" draggable={false} decoding="async" data-testid="diary-cover" />;
}
