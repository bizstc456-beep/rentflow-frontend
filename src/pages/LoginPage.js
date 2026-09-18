import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { createClient } from '@supabase/supabase-js';
import '../styles/dashboard.css';

const supabase = createClient(
  process.env.REACT_APP_SUPABASE_URL,
  process.env.REACT_APP_SUPABASE_ANON_KEY
);

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) setError(error.message);
      else navigate('/');
    } catch (err) {
      setError('An error occurred');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="rf-auth-page">
      <div className="rf-auth-card">
        <div className="rf-auth-brand">Rentflow</div>
        <div className="rf-auth-header">
          <h1>Welcome back</h1>
          <p>Sign in to your landlord dashboard.</p>
        </div>
        <form onSubmit={handleLogin}>
          {error && <div className="rf-alert-danger">{error}</div>}
          <div className="rf-field">
            <label>Email</label>
            <input
              className="rf-input"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="your@email.com"
              required
            />
          </div>
          <div className="rf-field">
            <div className="rf-field-label-row">
              <label>Password</label>
              <Link to="/forgot-password">Forgot password?</Link>
            </div>
            <input
              className="rf-input"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
            />
          </div>
          <button type="submit" className="rf-btn rf-btn-primary rf-btn-block" disabled={loading}>
            {loading ? 'Signing in...' : 'Sign in'}
          </button>
        </form>
        <div className="rf-auth-footer">
          <p>Don't have an account? <Link to="/register">Sign up</Link></p>
        </div>
      </div>
    </div>
  );
}
