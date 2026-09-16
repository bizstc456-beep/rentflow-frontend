import React, { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';
import AppShell from '../components/AppShell';

const supabase = createClient(
  process.env.REACT_APP_SUPABASE_URL,
  process.env.REACT_APP_SUPABASE_ANON_KEY
);

// Quebec landlords typically collect rent on the 1st -- used to fill in the
// {due_date} / {days_late} placeholders in the SMS templates.
function nextDueDate() {
  const now = new Date();
  const due = now.getDate() === 1 ? now : new Date(now.getFullYear(), now.getMonth() + 1, 1);
  return due.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
}

function daysLate() {
  const day = new Date().getDate();
  return day > 1 ? day - 1 : 0;
}

function fillTemplate(template, tenant) {
  const vars = {
    tenant_name: tenant.name,
    rent_amount: ((tenant.rent_amount || 0) / 100).toFixed(2),
    due_date: nextDueDate(),
    days_late: String(daysLate()),
    amount: ((tenant.pending_amount || tenant.rent_amount || 0) / 100).toFixed(2),
    payment_date: new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }),
  };
  let text = template.template_text || '';
  Object.entries(vars).forEach(([key, val]) => {
    text = text.split(`{${key}}`).join(val);
  });
  return text;
}

export default function CommunicationCenterPage() {
  const [tenants, setTenants] = useState([]);
  const [messages, setMessages] = useState([]);
  const [templates, setTemplates] = useState([]);
  const [selectedTenantId, setSelectedTenantId] = useState('');
  const [messageText, setMessageText] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const [sendError, setSendError] = useState('');
  const [sendSuccess, setSendSuccess] = useState('');

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

      const [tenantsRes, messagesRes, templatesRes] = await Promise.all([
        fetch(`${backend}/api/tenants/landlord/${session.user.id}`, { headers: authHeaders }),
        fetch(`${backend}/api/sms/inbox/${session.user.id}`, { headers: authHeaders }),
        fetch(`${backend}/api/sms/templates`, { headers: authHeaders }),
      ]);

      const tenantsData = await tenantsRes.json();
      const messagesData = await messagesRes.json();
      const templatesData = await templatesRes.json();

      if (!tenantsRes.ok) throw new Error(tenantsData.error || 'Failed to load tenants');
      if (!messagesRes.ok) throw new Error(messagesData.error || 'Failed to load messages');
      // Quick-action templates are a nice-to-have -- don't fail the whole
      // page over them if that route hiccups.
      setTenants(tenantsData.tenants || []);
      setMessages(messagesData.messages || []);
      setTemplates(templatesRes.ok ? (templatesData.templates || []) : []);
    } catch (err) {
      console.error('Error loading communication center:', err);
      setError('Could not load your messages. Please try again shortly.');
    } finally {
      setLoading(false);
    }
  };

  const tenantByPhone = (phone) => tenants.find((t) => t.phone === phone);
  const selectedTenant = tenants.find((t) => t.id === selectedTenantId);

  // "Payment Received" already goes out automatically when a payment is
  // recorded, so it's left out of the quick actions here to avoid a
  // duplicate-looking send. Late notices only make sense once a tenant is
  // actually behind.
  const quickTemplates = templates.filter((tpl) => {
    if (tpl.template_type === 'payment-received') return false;
    if (tpl.template_type === 'late-payment') return selectedTenant?.status === 'pending';
    return true;
  });

  const handleQuickAction = (tpl) => {
    if (!selectedTenant) return;
    setMessageText(fillTemplate(tpl, selectedTenant));
  };

  const handleSend = async (e) => {
    e.preventDefault();
    setSendError('');
    setSendSuccess('');

    if (!selectedTenantId || !messageText.trim()) {
      setSendError('Choose a tenant and write a message first.');
      return;
    }

    setSending(true);
    try {
      const session = await getSession();
      if (!session) {
        setSendError('Please log in again.');
        return;
      }

      const res = await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/sms/send`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ tenant_id: selectedTenantId, message: messageText.trim() }),
      });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to send message');
      }

      setSendSuccess('Message sent.');
      setMessageText('');
      await loadData();
    } catch (err) {
      console.error('Error sending message:', err);
      setSendError(err.message || 'Failed to send message.');
    } finally {
      setSending(false);
    }
  };

  if (loading) {
    return (
      <AppShell active="messages">
        <div className="rf-state"><p>Loading your messages...</p></div>
      </AppShell>
    );
  }

  if (error) {
    return (
      <AppShell active="messages">
        <div className="rf-state"><p>{error}</p></div>
      </AppShell>
    );
  }

  return (
    <AppShell active="messages">
      <div className="rf-page-header">
        <h1>Communication Center</h1>
        <p>Send SMS to your tenants and see your message history</p>
      </div>

      <div className="rf-card">
        <h2 className="rf-section-title">Send a message</h2>
        {tenants.length === 0 ? (
          <p className="rf-empty">You don't have any tenants yet, so there's no one to message. Add a tenant first.</p>
        ) : (
          <form onSubmit={handleSend}>
            {sendError && <div className="rf-alert">{sendError}</div>}
            {sendSuccess && <p className="rf-success-text">{sendSuccess}</p>}
            <div className="rf-field">
              <label>Tenant</label>
              <select
                className="rf-select"
                value={selectedTenantId}
                onChange={(e) => setSelectedTenantId(e.target.value)}
              >
                <option value="">Select a tenant...</option>
                {tenants.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name} ({t.phone})
                  </option>
                ))}
              </select>
            </div>
            {selectedTenant && quickTemplates.length > 0 && (
              <div className="rf-field">
                <label>Quick templates</label>
                <div className="rf-quick-actions">
                  {quickTemplates.map((tpl) => (
                    <button
                      key={tpl.id || tpl.template_name}
                      type="button"
                      className="rf-btn rf-btn-secondary"
                      onClick={() => handleQuickAction(tpl)}
                    >
                      {tpl.template_name}
                    </button>
                  ))}
                </div>
              </div>
            )}
            <div className="rf-field">
              <label>Message</label>
              <textarea
                className="rf-textarea"
                value={messageText}
                onChange={(e) => setMessageText(e.target.value)}
                placeholder="Type your message..."
                rows={3}
              />
            </div>
            <button type="submit" className="rf-btn rf-btn-primary" disabled={sending}>
              {sending ? 'Sending...' : 'Send SMS'}
            </button>
          </form>
        )}
      </div>

      <h2 className="rf-section-title">Message history</h2>
      {messages.length === 0 ? (
        <p className="rf-empty">No messages yet.</p>
      ) : (
        <div className="rf-table-wrap">
          <table className="rf-table">
            <thead>
              <tr>
                <th>Tenant</th>
                <th>Phone</th>
                <th>Message</th>
                <th>Direction</th>
                <th>Status</th>
                <th>Date</th>
              </tr>
            </thead>
            <tbody>
              {messages.map((m) => {
                const tenant = tenantByPhone(m.to_phone);
                return (
                  <tr key={m.id}>
                    <td>{tenant ? tenant.name : '—'}</td>
                    <td>{m.to_phone}</td>
                    <td>{m.message}</td>
                    <td>
                      <span className={`rf-badge ${m.status === 'received' ? 'neutral' : 'good'}`}>
                        {m.status === 'received' ? 'Received' : 'Sent'}
                      </span>
                    </td>
                    <td>{m.status}</td>
                    <td>{new Date(m.created_at).toLocaleString()}</td>
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
