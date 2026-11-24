import { useEffect, useState } from 'react';
import { saveSettings } from '../../db/repo';
import { Field, PageHeader, useToast } from '../../ui/core';
import { useApp } from '../../ui/app-context';
import { LanguageList } from '../../ui/Language';
import { APP_VERSION } from '../../ui/UpdateNotice';
import { bytes } from '../../lib/util';
import { t } from '../../lib/i18n';

export function SettingsPage() {
  const { settings } = useApp();
  const toast = useToast();
  const [est, setEst] = useState<{ usage?: number; quota?: number } | null>(null);
  const [persisted, setPersisted] = useState<boolean | null>(null);
  useEffect(() => {
    navigator.storage?.estimate?.().then(setEst).catch(() => {});
    navigator.storage?.persisted?.().then(setPersisted).catch(() => {});
  }, []);

  return (
    <div className="page theme-global">
      <PageHeader title={t('Cài đặt')} back="/" />
      <div className="stack">
        <section className="card">
          <h4>{t('🌐 Ngôn ngữ giao diện')}</h4>
          <LanguageList />
          <p className="xsmall muted">{t('Ngôn ngữ giao diện không tự dịch nội dung bạn tự nhập.')}</p>
          <button className="btn small" data-testid="open-translate" onClick={() => (location.hash = '#/translate')}>{t('Dịch nội dung bạn nhập (4 ngôn ngữ)')}</button>
          <button className="btn small" data-testid="open-artwork" onClick={() => (location.hash = '#/artwork')}>{t('Artwork (Christmas Collection)')}</button>
        </section>
        <Field label={t('Giảm chuyển động')}>
          <select value={settings.reducedMotion} onChange={(e: any) => saveSettings({ reducedMotion: e.target.value })}>
            <option value="system">{t('Theo cài đặt iPhone')}</option>
            <option value="on">{t('Luôn giảm')}</option>
            <option value="off">{t('Không giảm')}</option>
          </select>
        </Field>
        <label className="toggle-row">
          <input type="checkbox" checked={settings.performanceMode} onChange={(e: any) => saveSettings({ performanceMode: e.target.checked })} />
          <span>{t('Chế độ tiết kiệm pin (ít tuyết, không hiệu ứng nặng)')}</span>
        </label>
        <div className="card">
          <h3>{t('Bộ nhớ')}</h3>
          <p className="small">{t('Đã dùng:')}{' '}{est?.usage != null ? bytes(est.usage) : t('không rõ')} {est?.quota ? t('/ hạn mức ước tính {0}', bytes(est.quota)) : ''}</p>
          <p className="small">{t('Lưu trữ bền vững:')}{' '}{persisted == null ? t('trình duyệt không cho biết') : persisted ? t('đã được cấp') : t('chưa được cấp')}</p>
          <button
            className="btn small"
            onClick={async () => {
              if (!navigator.storage?.persist) return toast(t('Trình duyệt không hỗ trợ yêu cầu này'), 'warn');
              const ok = await navigator.storage.persist();
              setPersisted(ok);
              toast(ok ? t('Trình duyệt đã cấp lưu trữ bền vững') : t('Trình duyệt từ chối — hãy sao lưu thường xuyên'), ok ? 'ok' : 'warn');
            }}
          >
            {t('Yêu cầu lưu trữ bền vững')}</button>
          <p className="muted small">{t('Dữ liệu nằm trong bộ nhớ trình duyệt của iPhone. Nó có thể mất khi xóa ứng dụng khỏi Màn hình chính, xóa dữ liệu Safari, đổi máy, hoặc khi iOS dọn bộ nhớ. Hãy tạo bản sao lưu và lưu vào Tệp/iCloud Drive.')}</p>
        </div>
        <p className="muted small center">{t('Những bước chân của Chang · phiên bản')}{' '}{APP_VERSION} {' '}{t('· dữ liệu chỉ lưu trên thiết bị này.')}</p>
      </div>
    </div>
  );
}
