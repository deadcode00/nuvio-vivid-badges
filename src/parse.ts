import { categorize } from './categorize';
import { Overrides, Txn } from './types';

/** Minimal RFC4180-ish CSV parser (handles quotes, commas in fields). */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [], cur = '', q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) {
      if (c === '"' && text[i + 1] === '"') { cur += '"'; i++; }
      else if (c === '"') q = false;
      else cur += c;
    } else if (c === '"') q = true;
    else if (c === ',') { row.push(cur); cur = ''; }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++;
      row.push(cur); cur = '';
      if (row.some((x) => x.trim() !== '')) rows.push(row);
      row = [];
    } else cur += c;
  }
  row.push(cur);
  if (row.some((x) => x.trim() !== '')) rows.push(row);
  return rows;
}

const MONTHS: Record<string, number> = { jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12 };

/** Accepts dd/mm/yy, dd/mm/yyyy, dd-mm-yyyy, dd Mon yyyy, yyyy-mm-dd → yyyy-mm-dd */
export function parseDate(s: string): string | null {
  s = s.trim();
  let m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  m = s.match(/^(\d{1,2})[\/\-. ](\d{1,2})[\/\-. ](\d{2,4})/);
  if (m) {
    let y = +m[3]; if (y < 100) y += 2000;
    return `${y}-${String(+m[2]).padStart(2, '0')}-${String(+m[1]).padStart(2, '0')}`;
  }
  m = s.match(/^(\d{1,2})[ \-]([A-Za-z]{3})[a-z]*[ \-,]+(\d{2,4})/);
  if (m && MONTHS[m[2].toLowerCase()]) {
    let y = +m[3]; if (y < 100) y += 2000;
    return `${y}-${String(MONTHS[m[2].toLowerCase()]).padStart(2, '0')}-${String(+m[1]).padStart(2, '0')}`;
  }
  return null;
}

const num = (s: string | undefined) => {
  if (!s) return 0;
  const n = parseFloat(s.replace(/[₹,\s]|Rs\.?|INR/gi, '').replace(/(cr|dr)$/i, ''));
  return isNaN(n) ? 0 : n;
};

/** Pull a human merchant name out of an HDFC narration. */
export function extractMerchant(narr: string): string {
  const n = narr.replace(/\s+/g, ' ').trim();
  let m = n.match(/^UPI[-/ ]([^-/@]+?)[-/ ]/i);
  if (m) return tidy(m[1]);
  m = n.match(/^(?:POS|PUR|ECOM|EMI)\s*\d{4,}[Xx*]+\d{2,4}\s+(.+)$/i) || n.match(/^(?:POS|ECOM PUR|PURCHASE)[ -]+(.+)$/i);
  if (m) return tidy(m[1]);
  m = n.match(/^(?:NEFT|IMPS|RTGS)[ -]+(?:CR|DR)?[- ]*[A-Z0-9]*[- ]+([^-]+)/i);
  if (m) return tidy(m[1]);
  m = n.match(/^(?:ACH D|ACH C|NACH)[- ]+([^-]+)/i) || n.match(/^BILLPAY[- ]+([^-]+)/i);
  if (m) return tidy(m[1]);
  if (/^(ATM|NWD)/i.test(n)) return 'ATM Withdrawal';
  return tidy(n.split(/[-/]/)[0]);
}
const tidy = (s: string) =>
  s.replace(/\b(pvt|ltd|limited|india|private)\b\.?/gi, '').replace(/[^A-Za-z0-9&'. ]/g, ' ').replace(/\s+/g, ' ').trim()
    .replace(/\w\S*/g, (w) => w[0].toUpperCase() + w.slice(1).toLowerCase()) || 'Unknown';

export function txnId(date: string, amount: number, narration: string, ref = ''): string {
  const s = `${date}|${amount.toFixed(2)}|${narration}|${ref}`;
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0;
  return (h >>> 0).toString(36);
}

/**
 * Parse an HDFC (or similar) statement CSV. Detects the header row, then either
 * Withdrawal/Deposit columns (bank account) or Amount + Dr/Cr (credit card).
 */
export function parseStatement(text: string, overrides: Overrides = {}): Txn[] {
  const rows = parseCsv(text);
  const hi = rows.findIndex((r) => {
    const j = r.join('|').toLowerCase();
    return /date/.test(j) && /(narration|description|transaction details)/.test(j);
  });
  if (hi < 0) throw new Error('Could not find a header row with Date and Narration/Description columns.');
  const head = rows[hi].map((h) => h.trim().toLowerCase());
  const col = (re: RegExp) => head.findIndex((h) => re.test(h));
  const cDate = col(/^date|txn date|transaction date/);
  const cNarr = col(/narration|description|transaction details/);
  const cRef = col(/ref|chq/);
  const cWd = col(/withdrawal|debit amt|debit/);
  const cDep = col(/deposit|credit amt|credit/);
  const cAmt = col(/^amount|amt\b/);
  const cDrCr = col(/dr\/cr|debit\/credit|type/);

  const out: Txn[] = [];
  for (const r of rows.slice(hi + 1)) {
    const date = parseDate(r[cDate] ?? '');
    if (!date) continue; // skips footers / summary lines
    const narration = (r[cNarr] ?? '').trim();
    let amount = 0, type: 'debit' | 'credit' = 'debit';
    if (cWd >= 0 && cDep >= 0 && cWd !== cDep) {
      const wd = num(r[cWd]), dep = num(r[cDep]);
      if (wd > 0) { amount = wd; type = 'debit'; } else if (dep > 0) { amount = dep; type = 'credit'; }
    } else if (cAmt >= 0) {
      amount = Math.abs(num(r[cAmt]));
      const flag = (cDrCr >= 0 ? r[cDrCr] : r[cAmt]) ?? '';
      type = /cr/i.test(flag) || /^\s*-/.test(r[cAmt] ?? '') ? 'credit' : 'debit';
    }
    if (!(amount > 0)) continue;
    const merchant = extractMerchant(narration);
    out.push({
      id: txnId(date, amount, narration, r[cRef] ?? ''),
      date, amount, type, merchant, narration,
      category: categorize(merchant, narration, type, overrides),
    });
  }
  return out;
}
