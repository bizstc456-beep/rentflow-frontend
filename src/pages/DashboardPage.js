import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { createClient } from '@supabase/supabase-js';
import AdminDashboardPage from './AdminDashboardPage';

const supabase = createClient(
  process.env.REACT_APP_SUPABASE_URL,
  process.env.REACT_APP_SUPABASE_ANON_KEY
);

export default function DashboardPage() {
  const navigate = useNavigate();
  const [isAdmin] = useState(true); // You are the admin

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate('/login');
  };

  return (
    <div>
         <div className="navbar">
  <div className="navbar-content">
    <h1>Rentflow</h1>
    <div className="navbar-links">
      <Link to="/payment" className="nav-link">Billing</Link>
      <button onClick={handleLogout} className="btn btn-secondary">Sign Out</button>
       </div>
    </div>
  </div>
  {isAdmin ? <AdminDashboardPage /> : <p>User Dashboard Coming Soon</p>}
</div>
);
}