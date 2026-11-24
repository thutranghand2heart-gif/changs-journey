import { useState } from 'react';
import { LuFileUp, LuShieldCheck } from 'react-icons/lu';
import type { Journey } from '../../db/schema';
import { findExistingImport, importJourney } from '../../db/repo';
import { go, PageHeader, pickFiles, useToast } from '../../ui/core';
import { ImportError, parseJourneyFile, summary, type JourneyBundle } from '../../lib/journeyFile';

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
      setError(e instanceof ImportError ? e.message : 'Không đọc được tệp.');
    }
  };
  const run = async (mode: 'add' | 'copy') => {
    if (!bundle) return;
    setBusy(true);
    try {
      const r = await importJourney(bundle, mode);
      toast(r.status === 'imported' ? 'Đã nhập hành trình vào máy' : 'Đã nhập thành bản sao');
      go(`/j/${r.journeyId}`);
    } catch (e: any) {
      setError(e.message ?? 'Không nhập được');
    } finally {
      setBusy(false);
    }
  };
  const s = bundle && summary(bundle);
  const back = () => (history.length > 1 ? history.back() : go('/'));

  return (
    <div className="page theme-global">
      <PageHeader title="Nhập hành trình riêng tư" back={back} />
      <div className="card small stack-s">
        <p><LuShieldCheck /> Tệp hành trình của bạn chỉ được đọc trên chiếc iPhone này và lưu vào bộ nhớ của ứng dụng. Nó không được tải lên đâu cả. Sau khi nhập một lần, chuyến đi dùng được cả khi offline.</p>
        <p className="muted">Mở bằng biểu tượng trên Màn hình chính rồi mới nhập — Safari và ứng dụng trên Màn hình chính có bộ nhớ riêng.</p>
      </div>
      <button className="btn primary big" onClick={choose}><LuFileUp /> Chọn tệp từ ứng dụng Tệp…</button>
      {error && <p className="error" role="alert">⚠︎ {error}</p>}
      {s && (
        <section className="glass-card stack" aria-label="Xem trước tệp hành trình">
          <h3 className="display">{s.title}</h3>
          <p className="small">{s.dates} · {s.days} ngày · {s.activities} hoạt động · {s.places} địa điểm · {s.docs} giấy tờ · {s.expenses} chi phí</p>
          <p className="ok-text small">✓ Tệp hợp lệ, mã kiểm tra khớp</p>
          {existing ? (
            <>
              <p className="warn-box small">Chuyến đi này đã có trên máy (“{existing.title}”). Nhập lại sẽ không ghi đè lên những gì bạn đã sửa.</p>
              <div className="row gap wrap">
                <button className="btn primary" onClick={() => go(`/j/${existing.id}`)}>Mở chuyến đi đã có</button>
                <button className="btn ghost" disabled={busy} onClick={() => run('copy')}>Nhập thành bản sao</button>
              </div>
            </>
          ) : (
            <button className="btn primary big" disabled={busy} onClick={() => run('add')}>{busy ? 'Đang nhập…' : 'Nhập vào máy'}</button>
          )}
        </section>
      )}
    </div>
  );
}
