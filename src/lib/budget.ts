import type { Expense, ExpenseCategory } from '../db/schema';
import { tr } from './i18n';

export const CATEGORY_LABEL: Record<ExpenseCategory, string> = {
  transport: tr('Di chuyển'), food: tr('Ăn uống'), hotel: tr('Khách sạn'), tickets: tr('Vé'), photo: tr('Chụp ảnh'), shopping: tr('Mua sắm'), gifts: tr('Quà'), other: tr('Khác'),
};

/** Net money actually moved for one expense (deposits + payments − refunds). */
export function paidOf(e: Expense): number {
  return e.payments.reduce((s, p) => s + (p.kind === 'refund' ? -p.amount : p.amount), 0);
}
/** Remaining vs quoted estimate (never negative). Undefined when no estimate. */
export function remainingOf(e: Expense): number | undefined {
  if (e.estimate == null) return undefined;
  return Math.max(0, e.estimate - paidOf(e));
}
export type PayState = 'estimate-only' | 'deposit-paid' | 'partially-paid' | 'paid' | 'refunded';
export function payState(e: Expense): PayState {
  const paid = paidOf(e);
  if (!e.payments.length) return 'estimate-only';
  if (e.payments.some((p) => p.kind === 'refund') && paid <= 0) return 'refunded';
  if (e.estimate != null && paid >= e.estimate) return 'paid';
  if (e.estimate == null) return 'paid';
  if (e.payments.every((p) => p.kind === 'deposit')) return 'deposit-paid';
  return 'partially-paid';
}
export const PAYSTATE_LABEL: Record<PayState, string> = {
  'estimate-only': tr('Chỉ là ước tính'),
  'deposit-paid': tr('Đã đặt cọc'),
  'partially-paid': tr('Đã trả một phần'),
  paid: tr('Đã trả'),
  refunded: tr('Đã hoàn tiền'),
};

export interface BudgetSummary {
  paid: number;
  plannedLow: number;
  plannedHigh: number;
  outstandingLow: number;
  byCategory: Record<string, { paid: number; planned: number }>;
  byDay: Record<string, { paid: number; planned: number }>;
  count: number;
}

/**
 * Each expense is ONE canonical record. Planned = max(estimate, paid) so that a
 * deposit is part of the estimate, never added on top. Spent = payments only.
 */
export function summarize(expenses: Expense[], currency: string): BudgetSummary {
  const s: BudgetSummary = { paid: 0, plannedLow: 0, plannedHigh: 0, outstandingLow: 0, byCategory: {}, byDay: {}, count: 0 };
  const seen = new Set<string>();
  for (const e of expenses) {
    if (seen.has(e.id) || e.currency !== currency) continue;
    seen.add(e.id);
    s.count++;
    const paid = paidOf(e);
    const low = Math.max(e.estimate ?? 0, paid);
    const high = Math.max(e.estimateHigh ?? e.estimate ?? 0, paid);
    s.paid += paid;
    s.plannedLow += low;
    s.plannedHigh += high;
    s.outstandingLow += Math.max(0, (e.estimate ?? 0) - paid);
    const c = (s.byCategory[e.category] ??= { paid: 0, planned: 0 });
    c.paid += paid;
    c.planned += low;
    const dk = e.dayId ?? 'none';
    const d = (s.byDay[dk] ??= { paid: 0, planned: 0 });
    d.paid += paid;
    d.planned += low;
  }
  return s;
}
