import React, { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';
import AppShell from '../components/AppShell';

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
    return (
      <AppShell active="admin">
        <div className="rf-state"><p>Loading admin data...</p></div>
      </AppShell>
    );
  }

  if (accessDenied) {
    return (
      <AppShell active="admin">
        <div className="rf-state"><p>You don't have access to this page.</p></div>
      </AppShell>
    );
  }

  return (
    <AppShell active="admin">
      <div className="rf-page-header">
        <h1>Admin Dashboard</h1>
        <p>Rentflow platform overview</p>
      </div>

      <div className="rf-statgrid">
        <div className="rf-statcard">
          <div className="k">Total Users</div>
          <div className="v">{stats.totalUsers}</div>
        </div>
        <div className="rf-statcard">
          <div className="k">Properties</div>
          <div className="v">{stats.totalProperties}</div>
        </div>
        <div className="rf-statcard">
          <div className="k">Tenants</div>
          <div className="v">{stats.totalTenants}</div>
        </div>
        <div className="rf-statcard">
          <div className="k">Total Revenue</div>
          <div className="v">${(stats.totalRevenue / 100).toFixed(2)}</div>
        </div>
      </div>

      <h2 className="rf-section-title">Registered users</h2>
      <div className="rf-table-wrap">
        <table className="rf-table">
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
                  <span className={`rf-badge ${user.confirmed_at ? 'good' : 'warn'}`}>
                    {user.confirmed_at ? 'Active' : 'Pending'}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </AppShell>
  );
}
