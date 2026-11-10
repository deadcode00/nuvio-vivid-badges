import { describe, expect, it } from 'vitest';
import { extractMerchant, parseDate, parseStatement } from './parse';
import { insights } from './insights';
import { Txn } from './types';

const CSV = `HDFC BANK LTD
Date,Narration,Chq./Ref.No.,Value Dt,Withdrawal Amt.,Deposit Amt.,Closing Balance
03/11/25,UPI-SWIGGY-swiggy@icici-ICIC0000011-5123-PAYMENT,0000512,03/11/25,"1,250.50",,45000
05/11/25,NEFT CR-HDFC0000001-ACME CORP-SALARY,N123,05/11/25,,85000.00,130000
07/11/25,POS 416021XXXXXX1234 AMAZON PAY INDIA,0000999,07/11/25,899.00,,129000
`;

describe('parse', () => {
  it('parses dates', () => {
    expect(parseDate('03/11/25')).toBe('2025-11-03');
    expect(parseDate('3 Nov 2025')).toBe('2025-11-03');
  });
  it('extracts merchants', () => {
    expect(extractMerchant('UPI-SWIGGY-swiggy@icici-ICIC0000011-5123-PAYMENT')).toBe('Swiggy');
    expect(extractMerchant('POS 416021XXXXXX1234 AMAZON PAY INDIA')).toBe('Amazon Pay');
  });
  it('parses an HDFC statement', () => {
    const t = parseStatement(CSV);
    expect(t).toHaveLength(3);
    expect(t[0]).toMatchObject({ amount: 1250.5, type: 'debit', category: 'Food & Dining' });
    expect(t[1]).toMatchObject({ amount: 85000, type: 'credit', category: 'Income' });
    expect(t[2].category).toBe('Shopping');
  });
});

describe('insights', () => {
  it('finds a subscription and a budget overrun', () => {
    const mk = (date: string, amount: number, merchant: string, category: string): Txn => ({ id: date + merchant, date, amount, type: 'debit', merchant, narration: '', category });
    const all = [
      mk('2025-09-05', 649, 'Netflix', 'Subscriptions'), mk('2025-10-05', 649, 'Netflix', 'Subscriptions'), mk('2025-11-05', 649, 'Netflix', 'Subscriptions'),
      mk('2025-11-06', 6000, 'Swiggy', 'Food & Dining'),
    ];
    const r = insights(all, '2025-11', { 'Food & Dining': 5000 }, new Date(2025, 10, 10));
    expect(r.some((i) => i.kind === 'subscription' && i.title.includes('Netflix'))).toBe(true);
    expect(r.some((i) => i.kind === 'pace' && i.title.includes('over budget'))).toBe(true);
  });
});
