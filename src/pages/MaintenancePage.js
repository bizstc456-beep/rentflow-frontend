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

// Keep in sync with VENDOR_TRADES in the backend.
const VENDOR_TRADES = [
  { value: 'general', label: 'General maintenance' },
  { value: 'plumbing', label: 'Plumbing' },
  { value: 'electrical', label: 'Electrical' },
  { value: 'hvac', label: 'HVAC' },
  { value: 'cleaning', label: 'Cleaning' },
  { value: 'landscaping', label: 'Landscaping' },
  { value: 'pest_control', label: 'Pest control' },
  { value: 'locksmith', label: 'Locksmith' },
  { value: 'other', label: 'Other' },
];

const EMPTY_VENDOR = { trade: 'general', name: '', phone: '', email: '' };

function statusMeta(value) {
  return STATUSES.find((s) => s.value === value) || STATUSES[0];
}

function tradeLabel(value) {
  return VENDOR_TRADES.find((t) => t.value === value)?.label || 'General maintenance';
}

function formatDate(value) {
  if (!value) return '';
  return new Date(value).toLocaleDateString();
}

async function getSession() {
  const { data: { session } } = await supabase.auth.getSession();
  return session;
}

function PhoneIcon() {
  return (
    <svg viewBox="0 0 16 16" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3.5 2h2.2l1 2.8-1.4 1.2a8 8 0 0 0 3.7 3.7l1.2-1.4 2.8 1v2.2c0 .8-.7 1.4-1.5 1.3A11 11 0 0 1 2.2 3.5C2.1 2.7 2.7 2 3.5 2Z" />
    </svg>
  );
}

function MailIcon() {
  return (
    <svg viewBox="0 0 16 16" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="3.5" width="12" height="9" rx="1.5" />
      <path d="m2.5 4.5 5.5 4 5.5-4" />
    </svg>
  );
}

function PencilIcon() {
  return (
    <svg viewBox="0 0 16 16" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
      <path d="M11 2.5 13.5 5 5.5 13H3v-2.5L11 2.5Z" />
    </svg>
  );
}

function TrashIcon() {
  return (
    <svg viewBox="0 0 16 16" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 4.5h10M6.5 4.5V3a1 1 0 0 1 1-1h1a1 1 0 0 1 1 1v1.5M4.5 4.5 5 13a1 1 0 0 0 1 .9h4a1 1 0 0 0 1-.9l.5-8.5" />
    </svg>
  );
}

