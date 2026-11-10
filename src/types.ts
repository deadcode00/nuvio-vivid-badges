export type Txn = {
  id: string;
  date: string; // yyyy-mm-dd
  amount: number; // always positive, in INR
  type: 'debit' | 'credit';
  merchant: string;
  narration: string;
  category: string;
};

export type Budgets = Record<string, number>; // category -> monthly limit
export type Overrides = Record<string, string>; // merchant (lowercase) -> category

export const CATEGORIES = [
  'Food & Dining', 'Groceries', 'Transport', 'Shopping', 'Bills & Utilities',
  'Entertainment', 'Subscriptions', 'Health', 'Travel', 'Rent & EMI',
  'Cash', 'Transfers', 'Income', 'Other',
] as const;

export const inr = (n: number) =>
  '₹' + Math.round(n).toLocaleString('en-IN');
