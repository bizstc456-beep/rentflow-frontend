import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { createClient } from '@supabase/supabase-js';
import '../styles/dashboard.css';

const supabase = createClient(
  process.env.REACT_APP_SUPABASE_URL,
  process.env.REACT_APP_SUPABASE_ANON_KEY
);

// Reached via the link in the "reset your password" email. Supabase parses
// the recovery token out of the URL on load and, once that's done, fires a
// PASSWORD_RECOVERY auth event -- that's our signal that it's safe to show
// the "set a new password" form and call updateUser().
export default function ResetPasswordPage() {
  const [ready, setReady] = useState(false);
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') setReady(true);
    });
    // Covers the case where the recovery session was already established
    // (and the event already fired) before this listener attached.
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) setReady(true);
    });
    return () => subscription?.unsubscribe();
  }, []);

  const handleReset = async (e) => {
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
      const { error } = await supabase.auth.updateUser({ password });
      if (error) setError(error.message);
      else {
        setSuccess(true);
        setTimeout(() => navigate('/'), 2000);
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
          <h1>Set a new password</h1>
          <p>Choose a new password for your account.</p>
        </div>

        {success ? (
          <div className="rf-auth-footer">Password updated — taking you to your dashboard...</div>
        ) : ready ? (
          <form onSubmit={handleReset}>
            {error && <div className="rf-alert-danger">{error}</div>}
            <div className="rf-field">
              <label>New password</label>
              <input
                className="rf-input"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                minLength={6}
              />
            </div>
            <div className="rf-field">
              <label>Confirm new password</label>
              <input
                className="rf-input"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="••••••••"
                required
                minLength={6}
              />
            </div>
            <button type="submit" className="rf-btn rf-btn-primary rf-btn-block" disabled={loading}>
              {loading ? 'Updating...' : 'Update password'}
            </button>
          </form>
        ) : (
          <div>
            <div className="rf-alert-danger">
              This link is invalid or has expired.
            </div>
            <div className="rf-auth-footer">
              <p><Link to="/forgot-password">Request a new reset link</Link></p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
