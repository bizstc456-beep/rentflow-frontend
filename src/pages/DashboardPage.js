import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { createClient } from '@supabase/supabase-js';
import LandlordDashboardPage from './LandlordDashboardPage';

const supabase = createClient(
  process.env.REACT_APP_SUPABASE_URL,
  process.env.REACT_APP_SUPABASE_ANON_KEY
);

// UI-only hint to show the Admin link. This is NOT a security boundary --
// /admin itself is enforced server-side by the backend's admin allowlist.
const ADMIN_EMAILS = ['bizstc456@gmail.com'];

export default function DashboardPage() {
  const navigate = useNavigate();
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      const email = (data?.user?.email || '').toLowerCase();
      setIsAdmin(ADMIN_EMAILS.includes(email));
    });
  }, []);

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
      {isAdmin && <Link to="/admin" className="nav-link">Admin</Link>}
      <button onClick={handleLogout} className="btn btn-secondary">Sign Out</button>
       </div>
    </div>
  </div>
  <LandlordDashboardPage />
</div>
);
}