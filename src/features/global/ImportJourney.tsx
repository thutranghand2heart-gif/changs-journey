import { useState } from 'react';
import { LuFileUp, LuShieldCheck } from 'react-icons/lu';
import type { Journey } from '../../db/schema';
import { findExistingImport, importJourney } from '../../db/repo';
import { go, PageHeader, pickFiles, useToast } from '../../ui/core';
import { ImportError, parseJourneyFile, summary, type JourneyBundle } from '../../lib/journeyFile';
import { t } from '../../lib/i18n';

export function ImportJourneyPage() {
  const toast = useToast();
  const [bundle, setBundle] = useState<JourneyBundle | null>(null);
  const [existing, setExisting] = useState<Journey | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const choose = async () => {
    setError(null);
    setBundle(null);
    const [f] = await pickFiles('.json,.changjourney,application/json,text/plain,*/*');
    if (!f) return;
    try {
      const b = await parseJourneyFile(await f.text());
      setExisting(await findExistingImport(b));
      setBundle(b);
    } catch (e: any) {
      setError(e instanceof ImportError ? e.message : t('Không đọc được tệp.'));
    }
  };
  const run = async (mode: 'add' | 'copy') => {
    if (!bundle) return;
    setBusy(true);
    try {
      const r = await importJourney(bundle, mode);
      toast(r.status === 'imported' ? t('Đã nhập hành trình vào máy') : t('Đã nhập thành bản sao'));
      go(`/j/${r.journeyId}`);
    } catch (e: any) {
      setError(e.message ?? t('Không nhập được'));
    } finally {
      setBusy(false);
    }
  };
  const s = bundle && summary(bundle);
  const back = () => (history.length > 1 ? history.back() : go('/'));

  return (
    <div className="page theme-global">
      <PageHeader title={t('Nhập hành trình riêng tư')} back={back} />
      <div className="card small stack-s">
        <p><LuShieldCheck /> {' '}{t('Tệp hành trình của bạn chỉ được đọc trên chiếc iPhone này và lưu vào bộ nhớ của ứng dụng. Nó không được tải lên đâu cả. Sau khi nhập một lần, chuyến đi dùng được cả khi offline.')}</p>
        <p className="muted">{t('Mở bằng biểu tượng trên Màn hình chính rồi mới nhập — Safari và ứng dụng trên Màn hình chính có bộ nhớ riêng.')}</p>
      </div>
      <button className="btn primary big" onClick={choose}><LuFileUp /> {' '}{t('Chọn tệp từ ứng dụng Tệp…')}</button>
      {error && <p className="error" role="alert">⚠︎ {error}</p>}
      {s && (
        <section className="glass-card stack" aria-label={t('Xem trước tệp hành trình')}>
          <h3 className="display">{s.title}</h3>
          <p className="small">{s.dates} · {s.days} {' '}{t('ngày ·')}{' '}{s.activities} {' '}{t('hoạt động ·')}{' '}{s.places} {' '}{t('địa điểm ·')}{' '}{s.docs} {' '}{t('giấy tờ ·')}{' '}{s.expenses} {' '}{t('chi phí')}</p>
          <p className="ok-text small">{t('✓ Tệp hợp lệ, mã kiểm tra khớp')}</p>
          {existing ? (
            <>
              <p className="warn-box small">{t('Chuyến đi này đã có trên máy (“')}{existing.title}{t('”). Nhập lại sẽ không ghi đè lên những gì bạn đã sửa.')}</p>
              <div className="row gap wrap">
                <button className="btn primary" onClick={() => go(`/j/${existing.id}`)}>{t('Mở chuyến đi đã có')}</button>
                <button className="btn ghost" disabled={busy} onClick={() => run('copy')}>{t('Nhập thành bản sao')}</button>
              </div>
            </>
          ) : (
            <button className="btn primary big" disabled={busy} onClick={() => run('add')}>{busy ? t('Đang nhập…') : t('Nhập vào máy')}</button>
          )}
        </section>
      )}
    </div>
  );
}
