import { Txn } from './types';

/** Deterministic sample data for the last 5 months so every chart has something to show. */
export function sampleData(today = new Date()): Txn[] {
  let seed = 7;
  const rnd = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 2 ** 32);
  const out: Txn[] = [];
  const add = (d: Date, amount: number, merchant: string, category: string, type: 'debit' | 'credit' = 'debit') => {
    const date = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    out.push({ id: `s${out.length}`, date, amount: Math.round(amount), type, merchant, narration: `SAMPLE ${merchant}`, category });
  };
  for (let back = 4; back >= 0; back--) {
    const y = today.getFullYear(), m = today.getMonth() - back;
    const last = back === 0 ? today.getDate() : new Date(y, m + 1, 0).getDate();
    const day = (n: number) => new Date(y, m, Math.min(n, last));
    if (last >= 1) add(day(1), 85000, 'Acme Corp', 'Income', 'credit');
    if (last >= 2) add(day(2), 22000, 'Landlord Rent', 'Rent & EMI');
    if (last >= 5) { add(day(5), 649, 'Netflix', 'Subscriptions'); add(day(6), 199, 'Spotify', 'Subscriptions'); }
    if (last >= 8) add(day(8), 1450, 'Airtel', 'Bills & Utilities');
    for (let d = 1; d <= last; d++) {
      if (rnd() < 0.55) add(day(d), 150 + rnd() * 250, 'Swiggy', 'Food & Dining');
      if (rnd() < 0.5) add(day(d), 60 + rnd() * 120, 'Starbucks', 'Food & Dining');
      if (rnd() < 0.3) add(day(d), 400 + rnd() * 1200, 'Blinkit', 'Groceries');
      if (rnd() < 0.35) add(day(d), 90 + rnd() * 300, 'Uber', 'Transport');
      if (rnd() < 0.08) add(day(d), 800 + rnd() * 3500, 'Amazon', 'Shopping');
      if (rnd() < 0.04) add(day(d), 500 + rnd() * 1500, 'Apollo Pharmacy', 'Health');
    }
  }
  // make the current month's food spending creep up so the insight shows
  return out;
}
