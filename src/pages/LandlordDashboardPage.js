import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.REACT_APP_SUPABASE_URL,
  process.env.REACT_APP_SUPABASE_ANON_KEY
);

// All money from the API is in cents (matches Stripe's convention, used
// consistently for rent_amount and payment amounts alike).
function formatMoney(cents) {
  return `$${((cents || 0) / 100).toFixed(2)}`;
}

export default function LandlordDashboardPage() {
  const [summary, setSummary] = useState(null);
  const [properties, setProperties] = useState([]);
  const [renewalsSoon, setRenewalsSoon] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

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

      const res = await fetch(
        `${process.env.REACT_APP_BACKEND_URL}/api/dashboard/${session.user.id}`,
        { headers: { Authorization: `Bearer ${session.access_token}` } }
      );
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to load dashboard');
      }

      setSummary(data.summary);
      setProperties(data.properties || []);
      setRenewalsSoon(data.renewals_soon || []);
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

  return (
    <div className="rf-dash">
      <p className="rf-greet">Overview &middot; {monthLabel}</p>

      <div className="rf-hero">
        <span className="rf-hero-num">{formatMoney(summary.total_collected_this_month)}</span>
        <span className="rf-hero-label">collected this month</span>
      </div>

      <div className="rf-chips">
        <div className="rf-chip"><b>{summary.total_properties}</b><span>properties</span></div>
        <div className="rf-chip"><b>{summary.total_tenants}</b><span>tenants</span></div>
        <div className="rf-chip"><b>{formatMoney(summary.pending_amount)}</b><span>pending</span></div>
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
  );
}
