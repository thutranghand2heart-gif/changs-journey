import { useEffect, useState } from 'react';
import type { Memory } from '../../db/schema';
import { onVault, readPrivateMemory, vaultUnlocked } from '../../lib/vault';

export function escapeHtml(s: string) {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
}
/** Tiny, safe markup: **bold**, _italic_, line breaks. Input is escaped first. */
export function renderMarkup(s: string): string {
  return escapeHtml(s)
    .replace(/\*\*(.+?)\*\*/g, '<b>$1</b>')
    .replace(/(^|\W)_(.+?)_(?=\W|$)/g, '$1<i>$2</i>')
    .replace(/\n/g, '<br/>');
}
export function Markup({ text, className }: { text: string; className?: string }) {
  return <div className={className} dangerouslySetInnerHTML={{ __html: renderMarkup(text) }} />;
}

export function useVaultOpen() {
  const [v, setV] = useState(vaultUnlocked());
  useEffect(() => onVault(() => setV(vaultUnlocked())), []);
  return v;
}

/** Returns readable title/body; null while locked. */
export function useMemoryText(m: Memory): { title: string; body: string } | null {
  const open = useVaultOpen();
  const [txt, setTxt] = useState<{ title: string; body: string } | null>(m.encrypted ? null : { title: m.title, body: m.body });
  useEffect(() => {
    if (!m.encrypted) return setTxt({ title: m.title, body: m.body });
    if (!open) return setTxt(null);
    readPrivateMemory(m).then(setTxt).catch(() => setTxt(null));
  }, [m.id, m.updatedAt, open]);
  return txt;
}
