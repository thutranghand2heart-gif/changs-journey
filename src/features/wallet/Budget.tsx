import { useState } from 'react';
import { LuPlus } from 'react-icons/lu';
import type { Expense, ExpenseCategory, Payment } from '../../db/schema';
import { db, saveFileAsBlob, updateJourneySettings } from '../../db/repo';
import { BlobImg, Confirm, Field, PageHeader, pickFiles, queryParam, Sheet, useStore, useToast } from '../../ui/core';
import { useJourney } from '../journey/JourneyShell';
import { CATEGORY_LABEL, PAYSTATE_LABEL, paidOf, payState, remainingOf, summarize } from '../../lib/budget';
import { fmtMoney, nowIso, uid } from '../../lib/util';
import { locale, t } from '../../lib/i18n';
import { Tx } from '../../ui/contentTx';

export function BudgetPage() {
  const { journey: j, days, activities } = useJourney();
  const expenses = useStore<Expense>('expenses', j.id);
  const [open, setOpen] = useState<string | null>(queryParam('e'));
  const [creating, setCreating] = useState(false);
  const [view, setView] = useState<'list' | 'cat' | 'day'>('list');
  const sum = summarize(expenses, j.currency);
  const other = expenses.filter((e) => e.currency !== j.currency);
  const sel = expenses.find((e) => e.id === open);
  const rates = j.settings.exchangeRates ?? {};

  return (
    <div className="page">
      <PageHeader title={t('Ngân sách')} sub={t('Tiền tệ chính: {0}', j.currency)} back={`/j/${j.id}/wallet`} right={<button className="icon-btn" aria-label={t('Thêm chi phí')} onClick={() => setCreating(true)}><LuPlus size={20} /></button>} />
      <div className="glass-card budget-sum">
        <div><span className="muted xsmall">{t('ĐÃ CHI THỰC TẾ')}</span><b className="big-num" data-testid="paid-total">{fmtMoney(sum.paid, j.currency)}</b></div>
        <div><span className="muted xsmall">{t('DỰ KIẾN (gồm ước tính)')}</span><b data-testid="planned-total">{fmtMoney(sum.plannedLow, j.currency)}{sum.plannedHigh !== sum.plannedLow ? ` – ${fmtMoney(sum.plannedHigh, j.currency)}` : ''}</b></div>
        <div><span className="muted xsmall">{t('CÒN PHẢI TRẢ (theo ước tính)')}</span><b>{fmtMoney(sum.outstandingLow, j.currency)}</b></div>
        <p className="muted xsmall">{t('Ước tính không bao giờ được tính là đã trả. Tiền cọc là một phần của giá — không cộng thêm. Mỗi chi phí chỉ là một bản ghi duy nhất dù hiện ở nhiều nơi.')}</p>
        <Conversions amount={sum.paid} rates={rates} base={j.currency} />
      </div>
      <div className="seg">
        {[['list', t('Danh sách')], ['cat', t('Theo loại')], ['day', t('Theo ngày')]].map(([k, l]) => <button key={k} className={view === k ? 'on' : ''} onClick={() => setView(k as any)}>{l}</button>)}
      </div>
      {view === 'list' && (
        <div className="stack-s">
          {expenses.map((e) => (
            <button key={e.id} className="list-row glass-card" onClick={() => setOpen(e.id)}>
              <span className="grow">
                <b><Tx s="expenses" r={e} f="title" /></b>
                <span className="muted xsmall block">{t(CATEGORY_LABEL[e.category])} · {t(PAYSTATE_LABEL[payState(e)])}{e.dayId ? t(' · Ngày {0}', days.find((d) => d.id === e.dayId)?.index ?? '?') : ''}</span>
              </span>
              <span className="text-right small">
                {e.estimate != null && <span className="muted block">{t('ƯT')}{' '}{fmtMoney(e.estimate, e.currency)}{e.estimateHigh ? `–${fmtMoney(e.estimateHigh, e.currency)}` : ''}</span>}
                <b>{fmtMoney(paidOf(e), e.currency)}</b>
              </span>
            </button>
          ))}
          {!expenses.length && <p className="muted center">{t('Chưa có chi phí.')}</p>}
        </div>
      )}
      {view === 'cat' && (
        <div className="stack-s">
          {Object.entries(sum.byCategory).map(([k, v]) => (
            <div key={k} className="list-row glass-card"><span className="grow">{t(CATEGORY_LABEL[k as ExpenseCategory])}</span><span className="small">{t('Đã chi')}{' '}{fmtMoney(v.paid, j.currency)} {' '}{t('· dự kiến')}{' '}{fmtMoney(v.planned, j.currency)}</span></div>
          ))}
        </div>
      )}
      {view === 'day' && (
        <div className="stack-s">
          {[...days.map((d) => ({ k: d.id, l: t('Ngày {0}: {1}', d.index, d.title) })), { k: 'none', l: t('Không gắn ngày') }].filter((x) => sum.byDay[x.k]).map((x) => (
            <div key={x.k} className="list-row glass-card"><span className="grow">{x.l}</span><span className="small">{t('Đã chi')}{' '}{fmtMoney(sum.byDay[x.k].paid, j.currency)} {' '}{t('· dự kiến')}{' '}{fmtMoney(sum.byDay[x.k].planned, j.currency)}</span></div>
          ))}
        </div>
      )}
      {other.length > 0 && <p className="muted small">{other.length} {' '}{t('chi phí bằng tiền tệ khác không được cộng vào tổng')}{' '}{j.currency}.</p>}
      <RatesEditor />
      {(sel || creating) && (
        <ExpenseEditor
          e={sel ?? { id: uid('e'), journeyId: j.id, title: '', category: 'food', currency: j.currency, payments: [], receiptBlobIds: [], notes: '', createdAt: nowIso() }}
          isNew={!sel}
          days={days}
          acts={activities}
          onClose={() => (setOpen(null), setCreating(false))}
        />
      )}
    </div>
  );
}

