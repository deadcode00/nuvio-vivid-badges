import { Overrides } from './types';

const RULES: [string, RegExp][] = [
  ['Food & Dining', /swiggy|zomato|dominos|domino's|mcdonald|kfc|burger|pizza|starbucks|cafe|coffee|chai|restaurant|biryani|eatfit|dineout|barbeque/i],
  ['Groceries', /bigbasket|blinkit|zepto|instamart|dmart|avenue supermarts|reliance fresh|more retail|grocer|supermarket|kirana|milk|vegetable/i],
  ['Transport', /uber|ola\b|olacabs|rapido|metro|irctc|fuel|petrol|hpcl|bpcl|indianoil|iocl|shell|fastag|parking/i],
  ['Shopping', /amazon|flipkart|myntra|ajio|nykaa|meesho|decathlon|croma|reliance digital|lenskart|ikea/i],
  ['Subscriptions', /netflix|spotify|hotstar|prime video|youtube|apple\.com|google play|icloud|jiocinema|sonyliv|zee5|chatgpt|openai|notion|adobe|audible/i],
  ['Entertainment', /bookmyshow|pvr|inox|steam|playstation|dream11|game/i],
  ['Bills & Utilities', /electricity|bescom|tata power|adani electricity|airtel|jio\b|vodafone|vi\b|bsnl|broadband|act fibernet|gas|water bill|recharge|dth|bill ?pay|billdesk|insurance|lic\b/i],
  ['Health', /pharmacy|apollo|medplus|1mg|pharmeasy|hospital|clinic|diagnostic|lab|doctor|practo|netmeds|cult\.?fit/i],
  ['Travel', /makemytrip|goibibo|cleartrip|booking\.com|airbnb|indigo|air india|vistara|akasa|oyo|hotel|yatra|ixigo/i],
  ['Rent & EMI', /rent|emi\b|loan|nobroker|housing|maintenance|society/i],
  ['Cash', /atm|cash wdl|cash withdrawal|nwd-/i],
  ['Income', /salary|interest paid|int\.?pd|dividend|refund|cashback|reversal/i],
];

export function categorize(merchant: string, narration: string, type: 'debit' | 'credit', overrides: Overrides = {}): string {
  const o = overrides[merchant.toLowerCase()];
  if (o) return o;
  const text = `${merchant} ${narration}`;
  for (const [cat, re] of RULES) if (re.test(text)) return cat === 'Income' && type === 'debit' ? 'Other' : cat;
  if (type === 'credit') return 'Income';
  if (/^(neft|imps|rtgs)/i.test(narration)) return 'Transfers';
  return 'Other';
}
