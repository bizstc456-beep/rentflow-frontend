import React, { useState, useEffect, useCallback } from 'react';
import { createClient } from '@supabase/supabase-js';
import AppShell from '../components/AppShell';

const supabase = createClient(
  process.env.REACT_APP_SUPABASE_URL,
  process.env.REACT_APP_SUPABASE_ANON_KEY
);

const STATUS_META = {
  upcoming: { label: 'Upcoming', badge: 'neutral' },
  in_window: { label: 'Notice window open', badge: 'warn' },
  window_passed: { label: 'Window passed — act now', badge: 'warn' },
  lease_ended: { label: 'Lease ended', badge: 'good' },
};

function formatDate(value) {
  if (!value) return '—';
  return new Date(value).toLocaleDateString();
}

async function getSession() {
  const { data: { session } } = await supabase.auth.getSession();
  return session;
}

export default function LeaseRenewalsPage() {
  const [renewals, setRenewals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [updatingId, setUpdatingId] = useState(null);
  const [filter, setFilter] = useState('attention'); // 'attention' | 'all'

  const loadRenewals = useCallback(async () => {
    try {
      const session = await getSession();
      if (!session) {
        setError('Please log in again.');
        return;
      }
      const res = await fetch(
        `${process.env.REACT_APP_BACKEND_URL}/api/lease-renewals/landlord/${session.user.id}`,
        { headers: { Authorization: `Bearer ${session.access_token}` } }
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to load lease renewals');
      setRenewals(data.renewals || []);
    } catch (err) {
      console.error('Error loading lease renewals:', err);
      setError('Could not load lease renewals. Please try again shortly.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadRenewals();
  }, [loadRenewals]);

  const markSent = async (renewal) => {
    setUpdatingId(renewal.tenant_id);
    setError('');
    try {
      const session = await getSession();
      if (!session) {
        setError('Please log in again.');
        return;
      }
      const res = await fetch(
        `${process.env.REACT_APP_BACKEND_URL}/api/tenants/${renewal.tenant_id}/renewal-notice-sent`,
        { method: 'POST', headers: { Authorization: `Bearer ${session.access_token}` } }
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to update');
      setRenewals((prev) => prev.map((r) =>
        r.tenant_id === renewal.tenant_id ? { ...r, renewal_notice_sent_at: data.tenant.renewal_notice_sent_at } : r
      ));
    } catch (err) {
      setError(err.message || 'Failed to update.');
    } finally {
      setUpdatingId(null);
    }
  };

  const undoSent = async (renewal) => {
    setUpdatingId(renewal.tenant_id);
    setError('');
    try {
      const session = await getSession();
      if (!session) {
        setError('Please log in again.');
        return;
      }
      const res = await fetch(
        `${process.env.REACT_APP_BACKEND_URL}/api/tenants/${renewal.tenant_id}/renewal-notice-sent`,
        { method: 'DELETE', headers: { Authorization: `Bearer ${session.access_token}` } }
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to update');
      setRenewals((prev) => prev.map((r) =>
        r.tenant_id === renewal.tenant_id ? { ...r, renewal_notice_sent_at: null } : r
      ));
    } catch (err) {
      setError(err.message || 'Failed to update.');
    } finally {
      setUpdatingId(null);
    }
  };

  const visible = filter === 'attention'
    ? renewals.filter((r) => !r.renewal_notice_sent_at && (r.status === 'in_window' || r.status === 'window_passed'))
    : renewals;

  if (loading) {
    return (
      <AppShell active="renewals">
        <div className="rf-page-header">
          <h1>Lease Renewals</h1>
          <p>Quebec TAL notice-window tracking for upcoming lease ends</p>
        </div>
        <p className="rf-empty">Loading...</p>
      </AppShell>
    );
  }

  return (
    <AppShell active="renewals">
      <div className="rf-page-header">
        <h1>Lease Renewals</h1>
        <p>Quebec TAL notice-window tracking for upcoming lease ends</p>
      </div>

      {error && <div className="rf-alert-danger">{error}</div>}

      <div className="rf-alert-danger" style={{ background: 'var(--rf-accent-soft)', color: 'var(--rf-accent)', border: '1px solid rgba(124,58,237,0.25)' }}>
        General reference only, not legal advice: Quebec's TAL generally requires notice of a rent
        increase or lease change 3–6 months before a lease of 12+ months ends, or 1–2 months before
        a shorter fixed-term lease ends. Confirm the exact requirements for your situation before acting.
      </div>

      <div className="rf-card" style={{ marginBottom: 20 }}>
        <div className="rf-range-presets">
          <button
            className={`rf-btn ${filter === 'attention' ? 'rf-btn-primary' : 'rf-btn-secondary'}`}
            onClick={() => setFilter('attention')}
          >
            Needs attention
          </button>
          <button
            className={`rf-btn ${filter === 'all' ? 'rf-btn-primary' : 'rf-btn-secondary'}`}
            onClick={() => setFilter('all')}
          >
            All leases with an end date
          </button>
        </div>
      </div>

      {visible.length === 0 ? (
        <p className="rf-empty">
          {renewals.length === 0
            ? "No tenants have a lease end date on file yet, so there's nothing to track."
            : "Nothing needs attention right now."}
        </p>
      ) : (
        <div className="rf-table-wrap">
          <table className="rf-table">
            <thead>
              <tr>
                <th>Property</th>
                <th>Tenant</th>
                <th>Lease ends</th>
                <th>Notice window</th>
                <th>Status</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {visible.map((r) => {
                const meta = STATUS_META[r.status] || STATUS_META.upcoming;
                return (
                  <tr key={r.tenant_id}>
                    <td>{r.property_address || '—'}</td>
                    <td>{r.tenant_name}{r.unit_label ? ` — ${r.unit_label}` : ''}</td>
                    <td>{formatDate(r.lease_end_date)}</td>
                    <td>
                      {formatDate(r.window_start)} – {formatDate(r.window_end)}
                      <div className="rf-prow-city" style={{ marginTop: 2 }}>{r.bracket}</div>
                    </td>
                    <td><span className={`rf-badge ${meta.badge}`}>{meta.label}</span></td>
                    <td>
                      {r.renewal_notice_sent_at ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <span className="rf-badge good">Sent {formatDate(r.renewal_notice_sent_at)}</span>
                          <button
                            className="rf-btn rf-btn-secondary"
                            disabled={updatingId === r.tenant_id}
                            onClick={() => undoSent(r)}
                          >
                            Undo
                          </button>
                        </div>
                      ) : (
                        <button
                          className="rf-btn rf-btn-primary"
                          disabled={updatingId === r.tenant_id}
                          onClick={() => markSent(r)}
                        >
                          {updatingId === r.tenant_id ? 'Saving...' : 'Mark notice sent'}
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </AppShell>
  );
}