function Conversions({ amount, rates, base }: { amount: number; rates: NonNullable<import('../../db/schema').JourneySettings['exchangeRates']>; base: string }) {
  const rows = (['KRW', 'VND'] as const).filter((c) => rates[c] && c !== base);
  if (!rows.length) return <p className="muted xsmall">{t('Chưa có tỷ giá KRW/VND. Bạn có thể nhập tay bên dưới (không dùng tỷ giá trực tuyến).')}</p>;
  return (
    <div className="xsmall">
      {rows.map((c) => (
        <p key={c} className="muted">≈ {fmtMoney(amount * rates[c]!.perUnit, c)} {' '}{t('· tỷ giá nhập tay 1')}{' '}{base} = {rates[c]!.perUnit} {c} {' '}{t('(nhập lúc')}{' '}{new Date(rates[c]!.enteredAt).toLocaleString(locale())}{t(') — chỉ để tham khảo')}</p>
      ))}
    </div>
  );
}

function RatesEditor() {
  const { journey: j } = useJourney();
  const toast = useToast();
  const r = j.settings.exchangeRates ?? {};
  const [krw, setKrw] = useState(String(r.KRW?.perUnit ?? ''));
  const [vnd, setVnd] = useState(String(r.VND?.perUnit ?? ''));
  return (
    <details className="card">
      <summary>{t('Tỷ giá tham khảo (nhập tay)')}</summary>
      <div className="stack">
        <Field label={`1 ${j.currency} = ? KRW`}><input inputMode="decimal" value={krw} onChange={(e: any) => setKrw(e.target.value)} /></Field>
        <Field label={`1 ${j.currency} = ? VND`}><input inputMode="decimal" value={vnd} onChange={(e: any) => setVnd(e.target.value)} /></Field>
        <button
          className="btn small"
          onClick={async () => {
            const now = nowIso();
            const n = (s: string) => (Number(s) > 0 ? { perUnit: Number(s), enteredAt: now, note: t('nhập tay') } : undefined);
            await updateJourneySettings(j.id, { exchangeRates: { KRW: n(krw), VND: n(vnd) } });
            toast(t('Đã lưu tỷ giá nhập tay'));
          }}
        >
          {t('Lưu tỷ giá')}</button>
      </div>
    </details>
  );
}

