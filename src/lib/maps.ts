import type { Place } from '../db/schema';

/** Amap (高德地图) web URI — opens the Amap app if installed, otherwise the Amap web page. Needs Internet. */
export function amapUrl(p: Pick<Place, 'nameZh' | 'addressZh' | 'name'>): string {
  const kw = p.addressZh || p.nameZh || p.name;
  return `https://uri.amap.com/search?keyword=${encodeURIComponent(kw)}&callnative=1`;
}
export function appleMapsUrl(p: Pick<Place, 'nameZh' | 'addressZh' | 'name' | 'lat' | 'lng'>): string {
  const q = p.addressZh || p.nameZh || p.name;
  return `https://maps.apple.com/?q=${encodeURIComponent(q)}${p.lat ? `&ll=${p.lat},${p.lng}` : ''}`;
}
