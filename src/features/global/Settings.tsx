import { useEffect, useState } from 'react';
import { saveSettings } from '../../db/repo';
import { Field, PageHeader, useToast } from '../../ui/core';
import { useApp } from '../../ui/app-context';
import { LANG_NAMES, type Lang } from '../../lib/i18n';
import { bytes } from '../../lib/util';

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
      <PageHeader title="Cài đặt" back="/" />
      <div className="stack">
        <Field label="Ngôn ngữ giao diện" hint="Nội dung lịch trình giữ nguyên tiếng Việt + tiếng Trung. Bản dịch giao diện hiện bao phủ các mục chính.">
          <select value={settings.language} onChange={(e: any) => saveSettings({ language: e.target.value as Lang })}>
            {(Object.keys(LANG_NAMES) as Lang[]).map((l) => <option key={l} value={l}>{LANG_NAMES[l]}</option>)}
          </select>
        </Field>
        <Field label="Giảm chuyển động">
          <select value={settings.reducedMotion} onChange={(e: any) => saveSettings({ reducedMotion: e.target.value })}>
            <option value="system">Theo cài đặt iPhone</option>
            <option value="on">Luôn giảm</option>
            <option value="off">Không giảm</option>
          </select>
        </Field>
        <label className="toggle-row">
          <input type="checkbox" checked={settings.performanceMode} onChange={(e: any) => saveSettings({ performanceMode: e.target.checked })} />
          <span>Chế độ tiết kiệm pin (ít tuyết, không hiệu ứng nặng)</span>
        </label>
        <div className="card">
          <h3>Bộ nhớ</h3>
          <p className="small">Đã dùng: {est?.usage != null ? bytes(est.usage) : 'không rõ'} {est?.quota ? `/ hạn mức ước tính ${bytes(est.quota)}` : ''}</p>
          <p className="small">Lưu trữ bền vững: {persisted == null ? 'trình duyệt không cho biết' : persisted ? 'đã được cấp' : 'chưa được cấp'}</p>
          <button
            className="btn small"
            onClick={async () => {
              if (!navigator.storage?.persist) return toast('Trình duyệt không hỗ trợ yêu cầu này', 'warn');
              const ok = await navigator.storage.persist();
              setPersisted(ok);
              toast(ok ? 'Trình duyệt đã cấp lưu trữ bền vững' : 'Trình duyệt từ chối — hãy sao lưu thường xuyên', ok ? 'ok' : 'warn');
            }}
          >
            Yêu cầu lưu trữ bền vững
          </button>
          <p className="muted small">Dữ liệu nằm trong bộ nhớ trình duyệt của iPhone. Nó có thể mất khi xóa ứng dụng khỏi Màn hình chính, xóa dữ liệu Safari, đổi máy, hoặc khi iOS dọn bộ nhớ. Hãy tạo bản sao lưu và lưu vào Tệp/iCloud Drive.</p>
        </div>
        <p className="muted small center">Những bước chân của Chang · bản thử nghiệm 1.0 · dữ liệu chỉ lưu trên thiết bị này.</p>
      </div>
    </div>
  );
}
