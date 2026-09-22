import React, { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';
import AppShell from '../components/AppShell';
import CountUp from '../components/CountUp';

const supabase = createClient(
  process.env.REACT_APP_SUPABASE_URL,
  process.env.REACT_APP_SUPABASE_ANON_KEY
);

const MS_PER_DAY = 24 * 60 * 60 * 1000;

const REASON_LABEL = {
  no_properties: 'No properties',
  payment_failed: 'Payment failed',
};

function shortDate(value) {
  if (!value) return '';
  return new Date(value).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

// Turns a list of weekly signup counts into an SVG sparkline (area fill +
// line + a dot on the latest point), scaled to a fixed 300x64 viewBox.
function buildSparkline(counts) {
  if (!counts || counts.length === 0) return null;
  const max = Math.max(...counts, 1);
  const min = Math.min(...counts, 0);
  const w = 300;
  const h = 64;
  const padTop = 8;
  const padBottom = 8;
  const usableH = h - padTop - padBottom;
  const stepX = counts.length > 1 ? w / (counts.length - 1) : 0;

  const points = counts.map((c, i) => {
    const x = i * stepX;
    const ratio = max === min ? 0.5 : (c - min) / (max - min);
    const y = padTop + (1 - ratio) * usableH;
    return [x, y];
  });

  const linePath = points.map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`).join(' ');
  const areaPath = `${linePath} L${w.toFixed(1)},${h} L0,${h} Z`;

  return { linePath, areaPath, last: points[points.length - 1] };
}

export default function AdminDashboardPage() {
  const [stats, setStats] = useState({
    totalUsers: 0,
    totalProperties: 0,
    totalTenants: 0,
    totalRevenue: 0,
    paymentsThisMonth: 0,
    maintenanceOpen: 0,
    propertiesThisWeek: 0,
  });
  const [users, setUsers] = useState([]);
  const [signupsByWeek, setSignupsByWeek] = useState([]);
  const [needsAttention, setNeedsAttention] = useState([]);
  const [loading, setLoading] = useState(true);
  const [accessDenied, setAccessDenied] = useState(false);

  useEffect(() => {
    loadAdminData();
  }, []);

  const loadAdminData = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        setAccessDenied(true);
        return;
      }

      // Admin stats are fetched through the backend, which uses the service-role
      // key server-side and checks the caller's email against an admin allowlist.
      // This can never be done safely with a direct client-side Supabase call.
      const res = await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/admin/stats`, {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });

      if (res.status === 401 || res.status === 403) {
        setAccessDenied(true);
        return;
      }

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to load admin data');
      }

      setStats(data.stats);
      setUsers(data.users || []);
      setSignupsByWeek(data.signupsByWeek || []);
      setNeedsAttention(data.needsAttention || []);
    } catch (error) {
      console.error('Error loading admin data:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <AppShell active="admin">
        <div className="rf-state"><p>Loading admin data...</p></div>
      </AppShell>
    );
  }

  if (accessDenied) {
    return (
      <AppShell active="admin">
        <div className="rf-state"><p>You don't have access to this page.</p></div>
      </AppShell>
    );
  }

  const spark = buildSparkline(signupsByWeek.map((w) => w.count));
  const signupsTotal = signupsByWeek.reduce((sum, w) => sum + w.count, 0);

  return (
    <AppShell active="admin" wide>
      <div className="rf-page-header">
        <h1>Admin Dashboard</h1>
        <p>Rentflow platform overview</p>
      </div>

      <div className="rf-statgrid">
        <div className="rf-statcard rf-anim-in" style={{ animationDelay: '0ms' }}>
          <div className="k">Total Users</div>
          <div className="v"><CountUp value={stats.totalUsers} /></div>
        </div>
        <div className="rf-statcard rf-anim-in" style={{ animationDelay: '50ms' }}>
          <div className="k">Properties</div>
          <div className="v"><CountUp value={stats.totalProperties} /></div>
        </div>
        <div className="rf-statcard rf-anim-in" style={{ animationDelay: '100ms' }}>
          <div className="k">Tenants</div>
          <div className="v"><CountUp value={stats.totalTenants} /></div>
        </div>
        <div className="rf-statcard rf-anim-in" style={{ animationDelay: '150ms' }}>
          <div className="k">Total Revenue</div>
          <div className="v">
            <CountUp value={(stats.totalRevenue || 0) / 100} format={(n) => `$${n.toFixed(2)}`} />
          </div>
        </div>
      </div>

      <div className="rf-dash-grid">
        <div className="rf-dash-main">
          <h2 className="rf-section-title">Registered users</h2>
          <div className="rf-table-wrap">
            <table className="rf-table">
              <thead>
                <tr>
                  <th>Email</th>
                  <th>Created</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {users.map((user) => (
                  <tr key={user.id}>
                    <td>{user.email}</td>
                    <td>{new Date(user.created_at).toLocaleDateString()}</td>
                    <td>
                      <span className={`rf-badge ${user.confirmed_at ? 'good' : 'warn'}`}>
                        {user.confirmed_at ? 'Active' : 'Pending'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="rf-rail">
          <div className="rf-rail-card rf-anim-in" style={{ animationDelay: '0ms' }}>
            <div className="rf-rail-card-title">Signups</div>
            <div className="rf-signups-delta">
              <b>+{signupsTotal}</b>
              <span>last 8 weeks</span>
            </div>
            {spark && (
              <svg viewBox="0 0 300 64" width="100%" height="64" style={{ display: 'block' }}>
                <defs>
                  <linearGradient id="rf-sparkfill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#7c3aed" stopOpacity="0.22" />
                    <stop offset="100%" stopColor="#7c3aed" stopOpacity="0" />
                  </linearGradient>
                </defs>
                <path d={spark.areaPath} fill="url(#rf-sparkfill)" />
                <path
                  d={spark.linePath}
                  fill="none"
                  stroke="#7c3aed"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                <circle cx={spark.last[0]} cy={spark.last[1]} r="3.5" fill="#7c3aed" />
              </svg>
            )}
          </div>

          <div className="rf-rail-card rf-anim-in" style={{ animationDelay: '70ms' }}>
            <div className="rf-rail-card-title">Needs attention</div>
            {needsAttention.length === 0 ? (
              <p className="rf-rail-empty">Nothing needs attention right now.</p>
            ) : (
              <div className="rf-activity-list">
                {needsAttention.map((n, i) => {
                  const daysAgo = n.since
                    ? Math.max(0, Math.floor((Date.now() - new Date(n.since)) / MS_PER_DAY))
                    : null;
                  const detail = n.reason === 'payment_failed'
                    ? `Subscription past due since ${shortDate(n.since)}`
                    : `Signed up ${daysAgo} day${daysAgo === 1 ? '' : 's'} ago, onboarding stalled`;
                  return (
                    <div className="rf-attention-row" key={`${n.email}-${i}`}>
                      <div className="rf-attention-head">
                        <span className="rf-attention-email">{n.email}</span>
                        <span className={`rf-badge ${n.reason === 'payment_failed' ? 'danger' : 'warn'}`}>
                          {REASON_LABEL[n.reason] || n.reason}
                        </span>
                      </div>
                      <div className="rf-attention-reason">{detail}</div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="rf-rail-card rf-anim-in" style={{ animationDelay: '140ms' }}>
            <div className="rf-rail-card-title">Platform activity</div>
            <div className="rf-rail-mini-list">
              <div className="rf-activity-stat-row">
                <span>Payments processed</span>
                <span>{stats.paymentsThisMonth} this month</span>
              </div>
              <div className="rf-activity-stat-row">
                <span>Maintenance requests open</span>
                <span>{stats.maintenanceOpen} platform-wide</span>
              </div>
              <div className="rf-activity-stat-row">
                <span>Properties added</span>
                <span>{stats.propertiesThisWeek} this week</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
