import React, { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.REACT_APP_SUPABASE_URL,
  process.env.REACT_APP_SUPABASE_ANON_KEY
);

export default function CommunicationCenterPage() {
  const [tenants, setTenants] = useState([]);
  const [messages, setMessages] = useState([]);
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

      const [tenantsRes, messagesRes] = await Promise.all([
        fetch(`${backend}/api/tenants/landlord/${session.user.id}`, { headers: authHeaders }),
        fetch(`${backend}/api/sms/inbox/${session.user.id}`, { headers: authHeaders }),
      ]);

      const tenantsData = await tenantsRes.json();
      const messagesData = await messagesRes.json();

      if (!tenantsRes.ok) throw new Error(tenantsData.error || 'Failed to load tenants');
      if (!messagesRes.ok) throw new Error(messagesData.error || 'Failed to load messages');

      setTenants(tenantsData.tenants || []);
      setMessages(messagesData.messages || []);
    } catch (err) {
      console.error('Error loading communication center:', err);
      setError('Could not load your messages. Please try again shortly.');
    } finally {
      setLoading(false);
    }
  };

  const tenantByPhone = (phone) => tenants.find((t) => t.phone === phone);

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
    return <div className="admin-container"><p>Loading your messages...</p></div>;
  }

  if (error) {
    return <div className="admin-container"><p>{error}</p></div>;
  }

  return (
    <div className="admin-container">
      <div className="admin-header">
        <h1>Communication Center</h1>
        <p>Send SMS to your tenants and see your message history</p>
      </div>

      <div className="users-section">
        <h2>Send a Message</h2>
        {tenants.length === 0 ? (
          <p>You don't have any tenants yet, so there's no one to message. Add a tenant first.</p>
        ) : (
          <form onSubmit={handleSend}>
            {sendError && <div className="error-alert">{sendError}</div>}
            {sendSuccess && <p>{sendSuccess}</p>}
            <div className="form-group">
              <label>Tenant</label>
              <select
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
            <div className="form-group">
              <label>Message</label>
              <textarea
                value={messageText}
                onChange={(e) => setMessageText(e.target.value)}
                placeholder="Type your message..."
                rows={3}
              />
            </div>
            <button type="submit" className="btn btn-primary" disabled={sending}>
              {sending ? 'Sending...' : 'Send SMS'}
            </button>
          </form>
        )}
      </div>

      <div className="users-section">
        <h2>Message History</h2>
        {messages.length === 0 ? (
          <p>No messages yet.</p>
        ) : (
          <table className="users-table">
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
                    <td>{m.status === 'received' ? 'Received' : 'Sent'}</td>
                    <td>{m.status}</td>
                    <td>{new Date(m.created_at).toLocaleString()}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
