import type { ReactNode } from 'react';
import { artBlob, getArtwork, type ArtAsset, type ArtVariant, type ArtworkState } from '../lib/artwork';
import { useBlobUrl, useLive } from './core';

const EMPTY: ArtworkState = { id: 'artwork', assets: {} };
export function useArtwork(): ArtworkState {
  return useLive(getArtwork, [], EMPTY)[0];
}
export function useArt(id: string): ArtAsset | undefined {
  return useArtwork().assets[id];
}
/** Object URL for an asset variant (display version by default). */
export function useArtUrl(id: string, v: ArtVariant = 'disp'): string | null {
  const a = useArt(id);
  return useBlobUrl(artBlob(a, v)).url;
}

/** Artwork image, exactly as imported (object-fit: contain, never stretched). Lazy-decoded. */
export function ArtImg({ id, v = 'disp', className = '', alt = '', style, fallback = null }: { id: string; v?: ArtVariant; className?: string; alt?: string; style?: any; fallback?: ReactNode }) {
  const url = useArtUrl(id, v);
  if (!url) return <>{fallback}</>;
  return <img src={url} alt={alt} className={`art-img ${className}`} style={style} loading="lazy" decoding="async" draggable={false} />;
}

/** Signature icon (Christmas Emerald) with an elegant line-icon fallback when the artwork isn't imported. */
export function ArtIcon({ id, fallback, size = 28, active }: { id: string; fallback: ReactNode; size?: number; active?: boolean }) {
  const url = useArtUrl(`icon-${id}`, 'disp');
  if (!url) return <>{fallback}</>;
  return <img src={url} alt="" className={`art-icon ${active === undefined ? '' : active ? 'on' : 'off'}`} style={{ width: size, height: size }} draggable={false} decoding="async" />;
}
