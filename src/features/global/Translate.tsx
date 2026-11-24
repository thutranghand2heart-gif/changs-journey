import { useEffect, useMemo, useState } from 'react';
import type { ContentTranslation, StoreName, TranslationSettings, UiLang } from '../../db/schema';
import * as db from '../../db/idb';
import { getSettings, saveSettings } from '../../db/repo';
import { Confirm, Field, PageHeader, Sheet, pickFiles, queryParam, useLive, useStore, useToast } from '../../ui/core';
import { parseTxFile, planTxImport, type TxImportPlan } from '../../lib/txFile';
import { useApp } from '../../ui/app-context';
import { buildTxMap, CATEGORY_DEFAULTS, collectItems, hashText, LANGS, missingPairs, txId, type TxItem } from '../../lib/contentI18n';
import { runJob } from '../../lib/translate';
import { LANG_NAMES, t, tr } from '../../lib/i18n';
import { loadAllForTranslation } from '../../ui/contentTx';
import { nowIso } from '../../lib/util';

const CATS: { id: string; label: string }[] = [
  { id: 'itinerary', label: tr('Lịch trình, ngày & hoạt động') },
  { id: 'places', label: tr('Địa điểm') },
  { id: 'checklist', label: tr('Checklist') },
  { id: 'food', label: tr('Món ăn') },
  { id: 'budget', label: tr('Chi tiêu') },
  { id: 'poses', label: tr('Ý tưởng tạo dáng') },
  { id: 'wallet', label: tr('Tên giấy tờ trong Ví') },
  { id: 'world', label: tr('Thế giới du lịch') },
  { id: 'memories', label: tr('Kỷ niệm (chỉ những kỷ niệm không riêng tư)') },
];
const STORE_LABEL: Partial<Record<StoreName, string>> = {
  journeys: tr('Hành trình'), days: tr('Ngày'), activities: tr('Hoạt động'), places: tr('Địa điểm'), checklist: tr('Checklist'), memories: tr('Kỷ niệm'),
  food: tr('Món ăn'), expenses: tr('Chi tiêu'), poses: tr('Tạo dáng'), docs: tr('Ví'), world: tr('Thế giới du lịch'),
};
const DAILY = (email?: string) => (email ? 50000 : 5000);

