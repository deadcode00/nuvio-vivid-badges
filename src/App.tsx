import { useMemo, useRef, useState } from 'react';
import { Bar, BarChart, CartesianGrid, Cell, Line, LineChart, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { byCategory, dailyCumulative, debits, insights, monthOf, monthlyTrend, topMerchants } from './insights';
import { parseStatement } from './parse';
import { sampleData } from './sample';
import { useStore } from './store';
import { CATEGORIES, inr } from './types';

const PALETTE = ['#0f766e', '#2563eb', '#d97706', '#9333ea', '#dc2626', '#0891b2', '#65a30d', '#db2777', '#64748b', '#ea580c', '#4f46e5', '#059669'];
type Tab = 'home' | 'txns' | 'budget' | 'cut' | 'import';

const monthLabel = (ym: string) => new Date(+ym.slice(0, 4), +ym.slice(5) - 1, 1).toLocaleString('en-IN', { month: 'short', year: 'numeric' });
const nowYm = () => monthOf(new Date().toISOString());

export default function App() {
  const store = useStore();
  const { txns, budgets } = store;
  const [tab, setTab] = useState<Tab>('home');
  const months = useMemo(() => {
    const s = new Set(txns.map((t) => monthOf(t.date)));
    s.add(nowYm());
    return [...s].sort().reverse();
  }, [txns]);
  const [ym, setYm] = useState(months[0]);
  const cur = useMemo(() => txns.filter((t) => monthOf(t.date) === ym), [txns, ym]);

  return (
    <div className="wrap">
      <div className="top">
        <h1>Paisa</h1>
        <select value={ym} onChange={(e) => setYm(e.target.value)} aria-label="Month">
          {months.map((m) => <option key={m} value={m}>{monthLabel(m)}</option>)}
        </select>
      </div>

      {txns.length === 0 && tab !== 'import' ? (
        <div className="card empty">
          <h2>No transactions yet</h2>
          <p>Import your HDFC statement, or load sample data to see how it looks.</p>
          <button className="btn primary" onClick={() => setTab('import')}>Import statement</button>{' '}
          <button className="btn" onClick={() => store.addTxns(sampleData())}>Load sample data</button>
        </div>
      ) : (
        <>
          {tab === 'home' && <Dashboard store={store} cur={cur} ym={ym} />}
          {tab === 'txns' && <Transactions store={store} cur={cur} />}
          {tab === 'budget' && <BudgetTab store={store} cur={cur} />}
          {tab === 'cut' && <CutTab store={store} ym={ym} />}
          {tab === 'import' && <ImportTab store={store} />}
        </>
      )}
      {txns.length === 0 && tab === 'import' && <ImportTab store={store} />}

      <nav className="tabs">
        {([['home', '📊 Home'], ['txns', '🧾 Txns'], ['budget', '🎯 Budget'], ['cut', '✂️ Cut'], ['import', '⬆️ Import']] as [Tab, string][]).map(([k, l]) => (
          <button key={k} className={tab === k ? 'on' : ''} onClick={() => setTab(k)}>{l}</button>
        ))}
      </nav>
    </div>
  );
}

type S = ReturnType<typeof useStore>;

function Dashboard({ store, cur, ym }: { store: S; cur: S['txns']; ym: string }) {
  const { txns, budgets } = store;
  const spent = debits(cur).reduce((s, t) => s + t.amount, 0);
  const income = cur.filter((t) => t.type === 'credit' && t.category === 'Income').reduce((s, t) => s + t.amount, 0);
  const totalBudget = Object.values(budgets).reduce((s, v) => s + v, 0);
  const cats = byCategory(cur);
  const savings = income > 0 ? Math.round(((income - spent) / income) * 100) : null;
  return (
    <>
      <div className="grid">
        <div className="card kpi"><div className="l">Spent</div><div className="v">{inr(spent)}</div></div>
        <div className="card kpi"><div className="l">{totalBudget ? 'Left in budget' : 'Income'}</div>
          <div className="v" style={{ color: totalBudget && totalBudget - spent < 0 ? 'var(--bad)' : undefined }}>{inr(totalBudget ? totalBudget - spent : income)}</div></div>
        <div className="card kpi"><div className="l">Savings rate</div><div className="v">{savings === null ? '–' : `${savings}%`}</div></div>
      </div>
      <div className="cols">
        <div className="card"><h2>Where it went</h2>
          <ResponsiveContainer width="100%" height={220}>
            <PieChart><Pie data={cats} dataKey="total" nameKey="category" innerRadius={55} outerRadius={90} paddingAngle={2}>
              {cats.map((_, i) => <Cell key={i} fill={PALETTE[i % PALETTE.length]} />)}</Pie>
              <Tooltip formatter={(v: number) => inr(v)} /></PieChart>
          </ResponsiveContainer>
          {cats.map((c, i) => (
            <div className="row" key={c.category}><span><i style={{ background: PALETTE[i % PALETTE.length], display: 'inline-block', width: 10, height: 10, borderRadius: 3, marginRight: 8 }} />{c.category}</span><span className="amt">{inr(c.total)}</span></div>
          ))}
        </div>
        <div className="card"><h2>Spend vs budget pace</h2>
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={dailyCumulative(txns, ym, totalBudget)}>
              <CartesianGrid stroke="var(--line)" vertical={false} /><XAxis dataKey="day" tick={{ fontSize: 11 }} /><YAxis tickFormatter={(v) => `${v / 1000}k`} tick={{ fontSize: 11 }} width={36} />
              <Tooltip formatter={(v: number) => inr(v)} labelFormatter={(d) => `Day ${d}`} />
              <Line dataKey="spent" stroke="#0f766e" strokeWidth={2} dot={false} name="Spent" />
              {totalBudget > 0 && <Line dataKey="budget" stroke="#94a3b8" strokeDasharray="5 4" dot={false} name="Budget pace" />}
            </LineChart>
          </ResponsiveContainer>
          {!totalBudget && <p className="muted">Set budgets in the Budget tab to see the pace line.</p>}
        </div>
        <div className="card"><h2>Last 6 months</h2>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={monthlyTrend(txns, 6, ym)}>
              <CartesianGrid stroke="var(--line)" vertical={false} /><XAxis dataKey="month" tickFormatter={(m) => monthLabel(m).slice(0, 3)} tick={{ fontSize: 11 }} />
              <YAxis tickFormatter={(v) => `${v / 1000}k`} tick={{ fontSize: 11 }} width={36} /><Tooltip formatter={(v: number) => inr(v)} labelFormatter={monthLabel} />
              <Bar dataKey="spent" fill="#0f766e" radius={[4, 4, 0, 0]} name="Spent" />
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div className="card"><h2>Top merchants</h2>
          {topMerchants(cur, 6).map((m) => (
            <div className="row" key={m.merchant}><span>{m.merchant} <span className="muted">· {m.count}×</span></span><span className="amt">{inr(m.total)}</span></div>
          ))}
        </div>
      </div>
    </>
  );
}

function Transactions({ store, cur }: { store: S; cur: S['txns'] }) {
  const [q, setQ] = useState('');
  const list = cur.filter((t) => (t.merchant + t.narration).toLowerCase().includes(q.toLowerCase())).slice(0, 300);
  return (
    <div className="card">
      <input placeholder="Search merchant…" value={q} onChange={(e) => setQ(e.target.value)} style={{ width: '100%', marginBottom: 8 }} />
      {list.length === 0 && <p className="muted">No transactions this month.</p>}
      {list.map((t) => (
        <div className="row" key={t.id}>
          <div style={{ minWidth: 0 }}>
            <div>{t.merchant}</div>
            <div className="muted">{t.date.slice(8)} {monthLabel(t.date.slice(0, 7)).slice(0, 3)} · <select value={t.category} onChange={(e) => store.recategorize(t.merchant, e.target.value)} style={{ padding: '1px 4px', fontSize: 12 }}>
              {CATEGORIES.map((c) => <option key={c}>{c}</option>)}</select></div>
          </div>
          <div className={`amt ${t.type === 'credit' ? 'credit' : ''}`}>{t.type === 'credit' ? '+' : '−'}{inr(t.amount)}</div>
        </div>
      ))}
    </div>
  );
}

function BudgetTab({ store, cur }: { store: S; cur: S['txns'] }) {
  const { budgets, setBudgets } = store;
  const spent = Object.fromEntries(byCategory(cur).map((c) => [c.category, c.total]));
  const cats = CATEGORIES.filter((c) => !['Income', 'Transfers'].includes(c));
  return (
    <div className="card">
      <h2>Monthly budgets</h2>
      <p className="muted">Enter a limit per category. Leave blank for no limit.</p>
      {cats.map((c) => {
        const limit = budgets[c] ?? 0, s = spent[c] ?? 0, pct = limit ? s / limit : 0;
        return (
          <div key={c} style={{ padding: '8px 0', borderBottom: '1px solid var(--line)' }}>
            <div className="row" style={{ border: 0, padding: 0 }}>
              <span>{c}</span>
              <span className="amt muted">{inr(s)} of ₹<input type="number" inputMode="numeric" min={0} value={limit || ''} placeholder="0" style={{ width: 80, padding: '3px 6px' }}
                onChange={(e) => setBudgets({ ...budgets, [c]: Math.max(0, +e.target.value || 0) })} /></span>
            </div>
            {limit > 0 && <div className="bar"><i style={{ width: `${Math.min(100, pct * 100)}%`, background: pct > 1 ? 'var(--bad)' : pct > 0.8 ? 'var(--warn)' : 'var(--good)' }} /></div>}
          </div>
        );
      })}
    </div>
  );
}

function CutTab({ store, ym }: { store: S; ym: string }) {
  const list = insights(store.txns, ym, store.budgets);
  const potential = list.filter((i) => i.kind !== 'pace').reduce((s, i) => s + (i.yearly ?? 0), 0);
  return (
    <div className="card">
      <h2>Where you can cut</h2>
      {potential > 0 && <p className="save">Potential savings: up to about {inr(potential)} a year</p>}
      {list.length === 0 && <p className="muted">Nothing stands out yet. Add a few months of data and set budgets for sharper tips.</p>}
      {list.map((i, k) => (
        <div className={`ins ${i.kind}`} key={k}>
          <strong>{i.title}</strong>
          <div className="muted">{i.detail}</div>
          {i.yearly && i.kind !== 'pace' ? <div className="save">≈ {inr(i.yearly)} / year</div> : null}
        </div>
      ))}
    </div>
  );
}

function ImportTab({ store }: { store: S }) {
  const [msg, setMsg] = useState('');
  const ref = useRef<HTMLInputElement>(null);
  const onFile = async (f?: File) => {
    if (!f) return;
    try {
      const t = parseStatement(await f.text(), store.overrides);
      const before = store.txns.length;
      const known = new Set(store.txns.map((x) => x.id));
      const fresh = t.filter((x) => !known.has(x.id)).length;
      store.addTxns(t);
      setMsg(`Read ${t.length} transactions · ${fresh} new, ${t.length - fresh} duplicates skipped (had ${before}).`);
    } catch (e) { setMsg('⚠️ ' + (e as Error).message); }
    if (ref.current) ref.current.value = '';
  };
  return (
    <div className="card">
      <h2>Import a bank statement</h2>
      <p className="muted">HDFC NetBanking → Accounts → Enquire → Account Statement → download as <b>CSV</b>. Credit card statements work if exported as CSV. Re-importing is safe: duplicates are skipped.</p>
      <input ref={ref} type="file" accept=".csv,text/csv" onChange={(e) => onFile(e.target.files?.[0])} />
      {msg && <p>{msg}</p>}
      <hr style={{ border: 0, borderTop: '1px solid var(--line)', margin: '16px 0' }} />
      <button className="btn" onClick={() => store.addTxns(sampleData())}>Load sample data</button>{' '}
      <button className="btn" onClick={() => confirm('Delete all transactions on this device?') && store.clearAll()}>Delete all data</button>
      <p className="muted">Everything is stored only in this browser on this device. Nothing is uploaded.</p>
    </div>
  );
}
