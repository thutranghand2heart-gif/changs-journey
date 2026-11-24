import { createPortal } from 'react-dom';
import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { onChange } from '../db/idb';
import * as db from '../db/idb';
import type { StoreName } from '../db/schema';
import { readBlob } from '../db/repo';
import { readEncryptedBlob, vaultUnlocked } from '../lib/vault';
import { LuX, LuChevronLeft } from 'react-icons/lu';
import { t } from '../lib/i18n';

// ───────── Router (hash based: works from any static host and from the Home Screen)
export function useRoute(): string[] {
  const [h, setH] = useState(() => location.hash);
  useEffect(() => {
    const f = () => setH(location.hash);
    addEventListener('hashchange', f);
    return () => removeEventListener('hashchange', f);
  }, []);
  return h.replace(/^#\/?/, '').split('?')[0].split('/').filter(Boolean).map(decodeURIComponent);
}
export const go = (path: string) => {
  location.hash = path.startsWith('#') ? path : '#' + path;
};
export function queryParam(k: string): string | null {
  const q = location.hash.split('?')[1];
  return q ? new URLSearchParams(q).get(k) : null;
}

// ───────── Live queries: re-run whenever the database changes
export function useLive<T>(fn: () => Promise<T>, deps: readonly unknown[], init: T): [T, boolean, string | null] {
  const [v, setV] = useState<T>(init);
  const [loaded, setLoaded] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    const run = () =>
      fn()
        .then((r) => alive && (setV(r), setLoaded(true), setErr(null)))
        .catch((e) => alive && (setErr(String(e?.message ?? e)), setLoaded(true)));
    run();
    const off = onChange(run);
    return () => {
      alive = false;
      off();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
  return [v, loaded, err];
}
export function useStore<T>(store: StoreName, journeyId?: string): T[] {
  return useLive(() => db.getAll<T>(store, journeyId), [store, journeyId], [] as T[])[0];
}

// ───────── Toasts (only for things that really happened)
type Toast = { id: number; text: string; tone: 'ok' | 'warn' | 'err' };
const ToastCtx = createContext<(text: string, tone?: Toast['tone']) => void>(() => {});
export const useToast = () => useContext(ToastCtx);
export function ToastHost({ children }: { children: ReactNode }) {
  const [list, setList] = useState<Toast[]>([]);
  const push = (text: string, tone: Toast['tone'] = 'ok') => {
    const id = Date.now() + Math.random();
    setList((l) => [...l, { id, text, tone }]);
    setTimeout(() => setList((l) => l.filter((x) => x.id !== id)), 3200);
  };
  return (
    <ToastCtx.Provider value={push}>
      {children}
      <div className="toasts" role="status" aria-live="polite">
        {list.map((x) => (
          <div key={x.id} className={`toast toast-${x.tone}`}>{x.text}</div>
        ))}
      </div>
    </ToastCtx.Provider>
  );
}

// ───────── Scroll lock with a counter, so nested overlays (sheet → viewer) never unlock each other
let scrollLocks = 0;
export function lockScroll() {
  scrollLocks++;
  document.body.classList.add('no-scroll');
}
export function unlockScroll() {
  scrollLocks = Math.max(0, scrollLocks - 1);
  if (!scrollLocks) document.body.classList.remove('no-scroll');
}

// ───────── Layout pieces
export function PageHeader({ title, sub, back, right }: { title: ReactNode; sub?: ReactNode; back?: string | (() => void); right?: ReactNode }) {
  return (
    <header className="page-head">
      {back !== undefined && (
        <button className="icon-btn" aria-label={t('Quay lại')} onClick={() => (typeof back === 'function' ? back() : go(back))}>
          <LuChevronLeft size={22} />
        </button>
      )}
      <div className="page-head-text">
        <h1>{title}</h1>
        {sub && <p className="muted small">{sub}</p>}
      </div>
      {right && <div className="page-head-right">{right}</div>}
    </header>
  );
}

const THEME_VARS = ['--bg', '--bg2', '--card', '--card-border', '--text', '--muted', '--accent', '--accent2', '--display'];
export function Sheet({ open, onClose, title, children, full }: { open: boolean; onClose: () => void; title?: ReactNode; children: ReactNode; full?: boolean }) {
  const ref = useRef<HTMLDivElement | null>(null);
  const start = useRef<number | null>(null);
  const [dy, setDy] = useState(0);
  const anchor = useRef<HTMLSpanElement | null>(null);
  const [vars, setVars] = useState<Record<string, string>>({});
  useEffect(() => {
    if (!open || !anchor.current?.parentElement) return;
    // the sheet is portalled to <body>; carry over the journey theme colours from where it was opened
    const cs = getComputedStyle(anchor.current.parentElement);
    const v: Record<string, string> = {};
    for (const k of THEME_VARS) { const x = cs.getPropertyValue(k).trim(); if (x) v[k] = x; }
    setVars(v);
  }, [open]);
  useEffect(() => {
    if (!open) return;
    const k = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    addEventListener('keydown', k);
    lockScroll();
    return () => {
      removeEventListener('keydown', k);
      unlockScroll();
    };
  }, [open]);
  if (!open) return null;
  // Portal to <body>: a sheet opened from inside another sheet (e.g. a confirm) must not be clipped by its parent.
  return (
    <>
    <span ref={anchor} hidden />
    {createPortal(
    <div className="sheet-backdrop" style={vars} onClick={onClose}>
      <div
        ref={ref}
        className={`sheet ${full ? 'sheet-full' : ''}`}
        role="dialog"
        aria-modal="true"
        style={dy ? { transform: `translateY(${dy}px)` } : undefined}
        onClick={(e: Event) => e.stopPropagation()}
      >
        <div
          className="sheet-grip"
          onTouchStart={(e: TouchEvent) => (start.current = e.touches[0].clientY)}
          onTouchMove={(e: TouchEvent) => start.current != null && setDy(Math.max(0, e.touches[0].clientY - start.current))}
          onTouchEnd={() => {
            if (dy > 110) onClose();
            setDy(0);
            start.current = null;
          }}
        >
          <span />
        </div>
        <div className="sheet-head">
          <h2>{title}</h2>
          <button className="icon-btn" aria-label={t('Đóng')} onClick={onClose}>
            <LuX size={22} />
          </button>
        </div>
        <div className="sheet-body">{children}</div>
      </div>
    </div>,
    document.body,
  )}
    </>
  );
}

export function Confirm({ open, title, body, danger, confirmText = t('Xác nhận'), typed, onConfirm, onClose }: { open: boolean; title: string; body: ReactNode; danger?: boolean; confirmText?: string; typed?: string; onConfirm: () => void | Promise<void>; onClose: () => void }) {
  const [v, setV] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => setV(''), [open]);
  return (
    <Sheet open={open} onClose={onClose} title={title}>
      <div className="stack">
        <div>{body}</div>
        {typed && (
          <label className="field">
            <span>{t('Gõ')}{' '}<b>{typed}</b> {' '}{t('để xác nhận')}</span>
            <input value={v} onInput={(e: any) => setV(e.target.value)} autoCapitalize="off" autoCorrect="off" />
          </label>
        )}
        <div className="row gap">
          <button className="btn ghost" onClick={onClose}>{t('Hủy')}</button>
          <button
            className={`btn ${danger ? 'danger' : 'primary'}`}
            disabled={busy || (!!typed && v.trim() !== typed)}
            onClick={async () => {
              setBusy(true);
              try {
                await onConfirm();
                onClose();
              } finally {
                setBusy(false);
              }
            }}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </Sheet>
  );
}

// ───────── Blob images (object URLs from IndexedDB; decrypts when vault unlocked)
export function useBlobUrl(id?: string): { url: string | null; state: 'loading' | 'ok' | 'missing' | 'locked'; mime?: string } {
  const [st, setSt] = useState<{ url: string | null; state: 'loading' | 'ok' | 'missing' | 'locked'; mime?: string }>({ url: null, state: 'loading' });
  useEffect(() => {
    if (!id) return setSt({ url: null, state: 'missing' });
    let url: string | null = null;
    let alive = true;
    (async () => {
      const r = await readBlob(id);
      if (!r) return alive && setSt({ url: null, state: 'missing' });
      let blob = r.blob;
      if (r.rec.encrypted) {
        if (!vaultUnlocked()) return alive && setSt({ url: null, state: 'locked' });
        const b = await readEncryptedBlob(id).catch(() => null);
        if (!b) return alive && setSt({ url: null, state: 'missing' });
        blob = b;
      }
      url = URL.createObjectURL(blob);
      if (alive) setSt({ url, state: 'ok', mime: r.rec.mime });
    })().catch(() => alive && setSt({ url: null, state: 'missing' }));
    return () => {
      alive = false;
      if (url) URL.revokeObjectURL(url);
    };
  }, [id]);
  return st;
}
export function BlobImg({ id, alt = '', className, style, onClick }: { id: string; alt?: string; className?: string; style?: any; onClick?: () => void }) {
  const { url, state } = useBlobUrl(id);
  if (state === 'locked') return <div className={`img-ph ${className ?? ''}`} style={style}>🔒</div>;
  if (state === 'missing') return <div className={`img-ph ${className ?? ''}`} style={style} title={t('Không tìm thấy ảnh')}>⚠︎</div>;
  if (!url) return <div className={`img-ph ${className ?? ''}`} style={style} />;
  return <img src={url} alt={alt} className={className} style={style} onClick={onClick} loading="lazy" decoding="async" />;
}

export function Field({ label, children, hint }: { label: string; children: ReactNode; hint?: ReactNode }) {
  return (
    <label className="field">
      <span>{label}</span>
      {children}
      {hint && <small className="muted">{hint}</small>}
    </label>
  );
}

export function Empty({ icon, text, children }: { icon?: ReactNode; text: ReactNode; children?: ReactNode }) {
  return (
    <div className="empty">
      {icon && <div className="empty-icon">{icon}</div>}
      <p>{text}</p>
      {children}
    </div>
  );
}

/** File picker that resolves once with chosen files. */
export function pickFiles(accept: string, multiple = false): Promise<File[]> {
  return new Promise((resolve) => {
    const i = document.createElement('input');
    i.type = 'file';
    i.accept = accept;
    i.multiple = multiple;
    i.style.display = 'none';
    i.onchange = () => {
      resolve(Array.from(i.files ?? []));
      i.remove();
    };
    document.body.appendChild(i);
    i.click();
  });
}
