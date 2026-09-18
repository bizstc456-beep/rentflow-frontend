import React, { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';
import TenantShell from '../components/TenantShell';

const supabase = createClient(
  process.env.REACT_APP_SUPABASE_URL,
  process.env.REACT_APP_SUPABASE_ANON_KEY
);

function formatMoney(cents) {
  return `$${((cents || 0) / 100).toFixed(2)}`;
}

function formatDate(value) {
  if (!value) return '—';
  return new Date(value).toLocaleDateString();
}

export default function TenantPortalPage() {
  const [tenant, setTenant] = useState(null);
  const [property, setProperty] = useState(null);
  const [payments, setPayments] = useState([]);
  const [balance, setBalance] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadAll = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        setError('Please log in again.');
        return;
      }
      const backend = process.env.REACT_APP_BACKEND_URL;
      const authHeaders = { Authorization: `Bearer ${session.access_token}` };

      const [meRes, paymentsRes] = await Promise.all([
        fetch(`${backend}/api/tenant-portal/me`, { headers: authHeaders }),
        fetch(`${backend}/api/tenant-portal/payments`, { headers: authHeaders }),
      ]);
      const meData = await meRes.json();
      const paymentsData = await paymentsRes.json();

      if (!meRes.ok) throw new Error(meData.error || 'Failed to load your rental info');
      if (!paymentsRes.ok) throw new Error(paymentsData.error || 'Failed to load your payment history');

      setTenant(meData.tenant);
      setProperty(meData.property);
      setPayments(paymentsData.payments || []);
      setBalance(paymentsData.balance);
    } catch (err) {
      console.error('Error loading tenant portal:', err);
      setError(err.message || 'Could not load your rental info. Please try again shortly.');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <TenantShell active="rental">
        <div className="rf-page-header">
          <h1>My Rental</h1>
        </div>
        <p className="rf-empty">Loading...</p>
      </TenantShell>
    );
  }

  return (
    <TenantShell active="rental">
      <div className="rf-page-header">
        <h1>My Rental</h1>
        <p>{property ? property.address : 'Your lease details'}</p>
      </div>

      {error && <div className="rf-alert-danger">{error}</div>}

      {tenant && (
        <>
          <div className="rf-chips">
            <div className="rf-chip"><b>{formatMoney(tenant.rent_amount)}</b><span>monthly rent</span></div>
            {balance && (
              <div className="rf-chip">
                <b>{balance.status === 'paid' ? 'Paid up' : formatMoney(balance.pending_amount)}</b>
                <span>{balance.status === 'paid' ? 'this month' : 'due this month'}</span>
              </div>
            )}
            <div className="rf-chip"><b>{formatDate(tenant.lease_end_date)}</b><span>lease ends</span></div>
          </div>

          <div className="rf-card" style={{ marginBottom: 24 }}>
            <h2 className="rf-section-title">Lease details</h2>
            <div className="rf-prow-city">
              Unit: {tenant.unit_label || '—'}<br />
              Lease start: {formatDate(tenant.lease_start_date)}<br />
              Lease end: {formatDate(tenant.lease_end_date)}
            </div>
          </div>

          <h2 className="rf-section-title">Payment history</h2>
          {payments.length === 0 ? (
            <p className="rf-empty">No payments recorded yet.</p>
          ) : (
            <div className="rf-table-wrap">
              <table className="rf-table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Amount</th>
                    <th>Method</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {payments.map((p) => (
                    <tr key={p.id}>
                      <td>{formatDate(p.payment_date || p.created_at)}</td>
                      <td>{formatMoney(p.amount)}</td>
                      <td>{p.payment_method || '—'}</td>
                      <td>
                        <span className={`rf-badge ${p.status === 'paid' ? 'good' : 'warn'}`}>
                          {p.status === 'paid' ? 'Paid' : p.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </TenantShell>
  );
}
