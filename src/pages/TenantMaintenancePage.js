import React, { useState, useEffect, useCallback } from 'react';
import { createClient } from '@supabase/supabase-js';
import TenantShell from '../components/TenantShell';

const supabase = createClient(
  process.env.REACT_APP_SUPABASE_URL,
  process.env.REACT_APP_SUPABASE_ANON_KEY
);

const STATUS_LABEL = { open: 'Open', in_progress: 'In progress', resolved: 'Resolved' };
const STATUS_BADGE = { open: 'warn', in_progress: 'neutral', resolved: 'good' };

function formatDate(value) {
  return new Date(value).toLocaleDateString();
}

async function getSession() {
  const { data: { session } } = await supabase.auth.getSession();
  return session;
}

export default function TenantMaintenancePage() {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [formOpen, setFormOpen] = useState(false);
  const [formError, setFormError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');

  const loadRequests = useCallback(async () => {
    try {
      const session = await getSession();
      if (!session) {
        setError('Please log in again.');
        return;
      }
      const res = await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/tenant-portal/maintenance`, {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to load maintenance requests');
      setRequests(data.requests || []);
    } catch (err) {
      console.error('Error loading maintenance requests:', err);
      setError('Could not load your maintenance requests. Please try again shortly.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadRequests();
  }, [loadRequests]);

  const submitRequest = async (e) => {
    e.preventDefault();
    setFormError('');
    if (!title.trim()) {
      setFormError('Give your request a short title.');
      return;
    }
    setSubmitting(true);
    try {
      const session = await getSession();
      if (!session) {
        setFormError('Please log in again.');
        return;
      }
      const res = await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/tenant-portal/maintenance`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ title: title.trim(), description: description.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to submit request');
      setTitle('');
      setDescription('');
      setFormOpen(false);
      await loadRequests();
    } catch (err) {
      setFormError(err.message || 'Failed to submit request.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <TenantShell active="maintenance">
      <div className="rf-page-header rf-page-header-row">
        <div>
          <h1>Maintenance</h1>
          <p>Submit a request and track its status</p>
        </div>
        <button className="rf-btn rf-btn-primary" onClick={() => setFormOpen((v) => !v)}>
          {formOpen ? 'Cancel' : 'New request'}
        </button>
      </div>

      {error && <div className="rf-alert-danger">{error}</div>}

      {formOpen && (
        <div className="rf-card" style={{ marginBottom: 24 }}>
          <h2 className="rf-section-title">New maintenance request</h2>
          <form onSubmit={submitRequest}>
            {formError && <div className="rf-alert-danger">{formError}</div>}
            <div className="rf-field">
              <label>Title</label>
              <input
                className="rf-input"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Leaking kitchen faucet"
                required
              />
            </div>
            <div className="rf-field">
              <label>Details (optional)</label>
              <textarea
                className="rf-input"
                rows={4}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Anything that would help your landlord understand the issue"
              />
            </div>
            <button type="submit" className="rf-btn rf-btn-primary" disabled={submitting}>
              {submitting ? 'Submitting...' : 'Submit request'}
            </button>
          </form>
        </div>
      )}

      {loading ? (
        <p className="rf-empty">Loading...</p>
      ) : requests.length === 0 ? (
        <p className="rf-empty">You haven't submitted any maintenance requests yet.</p>
      ) : (
        <div className="rf-table-wrap">
          <table className="rf-table">
            <thead>
              <tr>
                <th>Request</th>
                <th>Submitted</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {requests.map((r) => (
                <tr key={r.id}>
                  <td>
                    <div style={{ fontWeight: 600 }}>{r.title}</div>
                    {r.description && (
                      <div className="rf-prow-city" style={{ marginTop: 2 }}>{r.description}</div>
                    )}
                  </td>
                  <td>{formatDate(r.created_at)}</td>
                  <td><span className={`rf-badge ${STATUS_BADGE[r.status] || 'neutral'}`}>{STATUS_LABEL[r.status] || r.status}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </TenantShell>
  );
}
