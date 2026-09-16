import React, { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.REACT_APP_SUPABASE_URL,
  process.env.REACT_APP_SUPABASE_ANON_KEY
);

export default function AdminDashboardPage() {
  const [stats, setStats] = useState({
    totalUsers: 0,
    totalProperties: 0,
    totalTenants: 0,
    totalRevenue: 0,
  });
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [accessDenied, setAccessDenied] = useState(false);

  useEffect(() => {
    loadAdminData();
  }, []);

  const loadAdminData = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        setAccessDenied(true);
        return;
      }

      // Admin stats are fetched through the backend, which uses the service-role
      // key server-side and checks the caller's email against an admin allowlist.
      // This can never be done safely with a direct client-side Supabase call.
      const res = await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/admin/stats`, {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });

      if (res.status === 401 || res.status === 403) {
        setAccessDenied(true);
        return;
      }

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to load admin data');
      }

      setStats(data.stats);
      setUsers(data.users || []);
    } catch (error) {
      console.error('Error loading admin data:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <div className="admin-container"><p>Loading admin data...</p></div>;
  }

  if (accessDenied) {
    return <div className="admin-container"><p>You don't have access to this page.</p></div>;
  }

  return (
    <div className="admin-container">
      <div className="admin-header">
        <h1>Admin Dashboard</h1>
        <p>Rentflow Platform Overview</p>
      </div>

      {/* Stats Grid */}
      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-value">{stats.totalUsers}</div>
          <div className="stat-label">Total Users</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{stats.totalProperties}</div>
          <div className="stat-label">Properties</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{stats.totalTenants}</div>
          <div className="stat-label">Tenants</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">${(stats.totalRevenue / 100).toFixed(2)}</div>
          <div className="stat-label">Total Revenue</div>
        </div>
      </div>

      {/* Users Table */}
      <div className="users-section">
        <h2>Registered Users</h2>
        <table className="users-table">
          <thead>
            <tr>
              <th>Email</th>
              <th>Created</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {users.map((user) => (
              <tr key={user.id}>
                <td>{user.email}</td>
                <td>{new Date(user.created_at).toLocaleDateString()}</td>
                <td>
                  <span className={`status ${user.confirmed_at ? 'active' : 'pending'}`}>
                    {user.confirmed_at ? 'Active' : 'Pending'}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}