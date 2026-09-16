import React, { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';
import AppShell from '../components/AppShell';

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

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const getSession = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    return session;
  };

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
        properties.map((p) => (
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
                </div>
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
                {tenantsByProperty[p.id].map((t) => (
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
                        </div>
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
                ))}
              </div>
            )}
          </div>
        ))
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