export function ExpenseEditor({ e, isNew, days, acts, onClose }: { e: Expense; isNew?: boolean; days: { id: string; index: number }[]; acts: { id: string; title: string; dayId: string; expenseIds: string[] }[]; onClose: () => void }) {
  const toast = useToast();
  const [f, setF] = useState<Expense>(e);
  const [pay, setPay] = useState<{ amount: string; kind: Payment['kind'] }>({ amount: '', kind: 'payment' });
  const [del, setDel] = useState(false);
  const num = (v: string) => (v === '' ? undefined : Number(v));
  const save = async () => {
    await db.put('expenses', f);
    // keep activity back-link (ids only)
    for (const a of acts) {
      const want = f.activityId === a.id;
      const has = a.expenseIds.includes(f.id);
      if (want !== has) await db.put('activities', { ...(await db.get<any>('activities', a.id)), expenseIds: want ? [...a.expenseIds, f.id] : a.expenseIds.filter((x) => x !== f.id) });
    }
    toast(t('Đã lưu chi phí'));
    onClose();
  };
  return (
    <Sheet open onClose={onClose} title={isNew ? t('Chi phí mới') : f.title} full>
      <div className="stack">
        <Field label={t('Tên')}><input value={f.title} onChange={(ev: any) => setF({ ...f, title: ev.target.value })} /></Field>
        <div className="row gap">
          <Field label={t('Loại')}>
            <select value={f.category} onChange={(ev: any) => setF({ ...f, category: ev.target.value })}>{Object.entries(CATEGORY_LABEL).map(([k, l]) => <option key={k} value={k}>{t(l)}</option>)}</select>
          </Field>
          <Field label={t('Tiền tệ')}><input value={f.currency} maxLength={3} onChange={(ev: any) => setF({ ...f, currency: ev.target.value.toUpperCase() })} /></Field>
        </div>
        <div className="row gap">
          <Field label={t('Ngày')}>
            <select value={f.dayId ?? ''} onChange={(ev: any) => setF({ ...f, dayId: ev.target.value || undefined })}>
              <option value="">—</option>
              {days.map((d) => <option key={d.id} value={d.id}>{t('Ngày')}{' '}{d.index}</option>)}
            </select>
          </Field>
          <Field label={t('Hoạt động')}>
            <select value={f.activityId ?? ''} onChange={(ev: any) => setF({ ...f, activityId: ev.target.value || undefined })}>
              <option value="">—</option>
              {acts.filter((a) => !f.dayId || a.dayId === f.dayId).map((a) => <option key={a.id} value={a.id}>{a.title}</option>)}
            </select>
          </Field>
        </div>
        <div className="row gap">
          <Field label={t('Ước tính / báo giá')}><input inputMode="decimal" value={f.estimate ?? ''} onChange={(ev: any) => setF({ ...f, estimate: num(ev.target.value) })} /></Field>
          <Field label={t('Ước tính tối đa (nếu là khoảng)')}><input inputMode="decimal" value={f.estimateHigh ?? ''} onChange={(ev: any) => setF({ ...f, estimateHigh: num(ev.target.value) })} /></Field>
        </div>
        <div className="card">
          <h4>{t('Thanh toán thực tế')}</h4>
          {f.payments.map((p) => (
            <div key={p.id} className="list-row">
              <span className="grow">{p.kind === 'deposit' ? t('Đặt cọc') : p.kind === 'refund' ? t('Hoàn tiền') : t('Thanh toán')} · {p.date.slice(0, 10)}</span>
              <b>{p.kind === 'refund' ? '−' : ''}{fmtMoney(p.amount, f.currency)}</b>
              <button className="mini danger" aria-label={t('Xóa khoản')} onClick={() => setF({ ...f, payments: f.payments.filter((x) => x.id !== p.id) })}>×</button>
            </div>
          ))}
          {!f.payments.length && <p className="muted small">{t('Chưa ghi nhận khoản thanh toán nào.')}</p>}
          <div className="row gap-s">
            <select value={pay.kind} onChange={(ev: any) => setPay({ ...pay, kind: ev.target.value })} aria-label={t('Loại khoản')}>
              <option value="payment">{t('Thanh toán')}</option>
              <option value="deposit">{t('Đặt cọc')}</option>
              <option value="refund">{t('Hoàn tiền')}</option>
            </select>
            <input inputMode="decimal" placeholder={t('Số tiền')} value={pay.amount} onChange={(ev: any) => setPay({ ...pay, amount: ev.target.value })} aria-label={t('Số tiền')} />
            <button className="btn small" disabled={!(Number(pay.amount) > 0)} onClick={() => (setF({ ...f, payments: [...f.payments, { id: uid('p'), amount: Number(pay.amount), kind: pay.kind, date: nowIso() }] }), setPay({ amount: '', kind: 'payment' }))}>{t('Ghi nhận')}</button>
          </div>
          <p className="small">{t('Trạng thái:')}{' '}<b>{t(PAYSTATE_LABEL[payState(f)])}</b> {' '}{t('· Đã trả')}{' '}{fmtMoney(paidOf(f), f.currency)}{remainingOf(f) != null && t(' · Còn lại {0}', fmtMoney(remainingOf(f)!, f.currency))}</p>
        </div>
        <div className="card">
          <h4>{t('Biên lai')}</h4>
          <div className="thumb-row">{f.receiptBlobIds.map((id) => <BlobImg key={id} id={id} className="thumb" />)}</div>
          <button className="btn small" onClick={async () => {
            const fs = await pickFiles('image/*,application/pdf', true);
            const ids: string[] = [];
            for (const x of fs) ids.push((await saveFileAsBlob(x, x.name, f.journeyId)).id);
            setF({ ...f, receiptBlobIds: [...f.receiptBlobIds, ...ids] });
          }}>{t('Thêm biên lai')}</button>
        </div>
        <Field label={t('Ghi chú')}><textarea rows={3} value={f.notes} onChange={(ev: any) => setF({ ...f, notes: ev.target.value })} /></Field>
        <div className="row gap">
          {!isNew && <button className="btn danger ghost" onClick={() => setDel(true)}>{t('Xóa')}</button>}
          <button className="btn primary" disabled={!f.title.trim()} onClick={save}>{t('Lưu')}</button>
        </div>
      </div>
      <Confirm open={del} danger title={t('Xóa chi phí?')} body={f.title} onConfirm={async () => (await db.del('expenses', f.id), onClose())} onClose={() => setDel(false)} />
    </Sheet>
  );
}
