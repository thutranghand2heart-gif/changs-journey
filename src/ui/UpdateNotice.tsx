import { useEffect, useState } from 'react';
import { t } from '../lib/i18n';

const KEY = 'chang-installed-version';
export const APP_VERSION: string = __APP_VERSION__;

/** Shows once after an update: "Updated to version X". Also offers a reload when a newer version took over a running app. */
export function UpdateNotice() {
  const [msg, setMsg] = useState<'installed' | 'waiting' | null>(null);
  const [prev, setPrev] = useState<string | null>(null);
  useEffect(() => {
    try {
      // v1.0.0 never stored its version: the v1→v2 database upgrade marks that we came from it.
      const p = localStorage.getItem(KEY) ?? (localStorage.getItem('chang-db-upgraded-from') === '1' ? '1.0.0' : null);
      if (p && p !== APP_VERSION) (setPrev(p), setMsg('installed'));
      localStorage.removeItem('chang-db-upgraded-from');
      localStorage.setItem(KEY, APP_VERSION);
    } catch { /* storage unavailable */ }
    const f = () => setMsg('waiting');
    addEventListener('chang-sw-updated', f);
    return () => removeEventListener('chang-sw-updated', f);
  }, []);
  useEffect(() => {
    if (msg !== 'installed') return;
    const tm = setTimeout(() => setMsg(null), 9000);
    return () => clearTimeout(tm);
  }, [msg]);
  if (!msg) return null;
  return (
    <div className="update-banner" role="status" data-testid="update-notice">
      {msg === 'installed' ? (
        <span>✨ {t('Đã cập nhật lên phiên bản {0}', APP_VERSION)}{prev ? ` (${t('trước đó: {0}', prev)})` : ''}. {t('Dữ liệu của bạn được giữ nguyên.')}</span>
      ) : (
        <span>✨ {t('Có phiên bản mới. Mở lại để dùng bản mới nhất.')}</span>
      )}
      {msg === 'waiting' && <button className="btn small" onClick={() => location.reload()}>{t('Mở lại')}</button>}
      <button className="icon-btn" aria-label={t('Đóng')} onClick={() => setMsg(null)}>×</button>
    </div>
  );
}
