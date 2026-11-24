import { Fragment, useLayoutEffect, useRef, useState } from 'react';
import type { Lang } from '../lib/i18n';

/**
 * Title line-breaking per language — presentation only, the text itself is never changed.
 * • zh: break only between words (Intl.Segmenter) so a single character (e.g. “记”) never sits alone on a line;
 *   CSS keeps CJK runs together (word-break: keep-all) and balances the lines (text-wrap: balance).
 * • ko: Korean wraps between space-separated words (keep-all), balanced.
 * • vi / en: normal word wrapping, balanced, no hyphenation; a short last word is kept with the one before it.
 * • all: if the title would need more than 3 lines (or a word would not fit), the font steps down a little — never below 22px.
 */
const segCache = new Map<string, string[]>();
export function titleSegments(text: string, lang: Lang): string[] {
  if (lang !== 'zh' || !/[\u3400-\u9fff]/.test(text)) {
    // Latin / Hangul: no orphaned short last word — glue it to the previous word with a no-break space.
    const m = /^(.*\S)\s+(\S{1,4})$/.exec(text.trim());
    return [m && m[1].includes(' ') ? `${m[1]} ${m[2]}` : text];
  }
  const k = text;
  const hit = segCache.get(k);
  if (hit) return hit;
  let out: string[] = [text];
  try {
    const Seg = (Intl as any).Segmenter;
    if (Seg) {
      const words = [...new Seg('zh', { granularity: 'word' }).segment(text)].map((s: any) => s.segment as string);
      // Glue 1-character pieces to a neighbour so no line can start or end with an orphaned single character.
      const merged: string[] = [];
      for (const w of words) {
        const cjk1 = w.length === 1 && /[\u3400-\u9fff]/.test(w);
        if (cjk1 && merged.length) merged[merged.length - 1] += w;
        else merged.push(w);
      }
      if (merged.length > 1 && merged[0].length === 1 && /[\u3400-\u9fff]/.test(merged[0])) merged.splice(0, 2, merged[0] + merged[1]);
      out = merged;
    } else if (text.length >= 4) {
      const h = Math.ceil(text.length / 2); // no segmenter: split into two even halves
      out = [text.slice(0, h), text.slice(h)];
    }
  } catch { /* keep whole */ }
  segCache.set(k, out);
  return out;
}

export function BalancedTitle({ text, lang, maxLines = 3 }: { text: string; lang: Lang; maxLines?: number }) {
  const parts = titleSegments(text, lang);
  const ref = useRef<HTMLSpanElement | null>(null);
  const [width, setWidth] = useState(0);
  useLayoutEffect(() => {
    const h = ref.current?.parentElement;
    if (!h) return;
    const ro = new ResizeObserver(() => setWidth(h.clientWidth));
    ro.observe(h);
    return () => ro.disconnect();
  }, []);
  useLayoutEffect(() => {
    const span = ref.current;
    const h = span?.parentElement;
    if (!span || !h) return;
    h.style.fontSize = '';
    let fs = parseFloat(getComputedStyle(h).fontSize) || 32;
    for (let i = 0; i < 14; i++) {
      const lh = parseFloat(getComputedStyle(h).lineHeight) || fs * 1.05;
      const lines = Math.round(span.getBoundingClientRect().height / lh) || 1;
      const over = h.scrollWidth > h.clientWidth + 1;
      if ((!over && lines <= maxLines) || fs <= 22) break;
      fs = Math.max(22, fs - 1.5);
      h.style.fontSize = `${fs}px`;
    }
  }, [text, lang, width, maxLines]);
  return (
    <span ref={ref} className={`bt bt-${lang}`} lang={lang === 'zh' ? 'zh-CN' : lang}>
      {parts.map((p, i) => <Fragment key={i}>{i > 0 && <wbr />}{p}</Fragment>)}
    </span>
  );
}
