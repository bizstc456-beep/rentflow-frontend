import React, { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.REACT_APP_SUPABASE_URL,
  process.env.REACT_APP_SUPABASE_ANON_KEY
);

export default function LandlordDashboardPage() {
  const [summary, setSummary] = useState(null);
  const [properties, setProperties] = useState([]);
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
    } catch (err) {
      console.error('Error loading dashboard:', err);
      setError('Could not load your dashboard. Please try again shortly.');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <div className="admin-container"><p>Loading your dashboard...</p></div>;
  }

  if (error) {
    return <div className="admin-container"><p>{error}</p></div>;
  }

  return (
    <div className="admin-container">
      <div className="admin-header">
        <h1>Your Dashboard</h1>
        <p>Overview of your properties, tenants, and rent collection</p>
      </div>

      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-value">{summary.total_properties}</div>
          <div className="stat-label">Properties</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{summary.total_tenants}</div>
          <div className="stat-label">Tenants</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">${(summary.total_collected_this_month / 100).toFixed(2)}</div>
          <div className="stat-label">Collected This Month</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">${(summary.pending_amount / 100).toFixed(2)}</div>
          <div className="stat-label">Pending</div>
        </div>
      </div>

      <div className="users-section">
        <h2>Your Properties</h2>
        {properties.length === 0 ? (
          <p>You haven't added any properties yet. Property management tools are coming soon.</p>
        ) : (
          <table className="users-table">
            <thead>
              <tr>
                <th>Address</th>
                <th>City</th>
                <th>Monthly Rent</th>
              </tr>
            </thead>
            <tbody>
              {properties.map((p) => (
                <tr key={p.id}>
                  <td>{p.address}</td>
                  <td>{p.city}</td>
                  <td>${(p.rent_amount || 0).toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