export default function MaintenancePage() {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [updatingId, setUpdatingId] = useState(null);
  const [filter, setFilter] = useState('open'); // 'open' | 'all'

  const [vendors, setVendors] = useState([]);
  const [vendorsLoading, setVendorsLoading] = useState(true);
  const [vendorError, setVendorError] = useState('');
  const [vendorFormOpen, setVendorFormOpen] = useState(false);
  const [vendorForm, setVendorForm] = useState(EMPTY_VENDOR);
  const [editingVendorId, setEditingVendorId] = useState(null);
  const [savingVendor, setSavingVendor] = useState(false);

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

  const loadVendors = useCallback(async () => {
    try {
      const session = await getSession();
      if (!session) return;
      const res = await fetch(
        `${process.env.REACT_APP_BACKEND_URL}/api/vendors/${session.user.id}`,
        { headers: { Authorization: `Bearer ${session.access_token}` } }
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to load vendors');
      setVendors(data.vendors || []);
    } catch (err) {
      console.error('Error loading vendors:', err);
      setVendorError('Could not load your vendors. Please try again shortly.');
    } finally {
      setVendorsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadRequests();
    loadVendors();
  }, [loadRequests, loadVendors]);

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

  const openAddVendor = () => {
    setVendorError('');
    setEditingVendorId(null);
    setVendorForm(EMPTY_VENDOR);
    setVendorFormOpen(true);
  };

  const openEditVendor = (vendor) => {
    setVendorError('');
    setEditingVendorId(vendor.id);
    setVendorForm({ trade: vendor.trade, name: vendor.name, phone: vendor.phone, email: vendor.email || '' });
    setVendorFormOpen(true);
  };

  const closeVendorForm = () => {
    setVendorFormOpen(false);
    setEditingVendorId(null);
    setVendorError('');
  };

  const submitVendor = async (e) => {
    e.preventDefault();
    setVendorError('');

    if (!vendorForm.name.trim()) {
      setVendorError('Enter a name.');
      return;
    }
    if (!vendorForm.phone.trim()) {
      setVendorError('Enter a phone number.');
      return;
    }

    setSavingVendor(true);
    try {
      const session = await getSession();
      if (!session) {
        setVendorError('Please log in again.');
        return;
      }
      const url = editingVendorId
        ? `${process.env.REACT_APP_BACKEND_URL}/api/vendors/${editingVendorId}`
        : `${process.env.REACT_APP_BACKEND_URL}/api/vendors`;
      const res = await fetch(url, {
        method: editingVendorId ? 'PUT' : 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify(vendorForm),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to save vendor');
      closeVendorForm();
      await loadVendors();
    } catch (err) {
      setVendorError(err.message || 'Failed to save vendor.');
    } finally {
      setSavingVendor(false);
    }
  };

  const deleteVendor = async (vendor) => {
    if (!window.confirm(`Remove ${vendor.name} from your vendors?`)) return;
    setVendorError('');
    try {
      const session = await getSession();
      if (!session) {
        setVendorError('Please log in again.');
        return;
      }
      const res = await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/vendors/${vendor.id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to delete vendor');
      await loadVendors();
    } catch (err) {
      setVendorError(err.message || 'Failed to delete vendor.');
    }
  };

  const visibleRequests = filter === 'open'
    ? requests.filter((r) => r.status !== 'resolved')
    : requests;

  const vendorsPanel = (
    <div className="rf-card rf-vend-card">
      <div className="rf-vend-head">
        <div className="rf-vend-title">Your vendors</div>
        <p className="rf-vend-sub">Your go-to people for maintenance jobs — one tap away when a request comes in.</p>
      </div>

      {vendorError && <div className="rf-alert-danger" style={{ marginBottom: 12 }}>{vendorError}</div>}

      {vendorsLoading ? (
        <p className="rf-empty" style={{ padding: '12px 0' }}>Loading...</p>
      ) : vendors.length === 0 && !vendorFormOpen ? (
        <p className="rf-empty" style={{ padding: '12px 0' }}>
          No vendors added yet. Add your go-to plumber, electrician, or cleaner so they're one tap away.
        </p>
      ) : (
        <div className="rf-vend-list">
          {vendors.map((v) => (
            <div className="rf-vend-row" key={v.id}>
              <div className="rf-vend-row-main">
                <div className="rf-vend-row-top">
                  <span className="rf-vend-name">{v.name}</span>
                  <span className="rf-badge neutral rf-vend-tag">{tradeLabel(v.trade)}</span>
                </div>
                <div className="rf-vend-contact">
                  <span><PhoneIcon /> {v.phone}</span>
                  {v.email && <span><MailIcon /> {v.email}</span>}
                </div>
              </div>
              <div className="rf-vend-row-actions">
                <button
                  type="button"
                  className="rf-vend-icon-btn"
                  onClick={() => openEditVendor(v)}
                  title="Edit vendor"
                  aria-label={`Edit ${v.name}`}
                >
                  <PencilIcon />
                </button>
                <button
                  type="button"
                  className="rf-vend-icon-btn danger"
                  onClick={() => deleteVendor(v)}
                  title="Remove vendor"
                  aria-label={`Remove ${v.name}`}
                >
                  <TrashIcon />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {vendorFormOpen ? (
        <form className="rf-vend-form" onSubmit={submitVendor}>
          <div className="rf-field">
            <label htmlFor="vend-trade">Type of work</label>
            <select
              id="vend-trade"
              className="rf-select"
              value={vendorForm.trade}
              onChange={(e) => setVendorForm({ ...vendorForm, trade: e.target.value })}
            >
              {VENDOR_TRADES.map((t) => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
          </div>
          <div className="rf-field">
            <label htmlFor="vend-name">Name</label>
            <input
              id="vend-name"
              className="rf-input"
              value={vendorForm.name}
              onChange={(e) => setVendorForm({ ...vendorForm, name: e.target.value })}
              placeholder="Mike Tremblay"
            />
          </div>
          <div className="rf-field">
            <label htmlFor="vend-phone">Phone</label>
            <input
              id="vend-phone"
              className="rf-input"
              value={vendorForm.phone}
              onChange={(e) => setVendorForm({ ...vendorForm, phone: e.target.value })}
              placeholder="(514) 555-0142"
            />
          </div>
          <div className="rf-field" style={{ marginBottom: 14 }}>
            <label htmlFor="vend-email">Email (optional)</label>
            <input
              id="vend-email"
              className="rf-input"
              type="email"
              value={vendorForm.email}
              onChange={(e) => setVendorForm({ ...vendorForm, email: e.target.value })}
              placeholder="mike@email.com"
            />
          </div>
          <div className="rf-actions">
            <button type="button" className="rf-btn rf-btn-secondary" onClick={closeVendorForm} disabled={savingVendor}>
              Cancel
            </button>
            <button type="submit" className="rf-btn rf-btn-primary" disabled={savingVendor}>
              {savingVendor ? 'Saving...' : editingVendorId ? 'Update vendor' : 'Save vendor'}
            </button>
          </div>
        </form>
      ) : (
        <button
          type="button"
          className="rf-btn rf-btn-secondary rf-btn-block"
          onClick={openAddVendor}
          style={{ marginTop: vendors.length ? 14 : 0 }}
        >
          + Add a vendor
        </button>
      )}
    </div>
  );

  if (loading) {
    return (
      <AppShell active="maintenance" wide>
        <div className="rf-page-header">
          <h1>Maintenance</h1>
          <p>Requests your tenants have submitted through their portal</p>
        </div>
        <p className="rf-empty">Loading...</p>
      </AppShell>
    );
  }

  return (
    <AppShell active="maintenance" wide>
      <div className="rf-page-header">
        <h1>Maintenance</h1>
        <p>Requests your tenants have submitted through their portal</p>
      </div>

      {error && <div className="rf-alert-danger">{error}</div>}

      <div className="rf-mnt-grid">
        <div className="rf-mnt-main">
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
        </div>

        <div className="rf-mnt-rail">
          {vendorsPanel}
        </div>
      </div>
    </AppShell>
  );
}
