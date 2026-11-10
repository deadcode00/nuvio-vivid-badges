import { Budgets, Txn } from './types';

const FIXED = ['Rent & EMI', 'Bills & Utilities', 'Subscriptions'];
export const monthOf = (d: string) => d.slice(0, 7);
export const debits = (t: Txn[]) => t.filter((x) => x.type === 'debit' && x.category !== 'Transfers');
const sum = (t: Txn[]) => t.reduce((s, x) => s + x.amount, 0);
const addMonths = (ym: string, n: number) => {
  const [y, m] = ym.split('-').map(Number);
  const d = new Date(y, m - 1 + n, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
};
const daysIn = (ym: string) => { const [y, m] = ym.split('-').map(Number); return new Date(y, m, 0).getDate(); };

export function byCategory(t: Txn[]) {
  const map: Record<string, number> = {};
  for (const x of debits(t)) map[x.category] = (map[x.category] ?? 0) + x.amount;
  return Object.entries(map).map(([category, total]) => ({ category, total })).sort((a, b) => b.total - a.total);
}

export function topMerchants(t: Txn[], n = 5) {
  const map: Record<string, { total: number; count: number }> = {};
  for (const x of debits(t)) { const m = (map[x.merchant] ??= { total: 0, count: 0 }); m.total += x.amount; m.count++; }
  return Object.entries(map).map(([merchant, v]) => ({ merchant, ...v })).sort((a, b) => b.total - a.total).slice(0, n);
}

export function monthlyTrend(t: Txn[], months = 6, upTo: string) {
  return Array.from({ length: months }, (_, i) => {
    const ym = addMonths(upTo, i - months + 1);
    const m = t.filter((x) => monthOf(x.date) === ym);
    return { month: ym, spent: Math.round(sum(debits(m))), income: Math.round(sum(m.filter((x) => x.type === 'credit' && x.category === 'Income'))) };
  });
}

/** Cumulative spend per day of month, plus ideal straight-line budget pace. */
export function dailyCumulative(t: Txn[], ym: string, totalBudget: number) {
  const days = daysIn(ym);
  const per = Array(days + 1).fill(0);
  for (const x of debits(t)) if (monthOf(x.date) === ym) per[+x.date.slice(8, 10)] += x.amount;
  let run = 0;
  return Array.from({ length: days }, (_, i) => {
    run += per[i + 1];
    return { day: i + 1, spent: Math.round(run), budget: totalBudget ? Math.round((totalBudget / days) * (i + 1)) : undefined };
  });
}

export type Insight = { kind: 'pace' | 'subscription' | 'creeping' | 'small' | 'save'; title: string; detail: string; yearly?: number };

export function insights(all: Txn[], ym: string, budgets: Budgets, today = new Date()): Insight[] {
  const out: Insight[] = [];
  const cur = all.filter((x) => monthOf(x.date) === ym);
  const isCurrent = ym === `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
  const elapsed = isCurrent ? today.getDate() : daysIn(ym);
  const dim = daysIn(ym);

  // 1. budget pace
  for (const { category, total } of byCategory(cur)) {
    const limit = budgets[category];
    if (!limit) continue;
    const projected = isCurrent && !FIXED.includes(category) ? (total / elapsed) * dim : total;
    if (total > limit) out.push({ kind: 'pace', title: `${category} is over budget`, detail: `Spent ₹${Math.round(total).toLocaleString('en-IN')} against a ₹${limit.toLocaleString('en-IN')} limit.` });
    else if (projected > limit * 1.05) out.push({ kind: 'pace', title: `${category} is on track to go over`, detail: `At this pace you'll reach ₹${Math.round(projected).toLocaleString('en-IN')} by month end vs a ₹${limit.toLocaleString('en-IN')} budget.` });
  }

  // 2. subscriptions: same merchant, similar amount, in 3+ distinct months among last 6
  const window = Array.from({ length: 6 }, (_, i) => addMonths(ym, -i));
  const byMerchant: Record<string, Txn[]> = {};
  for (const x of debits(all)) if (window.includes(monthOf(x.date))) (byMerchant[x.merchant] ??= []).push(x);
  for (const [merchant, list] of Object.entries(byMerchant)) {
    if (['Rent & EMI', 'Bills & Utilities'].includes(list[0].category)) continue;
    const months = new Set(list.map((x) => monthOf(x.date)));
    if (months.size < 3 || list.length > months.size * 2) continue;
    const amts = list.map((x) => x.amount).sort((a, b) => a - b);
    const med = amts[Math.floor(amts.length / 2)];
    if (!amts.every((a) => Math.abs(a - med) / med <= 0.1)) continue;
    out.push({ kind: 'subscription', title: `${merchant} looks like a subscription`, detail: `~₹${Math.round(med).toLocaleString('en-IN')} every month for ${months.size} months. Still using it?`, yearly: med * 12 });
  }

  // 3. categories creeping up: spend so far vs prior 3 months' spend by the same day of month
  const prev = [1, 2, 3].map((i) => addMonths(ym, -i));
  const prevTxns = all.filter((x) => prev.includes(monthOf(x.date)) && +x.date.slice(8, 10) <= elapsed);
  const prevMonthsWithData = new Set(all.filter((x) => prev.includes(monthOf(x.date))).map((x) => monthOf(x.date))).size;
  if (prevMonthsWithData > 0) {
    const prevAvg = Object.fromEntries(byCategory(prevTxns).map((c) => [c.category, c.total / prevMonthsWithData]));
    for (const { category, total } of byCategory(cur)) {
      if (category === 'Rent & EMI') continue;
      const base = prevAvg[category] ?? 0;
      if (base > 0 && total > base * 1.25 && total - base > 500) {
        const extra = isCurrent ? ((total - base) / elapsed) * dim : total - base;
        out.push({ kind: 'creeping', title: `${category} is up ${Math.round((total / base - 1) * 100)}%`, detail: `₹${Math.round(total).toLocaleString('en-IN')} so far vs ₹${Math.round(base).toLocaleString('en-IN')} by this point in a typical month.`, yearly: extra * 12 });
      }
    }
  }

  // 4. small frequent purchases
  const small: Record<string, Txn[]> = {};
  for (const x of debits(cur)) if (x.amount <= 400 && x.category !== 'Cash') (small[x.merchant] ??= []).push(x);
  for (const [merchant, list] of Object.entries(small)) {
    const total = sum(list);
    if (list.length >= 6 && total >= 600)
      out.push({ kind: 'small', title: `${list.length} small ${merchant} purchases`, detail: `They add up to ₹${Math.round(total).toLocaleString('en-IN')} this month. Cutting half saves about ₹${Math.round(total * 6).toLocaleString('en-IN')} a year.`, yearly: total * 6 });
  }

  // 5. biggest wins: 20% off the top discretionary categories
  const discretionary = ['Food & Dining', 'Shopping', 'Entertainment', 'Travel'];
  for (const { category, total } of byCategory(cur).filter((c) => discretionary.includes(c.category)).slice(0, 2)) {
    const projected = isCurrent ? (total / elapsed) * dim : total;
    if (projected > 1500) out.push({ kind: 'save', title: `Trim ${category} by 20%`, detail: `Saves about ₹${Math.round(projected * 0.2).toLocaleString('en-IN')} a month.`, yearly: projected * 0.2 * 12 });
  }
  return out.sort((a, b) => (b.yearly ?? 0) - (a.yearly ?? 0));
}
