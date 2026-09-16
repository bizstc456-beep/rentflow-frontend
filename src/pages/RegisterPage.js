import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { createClient } from '@supabase/supabase-js';
import '../styles/dashboard.css';

const supabase = createClient(
  process.env.REACT_APP_SUPABASE_URL,
  process.env.REACT_APP_SUPABASE_ANON_KEY
);

export default function RegisterPage() {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleRegister = async (e) => {
    e.preventDefault();
    setError('');

    if (password.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    setLoading(true);
    try {
      // Registration goes through the backend, not straight to Supabase --
      // this is what also creates the landlord's "customers" record (trial,
      // billing status). A direct supabase.auth.signUp() here would create a
      // login with no customer record behind it, and property creation would
      // fail the moment they tried to add their first building.
      const response = await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, name, phone }),
      });
      const data = await response.json();

      if (!response.ok) {
        setError(data.error || 'Could not create your account');
        return;
      }

      // Backend creates the account but doesn't hand back a session --
      // sign in immediately so the new landlord lands straight in the app.
      const { error: loginError } = await supabase.auth.signInWithPassword({ email, password });
      if (loginError) {
        setError(loginError.message);
      } else {
        navigate('/');
      }
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
          <h1>Create your account</h1>
          <p>Start your 30-day free trial — no charge today.</p>
        </div>
        <form onSubmit={handleRegister}>
          {error && <div className="rf-alert-danger">{error}</div>}
          <div className="rf-field">
            <label>Full name</label>
            <input
              className="rf-input"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Jane Landlord"
              required
            />
          </div>
          <div className="rf-field">
            <label>Phone</label>
            <input
              className="rf-input"
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="514-555-0123"
            />
          </div>
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
            <label>Password</label>
            <input
              className="rf-input"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
            />
          </div>
          <div className="rf-field">
            <label>Confirm password</label>
            <input
              className="rf-input"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="••••••••"
              required
            />
          </div>
          <button type="submit" className="rf-btn rf-btn-primary rf-btn-block" disabled={loading}>
            {loading ? 'Creating account...' : 'Sign up'}
          </button>
        </form>
        <div className="rf-auth-footer">
          <p>Already have an account? <Link to="/login">Sign in</Link></p>
        </div>
      </div>
    </div>
  );
}
