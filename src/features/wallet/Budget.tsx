import { useState } from 'react';
import { LuPlus } from 'react-icons/lu';
import type { Expense, ExpenseCategory, Payment } from '../../db/schema';
import { db, saveFileAsBlob, updateJourneySettings } from '../../db/repo';
import { BlobImg, Confirm, Field, PageHeader, pickFiles, queryParam, Sheet, useStore, useToast } from '../../ui/core';
import { useJourney } from '../journey/JourneyShell';
import { CATEGORY_LABEL, PAYSTATE_LABEL, paidOf, payState, remainingOf, summarize } from '../../lib/budget';
import { fmtMoney, nowIso, uid } from '../../lib/util';

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
      <PageHeader title="Ngân sách" sub={`Tiền tệ chính: ${j.currency}`} back={`/j/${j.id}/wallet`} right={<button className="icon-btn" aria-label="Thêm chi phí" onClick={() => setCreating(true)}><LuPlus size={20} /></button>} />
      <div className="glass-card budget-sum">
        <div><span className="muted xsmall">ĐÃ CHI THỰC TẾ</span><b className="big-num" data-testid="paid-total">{fmtMoney(sum.paid, j.currency)}</b></div>
        <div><span className="muted xsmall">DỰ KIẾN (gồm ước tính)</span><b data-testid="planned-total">{fmtMoney(sum.plannedLow, j.currency)}{sum.plannedHigh !== sum.plannedLow ? ` – ${fmtMoney(sum.plannedHigh, j.currency)}` : ''}</b></div>
        <div><span className="muted xsmall">CÒN PHẢI TRẢ (theo ước tính)</span><b>{fmtMoney(sum.outstandingLow, j.currency)}</b></div>
        <p className="muted xsmall">Ước tính không bao giờ được tính là đã trả. Tiền cọc là một phần của giá — không cộng thêm. Mỗi chi phí chỉ là một bản ghi duy nhất dù hiện ở nhiều nơi.</p>
        <Conversions amount={sum.paid} rates={rates} base={j.currency} />
      </div>
      <div className="seg">
        {[['list', 'Danh sách'], ['cat', 'Theo loại'], ['day', 'Theo ngày']].map(([k, l]) => <button key={k} className={view === k ? 'on' : ''} onClick={() => setView(k as any)}>{l}</button>)}
      </div>
      {view === 'list' && (
        <div className="stack-s">
          {expenses.map((e) => (
            <button key={e.id} className="list-row glass-card" onClick={() => setOpen(e.id)}>
              <span className="grow">
                <b>{e.title}</b>
                <span className="muted xsmall block">{CATEGORY_LABEL[e.category]} · {PAYSTATE_LABEL[payState(e)]}{e.dayId ? ` · Ngày ${days.find((d) => d.id === e.dayId)?.index ?? '?'}` : ''}</span>
              </span>
              <span className="text-right small">
                {e.estimate != null && <span className="muted block">ƯT {fmtMoney(e.estimate, e.currency)}{e.estimateHigh ? `–${fmtMoney(e.estimateHigh, e.currency)}` : ''}</span>}
                <b>{fmtMoney(paidOf(e), e.currency)}</b>
              </span>
            </button>
          ))}
          {!expenses.length && <p className="muted center">Chưa có chi phí.</p>}
        </div>
      )}
      {view === 'cat' && (
        <div className="stack-s">
          {Object.entries(sum.byCategory).map(([k, v]) => (
            <div key={k} className="list-row glass-card"><span className="grow">{CATEGORY_LABEL[k as ExpenseCategory]}</span><span className="small">Đã chi {fmtMoney(v.paid, j.currency)} · dự kiến {fmtMoney(v.planned, j.currency)}</span></div>
          ))}
        </div>
      )}
      {view === 'day' && (
        <div className="stack-s">
          {[...days.map((d) => ({ k: d.id, l: `Ngày ${d.index}: ${d.title}` })), { k: 'none', l: 'Không gắn ngày' }].filter((x) => sum.byDay[x.k]).map((x) => (
            <div key={x.k} className="list-row glass-card"><span className="grow">{x.l}</span><span className="small">Đã chi {fmtMoney(sum.byDay[x.k].paid, j.currency)} · dự kiến {fmtMoney(sum.byDay[x.k].planned, j.currency)}</span></div>
          ))}
        </div>
      )}
      {other.length > 0 && <p className="muted small">{other.length} chi phí bằng tiền tệ khác không được cộng vào tổng {j.currency}.</p>}
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
  if (!rows.length) return <p className="muted xsmall">Chưa có tỷ giá KRW/VND. Bạn có thể nhập tay bên dưới (không dùng tỷ giá trực tuyến).</p>;
  return (
    <div className="xsmall">
      {rows.map((c) => (
        <p key={c} className="muted">≈ {fmtMoney(amount * rates[c]!.perUnit, c)} · tỷ giá nhập tay 1 {base} = {rates[c]!.perUnit} {c} (nhập lúc {new Date(rates[c]!.enteredAt).toLocaleString('vi-VN')}) — chỉ để tham khảo</p>
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
      <summary>Tỷ giá tham khảo (nhập tay)</summary>
      <div className="stack">
        <Field label={`1 ${j.currency} = ? KRW`}><input inputMode="decimal" value={krw} onChange={(e: any) => setKrw(e.target.value)} /></Field>
        <Field label={`1 ${j.currency} = ? VND`}><input inputMode="decimal" value={vnd} onChange={(e: any) => setVnd(e.target.value)} /></Field>
        <button
          className="btn small"
          onClick={async () => {
            const t = nowIso();
            const n = (s: string) => (Number(s) > 0 ? { perUnit: Number(s), enteredAt: t, note: 'nhập tay' } : undefined);
            await updateJourneySettings(j.id, { exchangeRates: { KRW: n(krw), VND: n(vnd) } });
            toast('Đã lưu tỷ giá nhập tay');
          }}
        >
          Lưu tỷ giá
        </button>
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
    toast('Đã lưu chi phí');
    onClose();
  };
  return (
    <Sheet open onClose={onClose} title={isNew ? 'Chi phí mới' : f.title} full>
      <div className="stack">
        <Field label="Tên"><input value={f.title} onChange={(ev: any) => setF({ ...f, title: ev.target.value })} /></Field>
        <div className="row gap">
          <Field label="Loại">
            <select value={f.category} onChange={(ev: any) => setF({ ...f, category: ev.target.value })}>{Object.entries(CATEGORY_LABEL).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select>
          </Field>
          <Field label="Tiền tệ"><input value={f.currency} maxLength={3} onChange={(ev: any) => setF({ ...f, currency: ev.target.value.toUpperCase() })} /></Field>
        </div>
        <div className="row gap">
          <Field label="Ngày">
            <select value={f.dayId ?? ''} onChange={(ev: any) => setF({ ...f, dayId: ev.target.value || undefined })}>
              <option value="">—</option>
              {days.map((d) => <option key={d.id} value={d.id}>Ngày {d.index}</option>)}
            </select>
          </Field>
          <Field label="Hoạt động">
            <select value={f.activityId ?? ''} onChange={(ev: any) => setF({ ...f, activityId: ev.target.value || undefined })}>
              <option value="">—</option>
              {acts.filter((a) => !f.dayId || a.dayId === f.dayId).map((a) => <option key={a.id} value={a.id}>{a.title}</option>)}
            </select>
          </Field>
        </div>
        <div className="row gap">
          <Field label="Ước tính / báo giá"><input inputMode="decimal" value={f.estimate ?? ''} onChange={(ev: any) => setF({ ...f, estimate: num(ev.target.value) })} /></Field>
          <Field label="Ước tính tối đa (nếu là khoảng)"><input inputMode="decimal" value={f.estimateHigh ?? ''} onChange={(ev: any) => setF({ ...f, estimateHigh: num(ev.target.value) })} /></Field>
        </div>
        <div className="card">
          <h4>Thanh toán thực tế</h4>
          {f.payments.map((p) => (
            <div key={p.id} className="list-row">
              <span className="grow">{p.kind === 'deposit' ? 'Đặt cọc' : p.kind === 'refund' ? 'Hoàn tiền' : 'Thanh toán'} · {p.date.slice(0, 10)}</span>
              <b>{p.kind === 'refund' ? '−' : ''}{fmtMoney(p.amount, f.currency)}</b>
              <button className="mini danger" aria-label="Xóa khoản" onClick={() => setF({ ...f, payments: f.payments.filter((x) => x.id !== p.id) })}>×</button>
            </div>
          ))}
          {!f.payments.length && <p className="muted small">Chưa ghi nhận khoản thanh toán nào.</p>}
          <div className="row gap-s">
            <select value={pay.kind} onChange={(ev: any) => setPay({ ...pay, kind: ev.target.value })} aria-label="Loại khoản">
              <option value="payment">Thanh toán</option>
              <option value="deposit">Đặt cọc</option>
              <option value="refund">Hoàn tiền</option>
            </select>
            <input inputMode="decimal" placeholder="Số tiền" value={pay.amount} onChange={(ev: any) => setPay({ ...pay, amount: ev.target.value })} aria-label="Số tiền" />
            <button className="btn small" disabled={!(Number(pay.amount) > 0)} onClick={() => (setF({ ...f, payments: [...f.payments, { id: uid('p'), amount: Number(pay.amount), kind: pay.kind, date: nowIso() }] }), setPay({ amount: '', kind: 'payment' }))}>Ghi nhận</button>
          </div>
          <p className="small">Trạng thái: <b>{PAYSTATE_LABEL[payState(f)]}</b> · Đã trả {fmtMoney(paidOf(f), f.currency)}{remainingOf(f) != null && ` · Còn lại ${fmtMoney(remainingOf(f)!, f.currency)}`}</p>
        </div>
        <div className="card">
          <h4>Biên lai</h4>
          <div className="thumb-row">{f.receiptBlobIds.map((id) => <BlobImg key={id} id={id} className="thumb" />)}</div>
          <button className="btn small" onClick={async () => {
            const fs = await pickFiles('image/*,application/pdf', true);
            const ids: string[] = [];
            for (const x of fs) ids.push((await saveFileAsBlob(x, x.name, f.journeyId)).id);
            setF({ ...f, receiptBlobIds: [...f.receiptBlobIds, ...ids] });
          }}>Thêm biên lai</button>
        </div>
        <Field label="Ghi chú"><textarea rows={3} value={f.notes} onChange={(ev: any) => setF({ ...f, notes: ev.target.value })} /></Field>
        <div className="row gap">
          {!isNew && <button className="btn danger ghost" onClick={() => setDel(true)}>Xóa</button>}
          <button className="btn primary" disabled={!f.title.trim()} onClick={save}>Lưu</button>
        </div>
      </div>
      <Confirm open={del} danger title="Xóa chi phí?" body={f.title} onConfirm={async () => (await db.del('expenses', f.id), onClose())} onClose={() => setDel(false)} />
    </Sheet>
  );
}
