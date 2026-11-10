import { useEffect, useState } from 'react';
import { Budgets, Overrides, Txn } from './types';

function useLocal<T>(key: string, init: T): [T, (v: T | ((p: T) => T)) => void] {
  const [v, setV] = useState<T>(() => {
    try { const s = localStorage.getItem(key); return s ? (JSON.parse(s) as T) : init; } catch { return init; }
  });
  useEffect(() => { try { localStorage.setItem(key, JSON.stringify(v)); } catch { /* storage unavailable */ } }, [key, v]);
  return [v, setV];
}

export function useStore() {
  const [txns, setTxns] = useLocal<Txn[]>('paisa.txns', []);
  const [budgets, setBudgets] = useLocal<Budgets>('paisa.budgets', {});
  const [overrides, setOverrides] = useLocal<Overrides>('paisa.overrides', {});

  const addTxns = (incoming: Txn[]) => {
    setTxns((prev) => {
      const seen = new Set(prev.map((t) => t.id));
      const fresh = incoming.filter((t) => !seen.has(t.id) && seen.add(t.id));
      return [...prev, ...fresh].sort((a, b) => b.date.localeCompare(a.date));
    });
  };
  /** Re-categorise one transaction and remember the choice for that merchant. */
  const recategorize = (merchant: string, category: string) => {
    setOverrides((o) => ({ ...o, [merchant.toLowerCase()]: category }));
    setTxns((prev) => prev.map((t) => (t.merchant === merchant ? { ...t, category } : t)));
  };
  const clearAll = () => { setTxns([]); };
  return { txns, budgets, setBudgets, overrides, addTxns, recategorize, clearAll, setTxns };
}
