import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { createClient } from '@supabase/supabase-js';
import '../styles/dashboard.css';

const supabase = createClient(
  process.env.REACT_APP_SUPABASE_URL,
  process.env.REACT_APP_SUPABASE_ANON_KEY
);

// UI-only hint to show the Admin link. This is NOT a security boundary --
// /admin itself is enforced server-side by the backend's admin allowlist.
const ADMIN_EMAILS = ['bizstc456@gmail.com'];

// Shared sidebar layout for the logged-in app. Wrap a page's content with
// <AppShell active="dashboard">...</AppShell> to get the nav + sign out.
export default function AppShell({ active, children }) {
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

  const linkClass = (page) => (active === page ? 'rf-nav-link current' : 'rf-nav-link');

  return (
    <div className="rf-shell">
      <aside className="rf-side">
        <div className="rf-brand">Rentflow</div>
        <nav className="rf-nav">
          <Link to="/" className={linkClass('dashboard')}>Dashboard</Link>
          <Link to="/properties" className={linkClass('properties')}>Properties</Link>
          <Link to="/reports" className={linkClass('reports')}>Reports</Link>
          <Link to="/messages" className={linkClass('messages')}>Messages</Link>
          <Link to="/payment" className={linkClass('billing')}>Billing</Link>
          {isAdmin && <Link to="/admin" className={linkClass('admin')}>Admin</Link>}
        </nav>
        <button onClick={handleLogout} className="rf-signout">Sign Out</button>
      </aside>
      <main className="rf-main">{children}</main>
    </div>
  );
}
