import React, { useState, useEffect, useCallback } from 'react';
import { createClient } from '@supabase/supabase-js';
import AppShell from '../components/AppShell';

const supabase = createClient(
  process.env.REACT_APP_SUPABASE_URL,
  process.env.REACT_APP_SUPABASE_ANON_KEY
);

const STATUSES = [
  { value: 'open', label: 'Open', badge: 'warn' },
  { value: 'in_progress', label: 'In progress', badge: 'neutral' },
  { value: 'resolved', label: 'Resolved', badge: 'good' },
];

function statusMeta(value) {
  return STATUSES.find((s) => s.value === value) || STATUSES[0];
}

function formatDate(value) {
  if (!value) return '';
  return new Date(value).toLocaleDateString();
}

async function getSession() {
  const { data: { session } } = await supabase.auth.getSession();
  return session;
}

export default function MaintenancePage() {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [updatingId, setUpdatingId] = useState(null);
  const [filter, setFilter] = useState('open'); // 'open' | 'all'

  const loadRequests = useCallback(async () => {
    try {
      const session = await getSession();
      if (!session) {
        setError('Please log in again.');
        return;
      }
      const res = await fetch(
        `${process.env.REACT_APP_BACKEND_URL}/api/maintenance/landlord/${session.user.id}`,
        { headers: { Authorization: `Bearer ${session.access_token}` } }
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to load maintenance requests');
      setRequests(data.requests || []);
    } catch (err) {
      console.error('Error loading maintenance requests:', err);
      setError('Could not load maintenance requests. Please try again shortly.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadRequests();
  }, [loadRequests]);

  const updateStatus = async (request, status) => {
    setUpdatingId(request.id);
    setError('');
    try {
      const session = await getSession();
      if (!session) {
        setError('Please log in again.');
        return;
      }
      const res = await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/maintenance/${request.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ status }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to update request');
      setRequests((prev) => prev.map((r) => (r.id === request.id ? { ...r, status } : r)));
    } catch (err) {
      setError(err.message || 'Failed to update request.');
    } finally {
      setUpdatingId(null);
    }
  };

  const visibleRequests = filter === 'open'
    ? requests.filter((r) => r.status !== 'resolved')
    : requests;

  if (loading) {
    return (
      <AppShell active="maintenance">
        <div className="rf-page-header">
          <h1>Maintenance</h1>
          <p>Requests your tenants have submitted through their portal</p>
        </div>
        <p className="rf-empty">Loading...</p>
      </AppShell>
    );
  }

  return (
    <AppShell active="maintenance">
      <div className="rf-page-header">
        <h1>Maintenance</h1>
        <p>Requests your tenants have submitted through their portal</p>
      </div>

      {error && <div className="rf-alert-danger">{error}</div>}

      <div className="rf-card" style={{ marginBottom: 20 }}>
        <div className="rf-range-presets">
          <button
            className={`rf-btn ${filter === 'open' ? 'rf-btn-primary' : 'rf-btn-secondary'}`}
            onClick={() => setFilter('open')}
          >
            Open &amp; in progress
          </button>
          <button
            className={`rf-btn ${filter === 'all' ? 'rf-btn-primary' : 'rf-btn-secondary'}`}
            onClick={() => setFilter('all')}
          >
            All requests
          </button>
        </div>
      </div>

      {visibleRequests.length === 0 ? (
        <p className="rf-empty">
          {requests.length === 0
            ? 'No maintenance requests yet. Once you invite tenants to their portal, requests they submit will show up here.'
            : 'Nothing open right now.'}
        </p>
      ) : (
        <div className="rf-table-wrap">
          <table className="rf-table">
            <thead>
              <tr>
                <th>Property</th>
                <th>Tenant</th>
                <th>Request</th>
                <th>Submitted</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {visibleRequests.map((r) => {
                const meta = statusMeta(r.status);
                return (
                  <tr key={r.id}>
                    <td>{r.properties?.address || '—'}</td>
                    <td>
                      {r.tenants?.name || '—'}
                      {r.tenants?.unit_label ? ` — ${r.tenants.unit_label}` : ''}
                    </td>
                    <td>
                      <div style={{ fontWeight: 600 }}>{r.title}</div>
                      {r.description && (
                        <div className="rf-prow-city" style={{ marginTop: 2 }}>{r.description}</div>
                      )}
                    </td>
                    <td>{formatDate(r.created_at)}</td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <span className={`rf-badge ${meta.badge}`}>{meta.label}</span>
                        <select
                          className="rf-input"
                          style={{ width: 'auto', padding: '4px 8px', fontSize: 12.5 }}
                          value={r.status}
                          disabled={updatingId === r.id}
                          onChange={(e) => updateStatus(r, e.target.value)}
                        >
                          {STATUSES.map((s) => (
                            <option key={s.value} value={s.value}>{s.label}</option>
                          ))}
                        </select>
                      </div>
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
