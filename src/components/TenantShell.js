import React from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.REACT_APP_SUPABASE_URL,
  process.env.REACT_APP_SUPABASE_ANON_KEY
);

// Sidebar layout for the tenant-facing portal -- deliberately separate from
// the landlord AppShell (different nav, different account type). Wrap a
// tenant page's content with <TenantShell active="rental">...</TenantShell>.
export default function TenantShell({ active, children }) {
  const navigate = useNavigate();

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate('/tenant/login');
  };

  const linkClass = (page) => (active === page ? 'rf-nav-link current' : 'rf-nav-link');

  return (
    <div className="rf-shell">
      <aside className="rf-side">
        <div className="rf-brand">Rentflow</div>
        <nav className="rf-nav">
          <Link to="/tenant" className={linkClass('rental')}>My Rental</Link>
          <Link to="/tenant/maintenance" className={linkClass('maintenance')}>Maintenance</Link>
        </nav>
        <button onClick={handleLogout} className="rf-signout">Sign Out</button>
      </aside>
      <main className="rf-main">{children}</main>
    </div>
  );
}
