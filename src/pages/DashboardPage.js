import React from 'react';
import { createClient } from '@supabase/supabase-js';
import { useNavigate } from 'react-router-dom';

const supabase = createClient(
  process.env.REACT_APP_SUPABASE_URL,
  process.env.REACT_APP_SUPABASE_ANON_KEY
);

export default function DashboardPage() {
  const navigate = useNavigate();

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate('/login');
  };

  return (
    <div className="page-container">
      <h1>Welcome to Rentflow!</h1>
      <p>Your landlord dashboard is ready.</p>
      <button onClick={handleLogout} className="btn btn-secondary">Sign Out</button>
    </div>
  );
}