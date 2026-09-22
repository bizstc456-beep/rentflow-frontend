import React, { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';
import AppShell from '../components/AppShell';
import KebabMenu from '../components/KebabMenu';

const supabase = createClient(
  process.env.REACT_APP_SUPABASE_URL,
  process.env.REACT_APP_SUPABASE_ANON_KEY
);

const EMPTY_PROPERTY = {
  address: '', city: '', province: 'QC', postal_code: '',
  property_type: 'duplex', bedrooms: '', bathrooms: '', notes: '',
};

const EMPTY_TENANT = {
  name: '', email: '', phone: '', unit_label: '',
  rent_amount: '', lease_start_date: '', lease_end_date: '',
};

const EMPTY_PAYMENT = { amount: '', payment_date: '', payment_method: 'e-transfer' };

function formatMoney(cents) {
  return `$${((cents || 0) / 100).toFixed(2)}`;
}

function toDateInputValue(value) {
  if (!value) return '';
  return new Date(value).toISOString().slice(0, 10);
}

async function getSession() {
  const { data: { session } } = await supabase.auth.getSession();
  return session;
}

export default function PropertiesPage() {
  const [properties, setProperties] = useState([]);
  const [tenants, setTenants] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [formError, setFormError] = useState('');

  const [propertyFormOpen, setPropertyFormOpen] = useState(null); // null | 'new' | property id
  const [propertyForm, setPropertyForm] = useState(EMPTY_PROPERTY);

  const [tenantFormOpen, setTenantFormOpen] = useState(null); // null | { propertyId, tenantId? }
  const [tenantForm, setTenantForm] = useState(EMPTY_TENANT);

  const [paymentFormOpen, setPaymentFormOpen] = useState(null); // null | tenant id
  const [paymentForm, setPaymentForm] = useState(EMPTY_PAYMENT);
  const [paymentSuccess, setPaymentSuccess] = useState('');

  // Which "Documents" panel is expanded -- 'property-<id>' or 'tenant-<id>'.
  // Only one open at a time keeps the page from getting cluttered.
  const [docsOpenKey, setDocsOpenKey] = useState(null);

  // Per-tenant "Invite to Portal" status: { [tenantId]: { loading?, error?, success? } }
  const [inviteStatus, setInviteStatus] = useState({});

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Deep link from the dashboard's "+ Add property" quick action
  // (?new=1) -- opens the form once, then cleans the URL so a refresh
  // doesn't reopen it.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('new') === '1') {
      openNewPropertyForm();
      window.history.replaceState({}, '', window.location.pathname);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadData = async () => {
    try {
      const session = await getSession();
      if (!session) {
        setError('Please log in again.');
        return;
      }

      const backend = process.env.REACT_APP_BACKEND_URL;
      const authHeaders = { Authorization: `Bearer ${session.access_token}` };

      const [propsRes, tenantsRes] = await Promise.all([
        fetch(`${backend}/api/properties/${session.user.id}`, { headers: authHeaders }),
        fetch(`${backend}/api/tenants/landlord/${session.user.id}`, { headers: authHeaders }),
      ]);

      const propsData = await propsRes.json();
      const tenantsData = await tenantsRes.json();

      if (!propsRes.ok) throw new Error(propsData.error || 'Failed to load properties');
      if (!tenantsRes.ok) throw new Error(tenantsData.error || 'Failed to load tenants');

      setProperties(propsData.properties || []);
      setTenants(tenantsData.tenants || []);
    } catch (err) {
      console.error('Error loading properties:', err);
      setError('Could not load your properties. Please try again shortly.');
    } finally {
      setLoading(false);
    }
  };

  const tenantsByProperty = tenants.reduce((acc, t) => {
    if (!acc[t.property_id]) acc[t.property_id] = [];
    acc[t.property_id].push(t);
    return acc;
  }, {});

  const toggleDocs = (key) => {
    setDocsOpenKey((current) => (current === key ? null : key));
  };

  // ---- property form ----

  const openNewPropertyForm = () => {
    setFormError('');
    setPropertyForm(EMPTY_PROPERTY);
    setPropertyFormOpen('new');
  };

  const openEditPropertyForm = (p) => {
    setFormError('');
    setPropertyForm({
      address: p.address || '',
      city: p.city || '',
      province: p.province || 'QC',
      postal_code: p.postal_code || '',
      property_type: p.property_type || 'duplex',
      bedrooms: p.bedrooms ?? '',
      bathrooms: p.bathrooms ?? '',
      notes: p.notes || '',
    });
    setPropertyFormOpen(p.id);
  };

  const closePropertyForm = () => {
    setPropertyFormOpen(null);
    setFormError('');
  };

  const submitPropertyForm = async (e) => {
    e.preventDefault();
    setFormError('');

    if (!propertyForm.address.trim() || !propertyForm.city.trim()) {
      setFormError('Address and city are required.');
      return;
    }

    try {
      const session = await getSession();
      if (!session) {
        setFormError('Please log in again.');
        return;
      }

      const backend = process.env.REACT_APP_BACKEND_URL;
      const isNew = propertyFormOpen === 'new';
      const url = isNew
        ? `${backend}/api/properties`
        : `${backend}/api/properties/${propertyFormOpen}`;

      const res = await fetch(url, {
        method: isNew ? 'POST' : 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          ...propertyForm,
          bedrooms: propertyForm.bedrooms === '' ? null : Number(propertyForm.bedrooms),
          bathrooms: propertyForm.bathrooms === '' ? null : Number(propertyForm.bathrooms),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to save property');

      closePropertyForm();
      await loadData();
    } catch (err) {
      setFormError(err.message || 'Failed to save property.');
    }
  };

  const deleteProperty = async (p) => {
    const unitCount = (tenantsByProperty[p.id] || []).length;
    const warning = unitCount
      ? `Delete ${p.address}? This also removes its ${unitCount} tenant${unitCount === 1 ? '' : 's'}, their payment history, and any documents. This can't be undone.`
      : `Delete ${p.address}? This can't be undone.`;
    if (!window.confirm(warning)) return;

    try {
      const session = await getSession();
      if (!session) {
        setError('Please log in again.');
        return;
      }
      const res = await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/properties/${p.id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to delete property');
      await loadData();
    } catch (err) {
      setError(err.message || 'Failed to delete property.');
    }
  };

  // ---- tenant form ----

  const openNewTenantForm = (propertyId) => {
    setFormError('');
    setTenantForm(EMPTY_TENANT);
    setTenantFormOpen({ propertyId });
  };

  const openEditTenantForm = (t) => {
    setFormError('');
    setTenantForm({
      name: t.name || '',
      email: t.email || '',
      phone: t.phone || '',
      unit_label: t.unit_label || '',
      rent_amount: t.rent_amount ? (t.rent_amount / 100).toFixed(2) : '',
      lease_start_date: toDateInputValue(t.lease_start_date),
      lease_end_date: toDateInputValue(t.lease_end_date),
    });
    setTenantFormOpen({ propertyId: t.property_id, tenantId: t.id });
  };

  const closeTenantForm = () => {
    setTenantFormOpen(null);
    setFormError('');
  };

  const submitTenantForm = async (e) => {
    e.preventDefault();
    setFormError('');

    if (!tenantForm.name.trim() || !tenantForm.phone.trim()) {
      setFormError('Name and phone are required.');
      return;
    }

    try {
      const session = await getSession();
      if (!session) {
        setFormError('Please log in again.');
        return;
      }

      const backend = process.env.REACT_APP_BACKEND_URL;
      const isNew = !tenantFormOpen.tenantId;
      const url = isNew
        ? `${backend}/api/tenants`
        : `${backend}/api/tenants/${tenantFormOpen.tenantId}`;

      const rentCents = tenantForm.rent_amount === '' ? null : Math.round(Number(tenantForm.rent_amount) * 100);

      const res = await fetch(url, {
        method: isNew ? 'POST' : 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          ...tenantForm,
          rent_amount: rentCents,
          property_id: tenantFormOpen.propertyId,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to save tenant');

      closeTenantForm();
      await loadData();
    } catch (err) {
      setFormError(err.message || 'Failed to save tenant.');
    }
  };

  const deleteTenant = async (t) => {
    const warning = `Remove ${t.name}? This also deletes their payment history and documents. This can't be undone.`;
    if (!window.confirm(warning)) return;

    try {
      const session = await getSession();
      if (!session) {
        setError('Please log in again.');
        return;
      }
      const res = await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/tenants/${t.id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to delete tenant');
      await loadData();
    } catch (err) {
      setError(err.message || 'Failed to delete tenant.');
    }
  };

  const inviteTenant = async (t) => {
    setInviteStatus((s) => ({ ...s, [t.id]: { loading: true } }));
    try {
      const session = await getSession();
      if (!session) {
        setInviteStatus((s) => ({ ...s, [t.id]: { error: 'Please log in again.' } }));
        return;
      }
      const res = await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/tenants/${t.id}/invite`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to send invite');
      setInviteStatus((s) => ({ ...s, [t.id]: { success: true } }));
      await loadData();
    } catch (err) {
      setInviteStatus((s) => ({ ...s, [t.id]: { error: err.message || 'Failed to send invite' } }));
    }
  };

  // ---- payment form ----

  const openPaymentForm = (t) => {
    setFormError('');
    setPaymentSuccess('');
    const defaultAmount = (t.pending_amount > 0 ? t.pending_amount : t.rent_amount) || 0;
    setPaymentForm({
      amount: (defaultAmount / 100).toFixed(2),
      payment_date: new Date().toISOString().slice(0, 10),
      payment_method: 'e-transfer',
    });
    setPaymentFormOpen(t.id);
  };

  const closePaymentForm = () => {
    setPaymentFormOpen(null);
    setFormError('');
  };

  const submitPaymentForm = async (e) => {
    e.preventDefault();
    setFormError('');

    if (!paymentForm.amount || Number(paymentForm.amount) <= 0) {
      setFormError('Enter a payment amount.');
      return;
    }

    try {
      const session = await getSession();
      if (!session) {
        setFormError('Please log in again.');
        return;
      }

      const res = await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/payments/mark-paid`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          tenant_id: paymentFormOpen,
          amount: Math.round(Number(paymentForm.amount) * 100),
          payment_date: paymentForm.payment_date,
          payment_method: paymentForm.payment_method,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to record payment');

      setPaymentSuccess('Payment recorded.');
      setPaymentFormOpen(null);
      await loadData();
    } catch (err) {
      setFormError(err.message || 'Failed to record payment.');
    }
  };

  if (loading) {
    return (
      <AppShell active="properties">
        <div className="rf-state"><p>Loading your properties...</p></div>
      </AppShell>
    );
  }

  if (error) {
    return (
      <AppShell active="properties">
        <div className="rf-state"><p>{error}</p></div>
      </AppShell>
    );
  }

  return (
    <AppShell active="properties">
      <div className="rf-page-header rf-page-header-row">
        <div>
          <h1>Properties</h1>
          <p>Add your buildings, their units, and the tenants renting them</p>
        </div>
        <button className="rf-btn rf-btn-primary" onClick={openNewPropertyForm}>+ Add property</button>
      </div>

      {paymentSuccess && <p className="rf-success-text">{paymentSuccess}</p>}

      {propertyFormOpen === 'new' && (
        <div className="rf-card">
          <h2 className="rf-section-title">New property</h2>
          {formError && <div className="rf-alert">{formError}</div>}
          <PropertyForm
            form={propertyForm}
            setForm={setPropertyForm}
            onSubmit={submitPropertyForm}
            onCancel={closePropertyForm}
          />
        </div>
      )}

      {properties.length === 0 ? (
        <p className="rf-empty">You haven't added any properties yet. Click "Add property" to get started.</p>
      ) : (
        properties.map((p) => {
          const propertyDocsKey = `property-${p.id}`;
          return (
            <div className="rf-property-card" key={p.id}>
              {propertyFormOpen === p.id ? (
                <>
                  <h2 className="rf-section-title">Edit property</h2>
                  {formError && <div className="rf-alert">{formError}</div>}
                  <PropertyForm
                    form={propertyForm}
                    setForm={setPropertyForm}
                    onSubmit={submitPropertyForm}
                    onCancel={closePropertyForm}
                  />
                </>
              ) : (
                <div className="rf-property-head">
                  <div>
                    <div className="rf-prow-addr">{p.address}</div>
                    <div className="rf-prow-city">
                      {p.city}{p.property_type ? ` · ${p.property_type}` : ''}
                      {p.bedrooms ? ` · ${p.bedrooms} bed` : ''}{p.bathrooms ? ` / ${p.bathrooms} bath` : ''}
                    </div>
                    {p.notes && <div className="rf-property-notes">{p.notes}</div>}
                  </div>
                  <div className="rf-property-actions">
                    <button className="rf-btn rf-btn-secondary" onClick={() => openEditPropertyForm(p)}>Edit</button>
                    <button className="rf-btn rf-btn-primary" onClick={() => openNewTenantForm(p.id)}>+ Add tenant</button>
                    <KebabMenu
                      items={[
                        { label: docsOpenKey === propertyDocsKey ? 'Hide documents' : 'Documents', onClick: () => toggleDocs(propertyDocsKey) },
                        { label: 'Delete property', onClick: () => deleteProperty(p), danger: true },
                      ]}
                    />
                  </div>
                </div>
              )}

              {docsOpenKey === propertyDocsKey && (
                <div className="rf-nested-card">
                  <h2 className="rf-section-title">Property documents</h2>
                  <p className="rf-empty" style={{ marginTop: -8, marginBottom: 10 }}>
                    Building-level files — insurance policy, deed, inspection reports.
                  </p>
                  <DocumentsPanel entityType="property" entityId={p.id} />
                </div>
              )}

              {tenantFormOpen?.propertyId === p.id && !tenantFormOpen.tenantId && (
                <div className="rf-card rf-nested-card">
                  <h2 className="rf-section-title">New tenant</h2>
                  {formError && <div className="rf-alert">{formError}</div>}
                  <TenantForm
                    form={tenantForm}
                    setForm={setTenantForm}
                    onSubmit={submitTenantForm}
                    onCancel={closeTenantForm}
                  />
                </div>
              )}

              {(tenantsByProperty[p.id] || []).length === 0 ? (
                <p className="rf-empty">No tenants yet for this property.</p>
              ) : (
                <div className="rf-unit-list">
                  {tenantsByProperty[p.id].map((t) => {
                    const tenantDocsKey = `tenant-${t.id}`;
                    return (
                      <React.Fragment key={t.id}>
                        {tenantFormOpen?.tenantId === t.id ? (
                          <div className="rf-card rf-nested-card">
                            <h2 className="rf-section-title">Edit tenant</h2>
                            {formError && <div className="rf-alert">{formError}</div>}
                            <TenantForm
                              form={tenantForm}
                              setForm={setTenantForm}
                              onSubmit={submitTenantForm}
                              onCancel={closeTenantForm}
                            />
                          </div>
                        ) : (
                          <div className="rf-unit-row">
                            <div className="rf-unit-info">
                              <div className="rf-unit-name">
                                {t.name}{t.unit_label ? ` — ${t.unit_label}` : ''}
                                {t.renewal_soon && <span className="rf-badge warn rf-unit-badge">Lease ends soon</span>}
                              </div>
                              <div className="rf-prow-city">
                                {t.phone}{t.email ? ` · ${t.email}` : ''}
                                {t.lease_end_date ? ` · lease ends ${toDateInputValue(t.lease_end_date)}` : ''}
                              </div>
                            </div>
                            <div className="rf-prow-rent">{formatMoney(t.rent_amount)}/mo</div>
                            <span className={`rf-dot-status ${t.status === 'paid' ? 'good' : 'warn'}`}>
                              {t.status === 'paid' ? 'Paid' : `${formatMoney(t.pending_amount)} pending`}
                            </span>
                            <div className="rf-unit-actions">
                              <button className="rf-btn rf-btn-secondary" onClick={() => openEditTenantForm(t)}>Edit</button>
                              <button className="rf-btn rf-btn-primary" onClick={() => openPaymentForm(t)}>Record payment</button>
                              {t.auth_user_id ? (
                                <span className="rf-badge good">Portal invited</span>
                              ) : (
                                <button
                                  className="rf-btn rf-btn-secondary"
                                  onClick={() => inviteTenant(t)}
                                  disabled={!t.email || inviteStatus[t.id]?.loading}
                                  title={!t.email ? 'Add an email address first' : 'Send a portal invite email'}
                                >
                                  {inviteStatus[t.id]?.loading ? 'Inviting...' : 'Invite to Portal'}
                                </button>
                              )}
                              <KebabMenu
                                items={[
                                  { label: docsOpenKey === tenantDocsKey ? 'Hide docs' : 'Documents', onClick: () => toggleDocs(tenantDocsKey) },
                                  { label: 'Delete tenant', onClick: () => deleteTenant(t), danger: true },
                                ]}
                              />
                            </div>
                            {inviteStatus[t.id]?.error && (
                              <div className="rf-alert-danger" style={{ marginTop: 8 }}>{inviteStatus[t.id].error}</div>
                            )}
                            {inviteStatus[t.id]?.success && (
                              <div className="rf-alert-success" style={{ marginTop: 8 }}>Invite sent to {t.email}.</div>
                            )}
                          </div>
                        )}

                        {docsOpenKey === tenantDocsKey && (
                          <div className="rf-nested-card">
                            <h2 className="rf-section-title">Documents &mdash; {t.name}</h2>
                            <p className="rf-empty" style={{ marginTop: -8, marginBottom: 10 }}>
                              Lease, ID copy, or anything else tied to this tenant.
                            </p>
                            <DocumentsPanel entityType="tenant" entityId={t.id} />
                          </div>
                        )}

                        {paymentFormOpen === t.id && (
                          <div className="rf-card rf-nested-card">
                            <h2 className="rf-section-title">Record a payment &mdash; {t.name}</h2>
                            {formError && <div className="rf-alert">{formError}</div>}
                            <form onSubmit={submitPaymentForm}>
                              <div className="rf-form-row">
                                <div className="rf-field">
                                  <label>Amount ($)</label>
                                  <input
                                    className="rf-input"
                                    type="number"
                                    step="0.01"
                                    min="0"
                                    value={paymentForm.amount}
                                    onChange={(e) => setPaymentForm({ ...paymentForm, amount: e.target.value })}
                                  />
                                </div>
                                <div className="rf-field">
                                  <label>Date</label>
                                  <input
                                    className="rf-input"
                                    type="date"
                                    value={paymentForm.payment_date}
                                    onChange={(e) => setPaymentForm({ ...paymentForm, payment_date: e.target.value })}
                                  />
                                </div>
                                <div className="rf-field">
                                  <label>Method</label>
                                  <select
                                    className="rf-select"
                                    value={paymentForm.payment_method}
                                    onChange={(e) => setPaymentForm({ ...paymentForm, payment_method: e.target.value })}
                                  >
                                    <option value="e-transfer">E-transfer</option>
                                    <option value="cheque">Cheque</option>
                                    <option value="cash">Cash</option>
                                    <option value="card">Card</option>
                                  </select>
                                </div>
                              </div>
                              <div className="rf-form-actions">
                                <button type="submit" className="rf-btn rf-btn-primary">Record payment</button>
                                <button type="button" className="rf-btn rf-btn-secondary" onClick={closePaymentForm}>Cancel</button>
                              </div>
                            </form>
                          </div>
                        )}
                      </React.Fragment>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })
      )}
    </AppShell>
  );
}

function PropertyForm({ form, setForm, onSubmit, onCancel }) {
  return (
    <form onSubmit={onSubmit}>
      <div className="rf-form-row">
        <div className="rf-field">
          <label>Address</label>
          <input className="rf-input" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} placeholder="245 Rue Principale" />
        </div>
        <div className="rf-field">
          <label>City</label>
          <input className="rf-input" value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} placeholder="Saint-Constant" />
        </div>
      </div>
      <div className="rf-form-row">
        <div className="rf-field">
          <label>Province</label>
          <input className="rf-input" value={form.province} onChange={(e) => setForm({ ...form, province: e.target.value })} />
        </div>
        <div className="rf-field">
          <label>Postal code</label>
          <input className="rf-input" value={form.postal_code} onChange={(e) => setForm({ ...form, postal_code: e.target.value })} placeholder="J5A 2G9" />
        </div>
      </div>
      <div className="rf-form-row">
        <div className="rf-field">
          <label>Type</label>
          <select className="rf-select" value={form.property_type} onChange={(e) => setForm({ ...form, property_type: e.target.value })}>
            <option value="single-family">Single-family</option>
            <option value="duplex">Duplex</option>
            <option value="triplex">Triplex</option>
            <option value="fourplex">Fourplex</option>
            <option value="condo">Condo</option>
            <option value="other">Other</option>
          </select>
        </div>
        <div className="rf-field">
          <label>Bedrooms</label>
          <input className="rf-input" type="number" min="0" value={form.bedrooms} onChange={(e) => setForm({ ...form, bedrooms: e.target.value })} />
        </div>
        <div className="rf-field">
          <label>Bathrooms</label>
          <input className="rf-input" type="number" min="0" step="0.5" value={form.bathrooms} onChange={(e) => setForm({ ...form, bathrooms: e.target.value })} />
        </div>
      </div>
      <div className="rf-field">
        <label>Notes</label>
        <textarea className="rf-textarea" rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="Anything worth remembering about this property" />
      </div>
      <div className="rf-form-actions">
        <button type="submit" className="rf-btn rf-btn-primary">Save property</button>
        <button type="button" className="rf-btn rf-btn-secondary" onClick={onCancel}>Cancel</button>
      </div>
    </form>
  );
}

function TenantForm({ form, setForm, onSubmit, onCancel }) {
  return (
    <form onSubmit={onSubmit}>
      <div className="rf-form-row">
        <div className="rf-field">
          <label>Tenant name</label>
          <input className="rf-input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
        </div>
        <div className="rf-field">
          <label>Unit (optional)</label>
          <input className="rf-input" value={form.unit_label} onChange={(e) => setForm({ ...form, unit_label: e.target.value })} placeholder="Unit 2" />
        </div>
      </div>
      <div className="rf-form-row">
        <div className="rf-field">
          <label>Phone</label>
          <input className="rf-input" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="+15145551234" />
        </div>
        <div className="rf-field">
          <label>Email (optional)</label>
          <input className="rf-input" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
        </div>
      </div>
      <div className="rf-form-row">
        <div className="rf-field">
          <label>Monthly rent ($)</label>
          <input className="rf-input" type="number" step="0.01" min="0" value={form.rent_amount} onChange={(e) => setForm({ ...form, rent_amount: e.target.value })} placeholder="1850.00" />
        </div>
        <div className="rf-field">
          <label>Lease start</label>
          <input className="rf-input" type="date" value={form.lease_start_date} onChange={(e) => setForm({ ...form, lease_start_date: e.target.value })} />
        </div>
        <div className="rf-field">
          <label>Lease end</label>
          <input className="rf-input" type="date" value={form.lease_end_date} onChange={(e) => setForm({ ...form, lease_end_date: e.target.value })} />
        </div>
      </div>
      <div className="rf-form-actions">
        <button type="submit" className="rf-btn rf-btn-primary">Save tenant</button>
        <button type="button" className="rf-btn rf-btn-secondary" onClick={onCancel}>Cancel</button>
      </div>
    </form>
  );
}

const DOC_CATEGORIES = [
  { value: 'lease', label: 'Lease' },
  { value: 'id', label: 'ID copy' },
  { value: 'insurance', label: 'Insurance' },
  { value: 'inspection', label: 'Inspection' },
  { value: 'other', label: 'Other' },
];

function docIconLabel(mimeType) {
  if (!mimeType) return 'F';
  if (mimeType.includes('pdf')) return 'PDF';
  if (mimeType.includes('image')) return 'IMG';
  return 'DOC';
}

function formatFileSize(bytes) {
  if (!bytes) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// Self-contained upload/list/delete panel for one tenant's or one property's
// documents. Mounted only while its "Documents" toggle is open, which is
// also what triggers the initial load.
function DocumentsPanel({ entityType, entityId }) {
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [uploading, setUploading] = useState(false);
  const [category, setCategory] = useState('other');
  const fileInputRef = React.useRef(null);

  useEffect(() => {
    loadDocuments();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entityType, entityId]);

  const loadDocuments = async () => {
    setLoading(true);
    setError('');
    try {
      const session = await getSession();
      if (!session) {
        setError('Please log in again.');
        return;
      }
      const res = await fetch(
        `${process.env.REACT_APP_BACKEND_URL}/api/documents/${entityType}/${entityId}`,
        { headers: { Authorization: `Bearer ${session.access_token}` } }
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to load documents');
      setDocuments(data.documents || []);
    } catch (err) {
      setError(err.message || 'Failed to load documents.');
    } finally {
      setLoading(false);
    }
  };

  const handleUpload = async (e) => {
    e.preventDefault();
    const file = fileInputRef.current?.files?.[0];
    if (!file) {
      setError('Choose a file first.');
      return;
    }

    setUploading(true);
    setError('');
    try {
      const session = await getSession();
      if (!session) {
        setError('Please log in again.');
        return;
      }

      const formData = new FormData();
      formData.append('file', file);
      formData.append('category', category);
      formData.append(entityType === 'tenant' ? 'tenant_id' : 'property_id', entityId);

      const res = await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/documents/upload`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${session.access_token}` },
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Upload failed');

      if (fileInputRef.current) fileInputRef.current.value = '';
      await loadDocuments();
    } catch (err) {
      setError(err.message || 'Upload failed.');
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (doc) => {
    if (!window.confirm(`Delete "${doc.file_name}"? This can't be undone.`)) return;
    try {
      const session = await getSession();
      if (!session) {
        setError('Please log in again.');
        return;
      }
      const res = await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/documents/${doc.id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to delete document');
      await loadDocuments();
    } catch (err) {
      setError(err.message || 'Failed to delete document.');
    }
  };

  return (
    <div>
      {error && <div className="rf-alert">{error}</div>}

      {loading ? (
        <p className="rf-empty">Loading documents...</p>
      ) : documents.length === 0 ? (
        <p className="rf-empty">No documents uploaded yet.</p>
      ) : (
        <div className="rf-doc-list">
          {documents.map((doc) => (
            <div className="rf-doc-row" key={doc.id}>
              <div className="rf-doc-info">
                <div className="rf-doc-icon">{docIconLabel(doc.mime_type)}</div>
                <div>
                  <a className="rf-doc-name" href={doc.url} target="_blank" rel="noopener noreferrer">
                    {doc.file_name}
                  </a>
                  <div className="rf-doc-meta">
                    {DOC_CATEGORIES.find((c) => c.value === doc.category)?.label || 'Other'}
                    {doc.file_size ? ` · ${formatFileSize(doc.file_size)}` : ''}
                  </div>
                </div>
              </div>
              <button className="rf-btn rf-btn-danger" onClick={() => handleDelete(doc)}>Delete</button>
            </div>
          ))}
        </div>
      )}

      <form onSubmit={handleUpload} className="rf-doc-upload-row">
        <input type="file" ref={fileInputRef} />
        <select className="rf-doc-category-select" value={category} onChange={(e) => setCategory(e.target.value)}>
          {DOC_CATEGORIES.map((c) => (
            <option key={c.value} value={c.value}>{c.label}</option>
          ))}
        </select>
        <button type="submit" className="rf-btn rf-btn-secondary" disabled={uploading}>
          {uploading ? 'Uploading...' : 'Upload'}
        </button>
      </form>
    </div>
  );
}
