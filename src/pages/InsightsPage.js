import React, { useState, useEffect, useCallback } from 'react';
import { createClient } from '@supabase/supabase-js';
import AppShell from '../components/AppShell';

const supabase = createClient(
  process.env.REACT_APP_SUPABASE_URL,
  process.env.REACT_APP_SUPABASE_ANON_KEY
);

const CATEGORY_LABELS = {
  repairs: 'Repairs & maintenance',
  insurance: 'Insurance',
  taxes: 'Property taxes',
  mortgage: 'Mortgage',
  utilities: 'Utilities',
  management: 'Management',
  other: 'Other',
};

function categoryLabel(value) {
  return CATEGORY_LABELS[value] || 'Other';
}

function formatMoney(cents) {
  const dollars = (cents || 0) / 100;
  return `$${dollars.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

function formatCompact(dollars) {
  return `$${new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 1 }).format(dollars)}`;
}

// Picks a "nice" gridline step (1/2/5 x 10^n) so the $ axis reads cleanly
// regardless of portfolio size, instead of a hardcoded increment.
function niceTicks(maxValue, targetCount = 6) {
  if (!maxValue || maxValue <= 0) return { max: 100, ticks: [25, 50, 75, 100] };
  const roughStep = maxValue / targetCount;
  const magnitude = Math.pow(10, Math.floor(Math.log10(roughStep)));
  const norm = roughStep / magnitude;
  let step;
  if (norm <= 1) step = 1 * magnitude;
  else if (norm <= 2) step = 2 * magnitude;
  else if (norm <= 5) step = 5 * magnitude;
  else step = 10 * magnitude;
  const max = Math.ceil(maxValue / step) * step;
  const ticks = [];
  for (let v = step; v <= max + 0.0001; v += step) ticks.push(Math.round(v));
  return { max, ticks };
}

async function getSession() {
  const { data: { session } } = await supabase.auth.getSession();
  return session;
}

// Chart geometry (a 640x214 viewBox, same proportions across screen sizes).
const VIEW_W = 640;
const BASELINE_Y = 190;
const PLOT_TOP_Y = 8;
const PLOT_H = BASELINE_Y - PLOT_TOP_Y;
const LEFT_PAD = 38;
const RIGHT_PAD = 20;
const BAR_W = 20;

export default function InsightsPage() {
  const [summary, setSummary] = useState(null);
  const [cashFlow, setCashFlow] = useState([]);
  const [expensesByCategory, setExpensesByCategory] = useState([]);
  const [properties, setProperties] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [hoveredIdx, setHoveredIdx] = useState(null);

  const loadInsights = useCallback(async () => {
    try {
      const session = await getSession();
      if (!session) {
        setError('Please log in again.');
        setLoading(false);
        return;
      }
      const backend = process.env.REACT_APP_BACKEND_URL;
      const res = await fetch(`${backend}/api/insights/${session.user.id}`, {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to load insights');

      setSummary(data.summary);
      setCashFlow(data.cash_flow || []);
      setExpensesByCategory(data.expenses_by_category || []);
      setProperties(data.properties || []);
    } catch (err) {
      setError(err.message || 'Failed to load insights');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadInsights();
  }, [loadInsights]);

  if (loading) {
    return (
      <AppShell active="insights" wide>
        <div className="rf-ins-loading">Loading insights&hellip;</div>
      </AppShell>
    );
  }

  if (error) {
    return (
      <AppShell active="insights" wide>
        <div className="rf-ins-loading">{error}</div>
      </AppShell>
    );
  }

  if (!properties.length) {
    return (
      <AppShell active="insights" wide>
        <div className="rf-ins-empty">
          <div className="rf-ins-empty-title">No portfolio data yet</div>
          <div className="rf-ins-empty-sub">Add your first property to start tracking cash flow and occupancy here.</div>
        </div>
      </AppShell>
    );
  }

  // ---- Chart geometry, computed from real data ----
  const maxDollar = Math.max(
    1,
    ...cashFlow.map((m) => (m.income || 0) / 100),
    ...cashFlow.map((m) => (m.expenses || 0) / 100)
  );
  const { max: chartMax, ticks } = niceTicks(maxDollar);
  const bandW = cashFlow.length ? (VIEW_W - LEFT_PAD - RIGHT_PAD) / cashFlow.length : 0;

  const barGroups = cashFlow.map((m, i) => {
    const center = LEFT_PAD + bandW / 2 + bandW * i;
    const incomeDollars = (m.income || 0) / 100;
    const expenseDollars = (m.expenses || 0) / 100;
    const incomeH = chartMax > 0 ? (incomeDollars / chartMax) * PLOT_H : 0;
    const expenseH = chartMax > 0 ? (expenseDollars / chartMax) * PLOT_H : 0;
    return {
      ...m,
      center,
      incomeX: center - BAR_W - 2,
      expenseX: center + 2,
      incomeY: BASELINE_Y - incomeH,
      incomeH,
      expenseY: BASELINE_Y - expenseH,
      expenseH,
    };
  });

  const activeIdx = hoveredIdx !== null ? hoveredIdx : barGroups.length - 1;
  const activeMonth = barGroups[activeIdx];

  // ---- Rail data ----
  const maxCategoryAmount = Math.max(1, ...expensesByCategory.map((c) => c.amount || 0));
  const sortedCategories = [...expensesByCategory].sort((a, b) => (b.amount || 0) - (a.amount || 0));

  const sortedProperties = [...properties].sort((a, b) => (b.income || 0) - (a.income || 0));
  const vacantProperties = properties.filter((p) => p.vacant > 0);
  const fullyOccupied = properties.filter((p) => p.vacant === 0 && p.occupied > 0);
  const topPerformer = (fullyOccupied.length ? fullyOccupied : sortedProperties)
    .slice()
    .sort((a, b) => (b.income || 0) - (a.income || 0))[0];

  const netChangeLabel = summary.net_change_pct === null
    ? null
    : `${summary.net_change_pct >= 0 ? '▲' : '▼'} ${Math.abs(summary.net_change_pct)}% vs last month`;

  return (
    <AppShell active="insights" wide>
      <div className="rf-ins">
        <div className="rf-ins-header">
          <div>
            <div className="rf-ins-eyebrow">Portfolio performance</div>
            <div className="rf-ins-title">Insights</div>
            <div className="rf-ins-sub">Cash flow and occupancy across your {properties.length} propert{properties.length === 1 ? 'y' : 'ies'}.</div>
          </div>
        </div>

        <div className="rf-ins-grid">
          {/* LEFT */}
          <div className="rf-ins-main">

            <div className="rf-ins-kpis">
              <div className="rf-card rf-ins-kpi">
                <div className="rf-ins-kpi-label">Net cash flow &middot; this month</div>
                <div className="rf-ins-kpi-value">{formatMoney(summary.net_cash_flow)}</div>
                {netChangeLabel && (
                  <div className={`rf-ins-kpi-delta ${summary.net_change_pct >= 0 ? 'good' : 'warn'}`}>{netChangeLabel}</div>
                )}
              </div>
              <div className="rf-card rf-ins-kpi">
                <div className="rf-ins-kpi-label">Portfolio occupancy</div>
                <div className="rf-ins-kpi-value">{summary.occupancy_pct}%</div>
                <div className="rf-ins-meter"><span style={{ width: `${summary.occupancy_pct}%` }} /></div>
                <div className="rf-ins-kpi-note">{summary.occupancy_occupied} of {summary.occupancy_units} units</div>
              </div>
              <div className="rf-card rf-ins-kpi">
                <div className="rf-ins-kpi-label">Est. vacancy loss</div>
                <div className="rf-ins-kpi-value warn">{formatMoney(summary.vacancy_loss)}<span className="rf-ins-kpi-unit">/mo</span></div>
                <div className="rf-ins-kpi-note">{summary.occupancy_units - summary.occupancy_occupied} vacant unit{(summary.occupancy_units - summary.occupancy_occupied) === 1 ? '' : 's'}</div>
              </div>
              <div className="rf-card rf-ins-kpi">
                <div className="rf-ins-kpi-label">Avg rent / occupied unit</div>
                <div className="rf-ins-kpi-value">{formatMoney(summary.avg_rent_per_unit)}</div>
                <div className="rf-ins-kpi-note">across {summary.occupancy_occupied} lease{summary.occupancy_occupied === 1 ? '' : 's'}</div>
              </div>
            </div>

            <div className="rf-card rf-ins-chart-card">
              <div className="rf-ins-chart-head">
                <div className="rf-ins-chart-title">Cash flow, last 6 months</div>
                <div className="rf-ins-legend">
                  <span className="rf-ins-legend-item"><span className="rf-ins-swatch income" />Income</span>
                  <span className="rf-ins-legend-item"><span className="rf-ins-swatch expense" />Expenses</span>
                </div>
              </div>

              <svg viewBox={`0 0 ${VIEW_W} 214`} className="rf-ins-svg">
                {ticks.map((t) => {
                  const y = BASELINE_Y - (t / chartMax) * PLOT_H;
                  return (
                    <g key={t}>
                      <line x1={LEFT_PAD} y1={y} x2={VIEW_W - RIGHT_PAD} y2={y} className="rf-ins-gridline" />
                      <text x={LEFT_PAD - 6} y={y + 3} textAnchor="end" className="rf-ins-axis-label">{formatCompact(t)}</text>
                    </g>
                  );
                })}

                <line x1={LEFT_PAD} y1={BASELINE_Y} x2={VIEW_W - RIGHT_PAD} y2={BASELINE_Y} className="rf-ins-baseline" />

                {barGroups.map((g, i) => (
                  <g key={g.month}>
                    <rect
                      x={LEFT_PAD + bandW * i}
                      y={PLOT_TOP_Y}
                      width={bandW}
                      height={BASELINE_Y - PLOT_TOP_Y}
                      fill="transparent"
                      onMouseEnter={() => setHoveredIdx(i)}
                      onMouseLeave={() => setHoveredIdx(null)}
                      style={{ cursor: 'pointer' }}
                    />
                    {i === activeIdx && (
                      <line x1={g.center} y1={PLOT_TOP_Y} x2={g.center} y2={BASELINE_Y} className="rf-ins-hover-guide" />
                    )}
                    <rect x={g.incomeX} y={g.incomeY} width={BAR_W} height={g.incomeH} rx="3" className="rf-ins-bar income" />
                    <rect x={g.expenseX} y={g.expenseY} width={BAR_W} height={g.expenseH} rx="3" className="rf-ins-bar expense" />
                    <text
                      x={g.center}
                      y={204}
                      textAnchor="middle"
                      className={i === barGroups.length - 1 ? 'rf-ins-month-label current' : 'rf-ins-month-label'}
                    >
                      {g.label}
                    </text>
                  </g>
                ))}
              </svg>

              {activeMonth && (
                <div
                  className="rf-ins-tooltip"
                  style={{ left: `${(activeMonth.center / VIEW_W) * 100}%` }}
                >
                  <div className="rf-ins-tooltip-title">{activeMonth.label} 2026</div>
                  <div className="rf-ins-tooltip-row income">Income <b>{formatMoney(activeMonth.income)}</b></div>
                  <div className="rf-ins-tooltip-row expense">Expenses <b>{formatMoney(activeMonth.expenses)}</b></div>
                  <div className="rf-ins-tooltip-row">Net <b>{formatMoney(activeMonth.net)}</b></div>
                </div>
              )}
            </div>

            <div className="rf-card rf-ins-table-card">
              <div className="rf-ins-chart-title">Property performance</div>
              <div className="rf-ins-table-head">
                <span>Property</span><span>Occupancy</span><span className="rf-ins-num">Income /mo</span><span className="rf-ins-num">Status</span>
              </div>
              {sortedProperties.map((p) => {
                const pct = p.units > 0 ? Math.round((p.occupied / p.units) * 100) : 0;
                return (
                  <div className="rf-ins-table-row" key={p.id}>
                    <span className="rf-ins-prop-name">{p.address}</span>
                    <span className="rf-ins-occ-cell">
                      <span className="rf-ins-meter small"><span style={{ width: `${pct}%` }} /></span>
                      <span className="rf-ins-occ-frac">{p.occupied}/{p.units}</span>
                    </span>
                    <span className="rf-ins-num rf-ins-income-cell">{formatMoney(p.income)}</span>
                    <span className={`rf-ins-num rf-ins-status ${p.vacant === 0 ? 'good' : 'warn'}`}>
                      {p.vacant === 0 ? '✓ Full' : `${p.vacant} vacant`}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* RAIL */}
          <div className="rf-ins-rail">
            {topPerformer && (
              <div className="rf-card rf-ins-top-performer">
                <div className="rf-ins-rail-label">Top performer</div>
                <div className="rf-ins-top-name">{topPerformer.address}</div>
                <div className="rf-ins-top-row">
                  <span className={`rf-ins-badge ${topPerformer.vacant === 0 ? 'good' : 'warn'}`}>
                    {topPerformer.vacant === 0 ? '✓ Fully occupied' : `${topPerformer.vacant} vacant`}
                  </span>
                  <span className="rf-ins-top-income">{formatMoney(topPerformer.income)}/mo</span>
                </div>
              </div>
            )}

            <div className="rf-card rf-ins-rail-card">
              <div className="rf-ins-rail-head">
                <div className="rf-ins-rail-title">Expenses by category</div>
                <span className="rf-ins-rail-tag">6 mo</span>
              </div>
              {sortedCategories.length === 0 && <div className="rf-rail-empty">No expenses logged yet</div>}
              {sortedCategories.map((c) => (
                <div className="rf-ins-cat-row" key={c.category}>
                  <div className="rf-ins-cat-top">
                    <span>{categoryLabel(c.category)}</span>
                    <span className="rf-ins-cat-amount">{formatMoney(c.amount)}</span>
                  </div>
                  <div className="rf-ins-meter"><span style={{ width: `${Math.max(4, ((c.amount || 0) / maxCategoryAmount) * 100)}%` }} /></div>
                </div>
              ))}
            </div>

            <div className="rf-card rf-ins-rail-card">
              <div className="rf-ins-rail-head">
                <div className="rf-ins-rail-title">Vacant units</div>
                <span className="rf-ins-rail-tag warn">{summary.occupancy_units - summary.occupancy_occupied} open</span>
              </div>
              {vacantProperties.length === 0 && <div className="rf-rail-empty">No vacancies right now</div>}
              {vacantProperties.map((p) => (
                <div className="rf-ins-vacancy-row" key={p.id}>
                  <span className="rf-ins-dot" />
                  <div className="rf-ins-vacancy-text">
                    <div className="rf-ins-vacancy-name">{p.address}</div>
                    <div className="rf-ins-vacancy-sub">{p.vacant} unit{p.vacant === 1 ? '' : 's'} vacant &middot; ~{formatMoney(p.vacancy_loss)}/mo potential</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
