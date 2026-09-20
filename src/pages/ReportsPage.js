import React, { useState, useEffect, useCallback } from 'react';
import { createClient } from '@supabase/supabase-js';
import AppShell from '../components/AppShell';

const supabase = createClient(
  process.env.REACT_APP_SUPABASE_URL,
  process.env.REACT_APP_SUPABASE_ANON_KEY
);

const EXPENSE_CATEGORIES = [
  { value: 'repairs', label: 'Repairs & maintenance' },
  { value: 'insurance', label: 'Insurance' },
  { value: 'taxes', label: 'Property taxes' },
  { value: 'mortgage', label: 'Mortgage' },
  { value: 'utilities', label: 'Utilities' },
  { value: 'management', label: 'Management' },
  { value: 'other', label: 'Other' },
];

function categoryLabel(value) {
  return EXPENSE_CATEGORIES.find((c) => c.value === value)?.label || 'Other';
}

function formatMoney(cents) {
  return `$${((cents || 0) / 100).toFixed(2)}`;
}

function toISODate(d) {
  return d.toISOString().slice(0, 10);
}

// This year / last year / this month / last month, in the user's local time.
function presetRange(preset) {
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth();
  switch (preset) {
    case 'this_month':
      return { start: new Date(y, m, 1), end: new Date(y, m + 1, 0) };
    case 'last_month':
      return { start: new Date(y, m - 1, 1), end: new Date(y, m, 0) };
    case 'last_year':
      return { start: new Date(y - 1, 0, 1), end: new Date(y - 1, 11, 31) };
    case 'this_year':
    default:
      return { start: new Date(y, 0, 1), end: new Date(y, 11, 31) };
  }
}

const EMPTY_EXPENSE = { property_id: '', category: 'other', amount: '', expense_date: '', notes: '' };

async function getSession() {
  const { data: { session } } = await supabase.auth.getSession();
  return session;
}