export function TranslatePage() {
  const { settings } = useApp();
  const toast = useToast();
  const jid = queryParam('j');
  const ts: TranslationSettings = settings.translation ?? { auto: false, categories: { ...CATEGORY_DEFAULTS } };
  const cats = { ...CATEGORY_DEFAULTS, ...ts.categories };
  const rows = useStore<ContentTranslation>('translations');
  const map = useMemo(() => buildTxMap(rows), [rows]);
  const [data] = useLive(() => loadAllForTranslation(), [rows.length], null as any);
  const items = useMemo(() => {
    if (!data) return [] as TxItem[];
    const all = collectItems(data, cats);
    return jid ? all.filter((i) => i.journeyId === jid) : all;
  }, [data, JSON.stringify(cats), jid]);
  const missing = useMemo(() => missingPairs(items, map), [items, map]);
  const [online, setOnline] = useState(navigator.onLine);
  const [job, setJob] = useState<{ done: number; total: number; signal: { cancelled: boolean } } | null>(null);
  const [email, setEmail] = useState(ts.email ?? '');
  const [edit, setEdit] = useState<TxItem | null>(null);
  const [revoke, setRevoke] = useState(false);
  const [filter, setFilter] = useState('');
  useEffect(() => {
    const f = () => setOnline(navigator.onLine);
    addEventListener('online', f);
    addEventListener('offline', f);
    return () => (removeEventListener('online', f), removeEventListener('offline', f));
  }, []);

  const save = (patch: Partial<TranslationSettings>) => saveSettings({ translation: { ...ts, categories: cats, ...patch } });
  const today = new Date().toISOString().slice(0, 10);
  const used = ts.usage?.day === today ? ts.usage.chars : 0;

  const perLang = LANGS.map((l) => {
    const need = items.filter((i) => i.srcLang !== l);
    const ok = need.filter((i) => {
      const r = map.get(txId(i.store, i.recordId, i.field, l));
      return r && (r.srcHash === i.srcHash || r.source === 'manual');
    }).length;
    return { l, ok, total: need.length };
  });

  const start = async () => {
    const signal = { cancelled: false };
    setJob({ done: 0, total: missing.length, signal });
    const remaining = Math.max(0, DAILY(ts.email) - used);
    const r = await runJob(missing, {
      email: ts.email,
      save: async (x) => void (await db.put('translations', x, true)),
      onProgress: (done, total) => setJob({ done, total, signal }),
      signal,
      delayMs: 150,
      maxChars: remaining || 1,
    });
    db.notify();
    const cur = (await getSettings()).translation ?? ts;
    await saveSettings({ translation: { ...cur, usage: { day: today, chars: used + r.chars } } });
    setJob(null);
    if (r.stoppedBy === 'quota') toast(t('Đã hết hạn mức dịch miễn phí hôm nay. Đã lưu {0} bản dịch; phần còn lại sẽ dịch sau.', r.done));
    else if (r.stoppedBy === 'offline') toast(t('Mất mạng. Đã lưu {0} bản dịch.', r.done));
    else if (r.stoppedBy === 'cancel') toast(t('Đã dừng. Đã lưu {0} bản dịch.', r.done));
    else if (r.failed) toast(t('Đã lưu {0} bản dịch · {1} mục chưa dịch được (thử lại sau).', r.done, r.failed));
    else toast(t('Đã lưu {0} bản dịch — đọc được cả khi offline.', r.done));
  };

  const [plan, setPlan] = useState<TxImportPlan | null>(null);
  const pickTxFile = async () => {
    const [f] = await pickFiles('.json,application/json');
    if (!f) return;
    try {
      const file = parseTxFile(await f.text());
      const all = await loadAllForTranslation();
      const recs = new Map<string, any>();
      for (const [store, list] of Object.entries(all)) for (const r of list ?? []) recs.set(`${store}|${r.id}`, r);
      setPlan(planTxImport(file, recs, map));
    } catch {
      toast(t('Tệp này không phải tệp bản dịch của ứng dụng.'), 'err');
    }
  };
  const back = () => (history.length > 1 ? history.back() : (location.hash = '#/'));
  const shown = items.filter((i) => !filter || i.text.toLowerCase().includes(filter.toLowerCase())).slice(0, 200);

  return (
    <div className="page theme-global">
      <PageHeader title={t('Dịch nội dung bạn nhập')} sub={online ? t('Đang có mạng') : t('Đang offline')} back={back} />
      <div className="stack">
        <div className="card small">
          <p>{t('Ngôn ngữ giao diện chỉ đổi chữ của ứng dụng. Trang này dịch những gì bạn tự nhập (tên ngày, hoạt động, ghi chú, checklist…) sang Việt · Trung · Anh · Hàn.')}</p>
          <p className="muted">{t('Mỗi bản dịch được lưu ngay trên máy, nên khi offline bạn vẫn đọc được bằng ngôn ngữ đang chọn. Khi bạn sửa bản gốc, bản dịch cũ không được dùng nữa cho đến khi dịch lại.')}</p>
        </div>

        <section className="card" data-testid="tx-status">
          <h4>{t('Tình trạng bản dịch')}</h4>
          {perLang.map((p) => (
            <div key={p.l} className="small" style={{ display: 'flex', justifyContent: 'space-between', gap: 8, padding: '3px 0' }} data-tx-status={p.l}>
              <span>{LANG_NAMES[p.l]}</span>
              <span className={p.ok === p.total ? 'ok-text' : 'muted'}>{p.total ? t('{0}/{1} mục đã có', p.ok, p.total) : '—'}</span>
            </div>
          ))}
          <p className="xsmall muted">{t('{0} mục có thể dịch · bản gốc bằng ngôn ngữ nào thì không cần dịch sang chính ngôn ngữ đó.', items.length)}</p>
        </section>

        {!ts.consentAt ? (
          <section className="card" data-testid="tx-consent">
            <h4>{t('Cần bạn đồng ý trước')}</h4>
            <ul className="small">
              <li>{t('Văn bản được gửi qua Internet tới dịch vụ dịch miễn phí MyMemory (Translated, Ý). Không cần tài khoản hay khóa API.')}</li>
              <li>{t('KHÔNG gửi: kỷ niệm riêng tư, mục đã mã hóa, két riêng tư, thư gửi tương lai, chi tiết đặt chỗ (số vé, mã đặt chỗ, chuyến bay), các ô địa chỉ và tên tiếng Trung, ảnh và tệp.')}</li>
              <li>{t('Ghi chú tự do được gửi nguyên văn — đừng ghi số giấy tờ hay thông tin nhạy cảm vào ghi chú nếu bật dịch.')}</li>
              <li>{t('Hạn mức miễn phí: khoảng 5.000 ký tự/ngày, hoặc 50.000 nếu bạn điền email (email chỉ lưu trên máy và gửi kèm yêu cầu dịch).')}</li>
              <li>{t('Bản dịch máy có thể sai — bạn sửa được từng câu.')}</li>
              <li>{t('Bạn có thể thu hồi đồng ý bất cứ lúc nào.')}</li>
            </ul>
            <button className="btn primary" data-testid="tx-agree" onClick={() => save({ consentAt: nowIso(), auto: true })}>{t('Tôi đồng ý — bật dịch')}</button>
          </section>
        ) : (
          <>
            <section className="card">
              <h4>{t('Dịch')}</h4>
              <p className="xsmall muted">{t('Đã dùng hôm nay: {0}/{1} ký tự', used, DAILY(ts.email))}</p>
              {job ? (
                <div data-testid="tx-progress">
                  <progress max={job.total} value={job.done} style={{ width: '100%' }} />
                  <p className="small">{t('Đang dịch {0}/{1}…', job.done, job.total)}</p>
                  <button className="btn small" onClick={() => (job.signal.cancelled = true)}>{t('Dừng')}</button>
                </div>
              ) : (
                <button className="btn primary" data-testid="tx-run" disabled={!online || !missing.length} onClick={start}>
                  {missing.length ? t('Dịch {0} phần còn thiếu', missing.length) : t('Đã dịch đủ ✓')}
                </button>
              )}
              {!online && <p className="xsmall muted">{t('Cần có mạng để dịch. Các bản dịch đã lưu vẫn đọc được offline.')}</p>}
              <label className="toggle-row">
                <input type="checkbox" checked={ts.auto} onChange={(e: any) => save({ auto: e.target.checked })} />
                <span>{t('Tự động dịch nội dung mới khi có mạng')}</span>
              </label>
            </section>

            <section className="card">
              <h4>{t('Dịch những phần nào')}</h4>
              {CATS.map((c) => (
                <label key={c.id} className="toggle-row">
                  <input type="checkbox" checked={!!cats[c.id]} onChange={(e: any) => save({ categories: { ...cats, [c.id]: e.target.checked } })} />
                  <span>{t(c.label)}</span>
                </label>
              ))}
              <Field label={t('Email (không bắt buộc, để tăng hạn mức)')} hint={t('Chỉ lưu trên máy này.')}>
                <input type="email" value={email} onChange={(e: any) => setEmail(e.target.value)} onBlur={() => save({ email: email.trim() || undefined })} placeholder="you@example.com" />
              </Field>
              <button className="btn small danger" onClick={() => setRevoke(true)}>{t('Thu hồi đồng ý')}</button>
            </section>
          </>
        )}

        <section className="card" data-testid="tx-file">
          <h4>{t('Nhập tệp bản dịch')}</h4>
          <p className="xsmall muted">{t('Dành cho tệp bản dịch riêng (.json) của hành trình bạn. Không cần mạng, không gửi gì đi. Chỉ áp dụng cho nội dung bạn chưa sửa; bản dịch bạn tự sửa được giữ nguyên.')}</p>
          <button className="btn small" data-testid="tx-file-pick" onClick={pickTxFile}>{t('Chọn tệp bản dịch…')}</button>
        </section>

        <section className="card">
          <h4>{t('Sửa bản dịch bằng tay')}</h4>
          <p className="xsmall muted">{t('Không cần mạng. Bản bạn sửa sẽ không bị dịch máy ghi đè.')}</p>
          <input placeholder={t('Tìm…')} value={filter} onChange={(e: any) => setFilter(e.target.value)} />
          <div className="stack-s" style={{ marginTop: 8 }}>
            {shown.map((i) => {
              const have = LANGS.filter((l) => l !== i.srcLang && map.get(txId(i.store, i.recordId, i.field, l))?.srcHash === i.srcHash).length;
              return (
                <button key={`${i.store}|${i.recordId}|${i.field}`} className="list-btn" data-testid="tx-item" onClick={() => setEdit(i)}>
                  <span className="xsmall muted">{t(STORE_LABEL[i.store] ?? i.store)} · {have}/3</span>
                  <span className="block">{i.text.length > 70 ? i.text.slice(0, 70) + '…' : i.text}</span>
                </button>
              );
            })}
            {!items.length && <p className="muted small">{t('Chưa có nội dung nào để dịch.')}</p>}
          </div>
        </section>
      </div>
      <EditSheet item={edit} map={map} onClose={() => setEdit(null)} />
      <Confirm
        open={revoke}
        title={t('Thu hồi đồng ý dịch?')}
        body={t('Ứng dụng sẽ không gửi văn bản đi dịch nữa. Các bản dịch đã lưu vẫn ở trên máy (bạn có thể xóa hết bên dưới).')}
        confirmText={t('Thu hồi')}
        onConfirm={async () => void (await save({ consentAt: undefined, auto: false }))}
        onClose={() => setRevoke(false)}
      />
      <Confirm
        open={!!plan}
        title={t('Nhập bản dịch?')}
        body={plan ? <div className="small" data-testid="tx-file-plan">
          <p>{t('Sẽ lưu {0} bản dịch.', plan.applied)}</p>
          {plan.editedSkipped > 0 && <p>{t('{0} mục bạn đã sửa nên bỏ qua (giữ nguyên nội dung của bạn).', plan.editedSkipped)}</p>}
          {plan.manualKept > 0 && <p>{t('{0} bản dịch bạn tự sửa được giữ nguyên.', plan.manualKept)}</p>}
          {plan.missing > 0 && <p>{t('{0} mục không tìm thấy trong máy.', plan.missing)}</p>}
        </div> : ''}
        confirmText={t('Nhập')}
        onConfirm={async () => {
          if (!plan) return;
          for (const r of plan.rows) await db.put('translations', r, true);
          db.notify();
          toast(t('Đã lưu {0} bản dịch — đọc được cả khi offline.', plan.applied));
        }}
        onClose={() => setPlan(null)}
      />
      {rows.length > 0 && (
        <p className="center">
          <ClearAll />
        </p>
      )}
    </div>
  );
}

