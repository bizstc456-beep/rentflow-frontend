import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { createClient } from '@supabase/supabase-js';
import CountUp from '../components/CountUp';

const supabase = createClient(
  process.env.REACT_APP_SUPABASE_URL,
  process.env.REACT_APP_SUPABASE_ANON_KEY
);

// All money from the API is in cents (matches Stripe's convention, used
// consistently for rent_amount and payment amounts alike).
function formatMoney(cents) {
  return `$${((cents || 0) / 100).toFixed(2)}`;
}

function shortName(fullName) {
  if (!fullName) return 'A tenant';
  const parts = fullName.trim().split(/\s+/);
  if (parts.length === 1) return parts[0];
  return `${parts[0]} ${parts[parts.length - 1][0]}.`;
}

function shortDate(value) {
  if (!value) return '';
  return new Date(value).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

// The "Getting started" checklist's dismissal is a per-viewer convenience,
// not data that needs to sync across devices or reappear for other
// landlords -- localStorage is enough, and a bad/blocked store just means
// the checklist shows again, never a broken page.
function onboardingDismissKey(userId) {
  return `rf_onboarding_dismissed_${userId}`;
}

function readOnboardingDismissed(userId) {
  if (!userId) return false;
  try {
    return window.localStorage.getItem(onboardingDismissKey(userId)) === '1';
  } catch {
    return false;
  }
}

export default function LandlordDashboardPage() {
  const [summary, setSummary] = useState(null);
  const [properties, setProperties] = useState([]);
  const [renewalsSoon, setRenewalsSoon] = useState([]);
  const [tenants, setTenants] = useState([]);
  const [payments, setPayments] = useState([]);
  const [maintenanceRequests, setMaintenanceRequests] = useState([]);
  const [leaseRenewals, setLeaseRenewals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [userId, setUserId] = useState(null);
  const [onboardingDismissed, setOnboardingDismissed] = useState(false);

  useEffect(() => {
    loadDashboard();
  }, []);

  const loadDashboard = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        setError('Please log in again.');
        return;
      }

      const headers = { Authorization: `Bearer ${session.access_token}` };
      const base = process.env.REACT_APP_BACKEND_URL;

      setUserId(session.user.id);
      setOnboardingDismissed(readOnboardingDismissed(session.user.id));

      const res = await fetch(`${base}/api/dashboard/${session.user.id}`, { headers });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to load dashboard');
      }

      setSummary(data.summary);
      setProperties(data.properties || []);
      setRenewalsSoon(data.renewals_soon || []);
      setTenants(data.tenants || []);
      setPayments(data.payments || []);

      // Right-rail widgets are fetched separately and never block the core
      // dashboard from rendering, even if one of them is slow or fails.
      fetch(`${base}/api/maintenance/landlord/${session.user.id}`, { headers })
        .then((r) => r.json())
        .then((d) => setMaintenanceRequests(d.requests || []))
        .catch(() => {});

      fetch(`${base}/api/lease-renewals/landlord/${session.user.id}`, { headers })
        .then((r) => r.json())
        .then((d) => setLeaseRenewals(d.renewals || []))
        .catch(() => {});
    } catch (err) {
      console.error('Error loading dashboard:', err);
      setError('Could not load your dashboard. Please try again shortly.');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <div className="rf-state"><p>Loading your dashboard...</p></div>;
  }

  if (error) {
    return <div className="rf-state"><p>{error}</p></div>;
  }

  const hasPending = summary.pending_amount > 0;
  const hasRenewals = renewalsSoon.length > 0;
  const monthLabel = new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

  const tenantNameById = {};
  tenants.forEach((t) => { tenantNameById[t.id] = t.name; });

  const paymentActivity = payments
    .filter((p) => p.status === 'paid')
    .map((p) => ({
      key: `payment-${p.id}`,
      dot: 'good',
      text: `${shortName(tenantNameById[p.tenant_id])} paid ${formatMoney(p.amount)}`,
      date: p.payment_date || p.created_at,
    }));

  const maintenanceActivity = maintenanceRequests.map((r) => ({
    key: `maint-${r.id}`,
    dot: 'accent',
    text: `New maintenance request — ${r.properties?.address || 'a property'}`,
    date: r.created_at,
  }));

  const recentActivity = [...paymentActivity, ...maintenanceActivity]
    .filter((a) => a.date)
    .sort((a, b) => new Date(b.date) - new Date(a.date))
    .slice(0, 5);

  const openMaintenance = maintenanceRequests.filter(
    (r) => r.status === 'open' || r.status === 'in_progress'
  );
  const maintenancePreview = openMaintenance.slice(0, 2);

  const renewalPreview = leaseRenewals
    .filter((r) => r.status === 'in_window' || r.status === 'upcoming')
    .slice(0, 2);

  // "Getting started" checklist -- driven by real data, not its own tracked
  // state, so it never drifts from what the account has actually done.
  // The payment step only sees this month's payments (the dashboard doesn't
  // fetch full history), which is a fine trade-off for an onboarding aid
  // aimed at brand-new accounts.
  const onboardingSteps = [
    {
      key: 'property',
      label: 'Add your first property',
      done: properties.length > 0,
      cta: 'Add property',
      to: '/properties?new=1',
    },
    {
      key: 'tenant',
      label: 'Add your first tenant',
      done: tenants.length > 0,
      cta: 'Add tenant',
      to: '/properties',
    },
    {
      key: 'payment',
      label: 'Record your first payment',
      done: (summary.total_collected_this_month || 0) > 0,
      cta: 'Record payment',
      to: '/properties',
    },
  ];
  const onboardingDoneCount = onboardingSteps.filter((s) => s.done).length;
  const showOnboarding = onboardingDoneCount < onboardingSteps.length && !onboardingDismissed;

  const dismissOnboarding = () => {
    setOnboardingDismissed(true);
    try {
      window.localStorage.setItem(onboardingDismissKey(userId), '1');
    } catch {
      // Best-effort -- worst case the checklist reappears next visit.
    }
  };

  return (
    <div className="rf-dash">
      <div className="rf-dash-grid">
        <div className="rf-dash-main">
          {showOnboarding && (
            <div className="rf-onboarding rf-anim-in">
              <div className="rf-onboarding-head">
                <div className="rf-onboarding-title">
                  <span>Getting started</span>
                  <span className="rf-onboarding-progress">{onboardingDoneCount} of {onboardingSteps.length}</span>
                </div>
                <button
                  type="button"
                  className="rf-onboarding-close"
                  onClick={dismissOnboarding}
                  aria-label="Dismiss getting started checklist"
                >
                  &times;
                </button>
              </div>
              <div className="rf-onboarding-steps">
                {(() => {
                  const firstIncompleteIndex = onboardingSteps.findIndex((s) => !s.done);
                  return onboardingSteps.map((step, i) => {
                    const isCurrent = i === firstIncompleteIndex;
                    return (
                      <div
                        className={`rf-onboarding-step ${step.done ? 'done' : ''} ${isCurrent ? 'current' : ''}`}
                        key={step.key}
                      >
                        <div className="rf-onboarding-step-left">
                          <span className="rf-onboarding-check">{step.done ? '✓' : ''}</span>
                          <span className="rf-onboarding-label">{step.label}</span>
                        </div>
                        {isCurrent && (
                          <Link to={step.to} className="rf-onboarding-cta">{step.cta} &rarr;</Link>
                        )}
                      </div>
                    );
                  });
                })()}
              </div>
            </div>
          )}

          <p className="rf-greet">Overview &middot; {monthLabel}</p>

          <div className="rf-hero">
            <span className="rf-hero-num">
              <CountUp
                value={(summary.total_collected_this_month || 0) / 100}
                format={(n) => `$${n.toFixed(2)}`}
              />
            </span>
            <span className="rf-hero-label">collected this month</span>
          </div>

          <div className="rf-chips">
            <div className="rf-chip">
              <b><CountUp value={summary.total_properties} /></b>
              <span>properties</span>
            </div>
            <div className="rf-chip">
              <b><CountUp value={summary.total_tenants} /></b>
              <span>tenants</span>
            </div>
            <div className="rf-chip">
              <b>
                <CountUp
                  value={(summary.pending_amount || 0) / 100}
                  format={(n) => `$${n.toFixed(2)}`}
                />
              </b>
              <span>pending</span>
            </div>
          </div>

          {hasPending && (
            <div className="rf-banner">
              <div>
                <div className="rf-banner-title">You have {formatMoney(summary.pending_amount)} pending this month</div>
                <div className="rf-banner-sub">Check the properties below for who's behind, then follow up from Messages.</div>
              </div>
              <Link to="/messages" className="rf-banner-btn">Go to Messages</Link>
            </div>
          )}

          {hasRenewals && (
            <div className="rf-banner">
              <div>
                <div className="rf-banner-title">
                  {renewalsSoon.length === 1 ? 'A lease ends' : `${renewalsSoon.length} leases end`} within 90 days
                </div>
                <div className="rf-banner-sub">
                  {renewalsSoon.map((t) => t.name).join(', ')} &mdash; Quebec's TAL notice window is open, so send any
                  rent-increase or non-renewal notice now.
                </div>
              </div>
              <Link to="/properties" className="rf-banner-btn">Go to Properties</Link>
            </div>
          )}

          <div className="rf-page-header-row">
            <h2 className="rf-section-title" style={{ margin: 0 }}>Your properties</h2>
            <Link to="/properties" className="rf-btn rf-btn-secondary">Manage properties</Link>
          </div>

          {properties.length === 0 ? (
            <p className="rf-empty">
              You haven't added any properties yet. <Link to="/properties">Add your first property</Link> to get started.
            </p>
          ) : (
            <div className="rf-plist">
              {properties.map((p) => {
                const unitCount = (p.tenants || []).length;
                return (
                  <div className="rf-prow" key={p.id}>
                    <div>
                      <div className="rf-prow-addr">{p.address}</div>
                      <div className="rf-prow-city">
                        {p.city}{unitCount ? ` · ${unitCount} unit${unitCount === 1 ? '' : 's'}` : ''}
                      </div>
                    </div>
                    <div className="rf-prow-rent">{formatMoney(p.collected_this_month + p.pending_amount)}/mo</div>
                    <span className={`rf-dot-status ${p.status === 'paid' ? 'good' : 'warn'}`}>
                      {p.status === 'paid' ? 'Paid' : `${formatMoney(p.pending_amount)} pending`}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="rf-rail">
          <div className="rf-rail-card rf-anim-in" style={{ animationDelay: '0ms' }}>
            <div className="rf-rail-card-title">Quick actions</div>
            <div className="rf-quick-actions">
              <Link to="/properties?new=1" className="rf-quick-action">+ Add property</Link>
              <Link to="/properties" className="rf-quick-action">Record payment</Link>
              <Link to="/properties" className="rf-quick-action">Invite tenant</Link>
              <Link to="/reports?new=1" className="rf-quick-action">Log expense</Link>
            </div>
          </div>

          <div className="rf-rail-card rf-anim-in" style={{ animationDelay: '70ms' }}>
            <div className="rf-rail-card-title">Recent activity</div>
            {recentActivity.length === 0 ? (
              <p className="rf-rail-empty">Nothing yet this month.</p>
            ) : (
              <div className="rf-activity-list">
                {recentActivity.map((a) => (
                  <div className="rf-activity-row" key={a.key}>
                    <span className={`rf-activity-dot ${a.dot}`} />
                    <span className="rf-activity-text">{a.text}</span>
                    <span className="rf-activity-date">{shortDate(a.date)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="rf-rail-card rf-anim-in" style={{ animationDelay: '140ms' }}>
            <div className="rf-rail-card-head">
              <span className="rf-rail-card-title">Maintenance</span>
              <Link to="/maintenance" className="rf-rail-view-all">View all</Link>
            </div>
            <div className="rf-rail-count">
              <b>{openMaintenance.length}</b>
              <span>open request{openMaintenance.length === 1 ? '' : 's'}</span>
            </div>
            {maintenancePreview.length === 0 ? (
              <p className="rf-rail-empty">Nothing open right now.</p>
            ) : (
              <div className="rf-rail-mini-list">
                {maintenancePreview.map((r) => (
                  <div className="rf-rail-mini-row" key={r.id}>
                    <span>{r.title}{r.tenants?.unit_label ? ` — ${r.tenants.unit_label}` : ''}</span>
                    <span className={`rf-badge ${r.status === 'open' ? 'warn rf-badge-pulse' : 'neutral'}`}>
                      {r.status === 'open' ? 'Open' : 'In progress'}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="rf-rail-card rf-anim-in" style={{ animationDelay: '210ms' }}>
            <div className="rf-rail-card-head">
              <span className="rf-rail-card-title">Lease renewals</span>
              <Link to="/renewals" className="rf-rail-view-all">View all</Link>
            </div>
            {renewalPreview.length === 0 ? (
              <p className="rf-rail-empty">No renewal windows open right now.</p>
            ) : (
              <div className="rf-rail-mini-list">
                {renewalPreview.map((r) => (
                  <div className="rf-rail-mini-row" key={r.tenant_id}>
                    <span>{shortName(r.tenant_name)} &mdash; ends {shortDate(r.lease_end_date)}</span>
                    <span className={`rf-badge ${r.status === 'in_window' ? 'warn' : 'muted'}`}>
                      {r.status === 'in_window' ? 'Window open' : 'Upcoming'}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