export default function ReportsPage() {
  const [properties, setProperties] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [formError, setFormError] = useState('');

  const [preset, setPreset] = useState('this_year');
  const initialRange = presetRange('this_year');
  const [start, setStart] = useState(toISODate(initialRange.start));
  const [end, setEnd] = useState(toISODate(initialRange.end));

  const [expenseFormOpen, setExpenseFormOpen] = useState(false);
  const [expenseForm, setExpenseForm] = useState(EMPTY_EXPENSE);

  const loadAll = useCallback(async (rangeStart, rangeEnd) => {
    try {
      const session = await getSession();
      if (!session) {
        setError('Please log in again.');
        return;
      }
      const backend = process.env.REACT_APP_BACKEND_URL;
      const authHeaders = { Authorization: `Bearer ${session.access_token}` };

      const [propsRes, expensesRes, reportRes] = await Promise.all([
        fetch(`${backend}/api/properties/${session.user.id}`, { headers: authHeaders }),
        fetch(`${backend}/api/expenses/landlord/${session.user.id}`, { headers: authHeaders }),
        fetch(`${backend}/api/reports/${session.user.id}?start=${rangeStart}&end=${rangeEnd}`, { headers: authHeaders }),
      ]);

      const propsData = await propsRes.json();
      const expensesData = await expensesRes.json();
      const reportData = await reportRes.json();

      if (!propsRes.ok) throw new Error(propsData.error || 'Failed to load properties');
      if (!expensesRes.ok) throw new Error(expensesData.error || 'Failed to load expenses');
      if (!reportRes.ok) throw new Error(reportData.error || 'Failed to load report');

      setProperties(propsData.properties || []);
      setExpenses(expensesData.expenses || []);
      setReport(reportData);
    } catch (err) {
      console.error('Error loading reports:', err);
      setError('Could not load your reports. Please try again shortly.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAll(start, end);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const applyPreset = (value) => {
    setPreset(value);
    if (value === 'custom') return;
    const range = presetRange(value);
    const newStart = toISODate(range.start);
    const newEnd = toISODate(range.end);
    setStart(newStart);
    setEnd(newEnd);
    setLoading(true);
    loadAll(newStart, newEnd);
  };

  const applyCustomRange = () => {
    setLoading(true);
    loadAll(start, end);
  };

  const propertyAddress = (id) => properties.find((p) => p.id === id)?.address || 'Unknown property';

  // ---- expense form ----

  const openExpenseForm = () => {
    setFormError('');
    setExpenseForm({ ...EMPTY_EXPENSE, property_id: properties[0]?.id || '', expense_date: toISODate(new Date()) });
    setExpenseFormOpen(true);
  };

  const closeExpenseForm = () => {
    setExpenseFormOpen(false);
    setFormError('');
  };

  const submitExpense = async (e) => {
    e.preventDefault();
    setFormError('');

    if (!expenseForm.property_id) {
      setFormError('Choose a property.');
      return;
    }
    if (!expenseForm.amount || Number(expenseForm.amount) <= 0) {
      setFormError('Enter an amount.');
      return;
    }
    if (!expenseForm.expense_date) {
      setFormError('Choose a date.');
      return;
    }

    try {
      const session = await getSession();
      if (!session) {
        setFormError('Please log in again.');
        return;
      }
      const res = await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/expenses`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          ...expenseForm,
          amount: Math.round(Number(expenseForm.amount) * 100),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to save expense');

      closeExpenseForm();
      await loadAll(start, end);
    } catch (err) {
      setFormError(err.message || 'Failed to save expense.');
    }
  };

  const deleteExpense = async (expense) => {
    if (!window.confirm(`Delete this ${categoryLabel(expense.category).toLowerCase()} expense of ${formatMoney(expense.amount)}?`)) return;
    try {
      const session = await getSession();
      if (!session) {
        setError('Please log in again.');
        return;
      }
      const res = await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/expenses/${expense.id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to delete expense');
      await loadAll(start, end);
    } catch (err) {
      setError(err.message || 'Failed to delete expense.');
    }
  };

  // ---- CSV export ----

  const exportCSV = () => {
    if (!report) return;
    const rows = [];
    rows.push(['Rentflow report', `${start} to ${end}`]);
    rows.push([]);
    rows.push(['Summary']);
    rows.push(['Income', (report.summary.income / 100).toFixed(2)]);
    rows.push(['Expenses', (report.summary.expenses / 100).toFixed(2)]);
    rows.push(['Net income', (report.summary.net / 100).toFixed(2)]);
    rows.push([]);
    rows.push(['By property', 'Income', 'Expenses', 'Net']);
    report.properties.forEach((p) => {
      rows.push([p.address, (p.income / 100).toFixed(2), (p.expenses / 100).toFixed(2), (p.net / 100).toFixed(2)]);
    });
    rows.push([]);
    rows.push(['By expense category', 'Amount']);
    report.expenses_by_category.forEach((c) => {
      rows.push([categoryLabel(c.category), (c.amount / 100).toFixed(2)]);
    });

    const csv = rows.map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `rentflow-report-${start}-to-${end}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  if (loading && !report) {
    return (
      <AppShell active="reports">
        <div className="rf-state"><p>Loading your reports...</p></div>
      </AppShell>
    );
  }

  if (error) {
    return (
      <AppShell active="reports">
        <div className="rf-state"><p>{error}</p></div>
      </AppShell>
    );
  }

  return (
    <AppShell active="reports">
      <div className="rf-page-header rf-page-header-row">
        <div>
          <h1>Reports</h1>
          <p>Income, expenses, and a tax-ready export for any date range</p>
        </div>
        <button className="rf-btn rf-btn-secondary" onClick={exportCSV} disabled={!report}>Export CSV</button>
      </div>

      <div className="rf-card">
        <div className="rf-range-row">
          <div className="rf-range-presets">
            {[
              { value: 'this_month', label: 'This month' },
              { value: 'last_month', label: 'Last month' },
              { value: 'this_year', label: 'This year' },
              { value: 'last_year', label: 'Last year' },
              { value: 'custom', label: 'Custom' },
            ].map((p) => (
              <button
                key={p.value}
                className={`rf-btn ${preset === p.value ? 'rf-btn-primary' : 'rf-btn-secondary'}`}
                onClick={() => applyPreset(p.value)}
              >
                {p.label}
              </button>
            ))}
          </div>
          {preset === 'custom' && (
            <div className="rf-range-custom">
              <input className="rf-input" type="date" value={start} onChange={(e) => setStart(e.target.value)} />
              <span>to</span>
              <input className="rf-input" type="date" value={end} onChange={(e) => setEnd(e.target.value)} />
              <button className="rf-btn rf-btn-primary" onClick={applyCustomRange}>Apply</button>
            </div>
          )}
        </div>
      </div>

      {report && (
        <>
          <div className="rf-chips">
            <div className="rf-chip"><b>{formatMoney(report.summary.income)}</b><span>income</span></div>
            <div className="rf-chip"><b>{formatMoney(report.summary.expenses)}</b><span>expenses</span></div>
            <div className="rf-chip"><b>{formatMoney(report.summary.net)}</b><span>net income</span></div>
          </div>

          <h2 className="rf-section-title">By property</h2>
          {report.properties.length === 0 ? (
            <p className="rf-empty">No properties yet.</p>
          ) : (
            <div className="rf-table-wrap" style={{ marginBottom: 28 }}>
              <table className="rf-table rf-table-stack">
                <thead>
                  <tr>
                    <th>Property</th>
                    <th>Income</th>
                    <th>Expenses</th>
                    <th>Net</th>
                  </tr>
                </thead>
                <tbody>
                  {report.properties.map((p) => (
                    <tr key={p.id}>
                      <td data-label="Property">{p.address}</td>
                      <td data-label="Income">{formatMoney(p.income)}</td>
                      <td data-label="Expenses">{formatMoney(p.expenses)}</td>
                      <td data-label="Net">{formatMoney(p.net)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {report.expenses_by_category.length > 0 && (
            <>
              <h2 className="rf-section-title">Expenses by category</h2>
              <div className="rf-table-wrap" style={{ marginBottom: 28 }}>
                <table className="rf-table rf-table-stack">
                  <thead>
                    <tr>
                      <th>Category</th>
                      <th>Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {report.expenses_by_category.map((c) => (
                      <tr key={c.category}>
                        <td data-label="Category">{categoryLabel(c.category)}</td>
                        <td data-label="Amount">{formatMoney(c.amount)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </>
      )}

      <div className="rf-page-header-row">
        <h2 className="rf-section-title" style={{ margin: 0 }}>Expenses</h2>
        <button className="rf-btn rf-btn-primary" onClick={openExpenseForm} disabled={properties.length === 0}>
          + Add expense
        </button>
      </div>
      {properties.length === 0 && <p className="rf-empty">Add a property first to start logging expenses.</p>}

      {expenseFormOpen && (
        <div className="rf-card">
          <h2 className="rf-section-title">New expense</h2>
          {formError && <div className="rf-alert">{formError}</div>}
          <form onSubmit={submitExpense}>
            <div className="rf-form-row">
              <div className="rf-field">
                <label>Property</label>
                <select
                  className="rf-select"
                  value={expenseForm.property_id}
                  onChange={(e) => setExpenseForm({ ...expenseForm, property_id: e.target.value })}
                >
                  {properties.map((p) => (
                    <option key={p.id} value={p.id}>{p.address}</option>
                  ))}
                </select>
              </div>
              <div className="rf-field">
                <label>Category</label>
                <select
                  className="rf-select"
                  value={expenseForm.category}
                  onChange={(e) => setExpenseForm({ ...expenseForm, category: e.target.value })}
                >
                  {EXPENSE_CATEGORIES.map((c) => (
                    <option key={c.value} value={c.value}>{c.label}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="rf-form-row">
              <div className="rf-field">
                <label>Amount ($)</label>
                <input
                  className="rf-input"
                  type="number"
                  step="0.01"
                  min="0"
                  value={expenseForm.amount}
                  onChange={(e) => setExpenseForm({ ...expenseForm, amount: e.target.value })}
                  placeholder="250.00"
                />
              </div>
              <div className="rf-field">
                <label>Date</label>
                <input
                  className="rf-input"
                  type="date"
                  value={expenseForm.expense_date}
                  onChange={(e) => setExpenseForm({ ...expenseForm, expense_date: e.target.value })}
                />
              </div>
            </div>
            <div className="rf-field">
              <label>Notes (optional)</label>
              <input
                className="rf-input"
                value={expenseForm.notes}
                onChange={(e) => setExpenseForm({ ...expenseForm, notes: e.target.value })}
                placeholder="Plumber — leaking faucet, unit 2"
              />
            </div>
            <div className="rf-form-actions">
              <button type="submit" className="rf-btn rf-btn-primary">Save expense</button>
              <button type="button" className="rf-btn rf-btn-secondary" onClick={closeExpenseForm}>Cancel</button>
            </div>
          </form>
        </div>
      )}

      {expenses.length === 0 ? (
        <p className="rf-empty">No expenses logged yet.</p>
      ) : (
        <div className="rf-table-wrap">
          <table className="rf-table rf-table-stack">
            <thead>
              <tr>
                <th>Date</th>
                <th>Property</th>
                <th>Category</th>
                <th>Notes</th>
                <th>Amount</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {expenses.map((e) => (
                <tr key={e.id}>
                  <td data-label="Date">{e.expense_date}</td>
                  <td data-label="Property">{propertyAddress(e.property_id)}</td>
                  <td data-label="Category"><span className="rf-badge neutral">{categoryLabel(e.category)}</span></td>
                  <td data-label="Notes">{e.notes || '—'}</td>
                  <td data-label="Amount">{formatMoney(e.amount)}</td>
                  <td>
                    <button className="rf-btn rf-btn-danger" onClick={() => deleteExpense(e)}>Delete</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </AppShell>
  );
}