function ClearAll() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button className="btn small ghost" onClick={() => setOpen(true)}>{t('Xóa tất cả bản dịch đã lưu')}</button>
      <Confirm
        open={open}
        danger
        title={t('Xóa tất cả bản dịch?')}
        body={t('Chỉ xóa bản dịch; nội dung gốc của bạn giữ nguyên.')}
        onConfirm={async () => {
          for (const r of await db.getAll<ContentTranslation>('translations')) await db.del('translations', r.id);
        }}
        onClose={() => setOpen(false)}
      />
    </>
  );
}

function EditSheet({ item, map, onClose }: { item: TxItem | null; map: ReturnType<typeof buildTxMap>; onClose: () => void }) {
  const [vals, setVals] = useState<Partial<Record<UiLang, string>>>({});
  const toast = useToast();
  useEffect(() => {
    if (!item) return;
    const v: Partial<Record<UiLang, string>> = {};
    for (const l of LANGS) if (l !== item.srcLang) v[l] = map.get(txId(item.store, item.recordId, item.field, l))?.text ?? '';
    setVals(v);
  }, [item]);
  if (!item) return null;
  const saveAll = async () => {
    for (const l of LANGS) {
      if (l === item.srcLang) continue;
      const text = (vals[l] ?? '').trim();
      const id = txId(item.store, item.recordId, item.field, l);
      const prev = map.get(id);
      if (!text) {
        if (prev) await db.del('translations', id);
        continue;
      }
      if (prev && prev.text === text && prev.srcHash === item.srcHash) continue;
      await db.put('translations', { id, journeyId: item.journeyId, store: item.store, recordId: item.recordId, field: item.field, lang: l, text, srcHash: hashText(item.text), srcLang: item.srcLang, source: 'manual', at: nowIso() } satisfies ContentTranslation, true);
    }
    db.notify();
    toast(t('Đã lưu bản dịch trên máy.'));
    onClose();
  };
  return (
    <Sheet open={!!item} onClose={onClose} title={t('Bản dịch')}>
      <div className="stack-s" data-testid="tx-edit">
        <Field label={t('Bản gốc ({0})', LANG_NAMES[item.srcLang])}>
          <textarea readOnly value={item.text} rows={2} />
        </Field>
        {LANGS.filter((l) => l !== item.srcLang).map((l) => (
          <Field key={l} label={LANG_NAMES[l]}>
            <textarea data-tx-lang={l} rows={2} value={vals[l] ?? ''} onChange={(e: any) => setVals({ ...vals, [l]: e.target.value })} />
          </Field>
        ))}
        <button className="btn primary" data-testid="tx-save" onClick={saveAll}>{t('Lưu')}</button>
      </div>
    </Sheet>
  );
}
