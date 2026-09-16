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

  useEffect(() => {
    loadAdminData();
  }, []);

  const loadAdminData = async () => {
    try {
      // Get users from auth
      const { data: { users: authUsers } } = await supabase.auth.admin.listUsers();
      
      // Get properties
      const { data: properties, error: propsError } = await supabase
        .from('properties')
        .select('*');
      if (propsError) console.error('Error loading properties:', propsError);

      // Get tenants
      const { data: tenants, error: tenantsError } = await supabase
        .from('tenants')
        .select('*');
      if (tenantsError) console.error('Error loading tenants:', tenantsError);

      // Get payments
      const { data: payments, error: paymentsError } = await supabase
        .from('payments')
        .select('*');
      if (paymentsError) console.error('Error loading payments:', paymentsError);

      setStats({
        totalUsers: authUsers?.length || 0,
        totalProperties: properties?.length || 0,
        totalTenants: tenants?.length || 0,
        totalRevenue: payments?.reduce((sum, p) => sum + (p.amount || 0), 0) || 0,
      });

      setUsers(authUsers || []);
    } catch (error) {
      console.error('Error loading admin data:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <div className="admin-container"><p>Loading admin data...</p></div>;
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