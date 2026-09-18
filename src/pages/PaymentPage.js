import React, { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';
import AppShell from '../components/AppShell';

const supabase = createClient(
  process.env.REACT_APP_SUPABASE_URL,
  process.env.REACT_APP_SUPABASE_ANON_KEY
);

export default function PaymentPage() {
  const [user, setUser] = useState(null);
  const [subscription, setSubscription] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    getUser();
    getSubscription();
  }, []);

  const getUser = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    setUser(user);
  };

  const getSubscription = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data } = await supabase
      .from('subscriptions')
      .select('*')
      .eq('user_id', user.id)
      .single();

    setSubscription(data);
  };

  const handleCheckout = async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        alert('Please log in first');
        return;
      }

      // Call backend to create Stripe checkout session. The backend now
      // derives the user from this session token rather than trusting the
      // body, so it has to be sent.
      const { data: { session } } = await supabase.auth.getSession();
      const response = await fetch(
        `${process.env.REACT_APP_BACKEND_URL}/api/create-checkout-session`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session?.access_token}`,
          },
          body: JSON.stringify({ userId: user.id, email: user.email }),
        }
      );

      const data = await response.json();

      if (!response.ok || !data.url) {
        throw new Error(data.error || 'Failed to create checkout session');
      }

      // Redirect to Stripe's hosted checkout page
      window.location.href = data.url;
    } catch (error) {
      console.error('Checkout error:', error);
      alert('Failed to start checkout. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AppShell active="billing">
      <div className="rf-pricing-wrap">
        <div className="rf-pricing-header">
          <h1>Rentflow Pricing</h1>
          <p>Simple, transparent pricing for landlords</p>
          {user && <p className="rf-pricing-user">Signed in as {user.email}</p>}
        </div>

        <div className="rf-price-card">
          <div className="rf-price-row">
            <h2>Pro Plan</h2>
            <div className="rf-price-amount">$150<span className="period">/month</span></div>
          </div>

          <div className="rf-trial-badge">30-Day Free Trial</div>
          <p className="rf-trial-note">Card required to start your trial — you won't be charged for 30 days.</p>

          <div className="rf-feature-list">
            <div className="rf-feature">Unlimited properties</div>
            <div className="rf-feature">Unlimited tenants</div>
            <div className="rf-feature">Payment tracking</div>
            <div className="rf-feature">SMS notifications</div>
            <div className="rf-feature">Document storage</div>
            <div className="rf-feature">AI-powered tenant analysis</div>
            <div className="rf-feature">Priority support</div>
          </div>

          {subscription ? (
            <div className="rf-subscription-active">
              <span className="rf-badge good">Active subscription</span>
              <p className="rf-trial-note">Next billing date: {new Date(subscription.next_billing_date).toLocaleDateString()}</p>
              <button className="rf-btn rf-btn-secondary rf-btn-block" disabled>
                Already subscribed
              </button>
            </div>
          ) : (
            <button
              className="rf-btn rf-btn-primary rf-btn-block"
              onClick={handleCheckout}
              disabled={loading}
            >
              {loading ? 'Processing...' : 'Start 30-Day Free Trial'}
            </button>
          )}

          <div className="rf-price-footer">
            <p>Cancelling before day 30 means you're never charged</p>
            <p>Cancel anytime</p>
          </div>
        </div>

        <div className="rf-faq">
          <h2>Common questions</h2>
          <div className="rf-faq-item">
            <h3>Do I need a credit card for the trial?</h3>
            <p>Yes, we collect your card when you start the trial, but you won't be charged anything for 30 days. Cancel anytime before then and you won't be billed.</p>
          </div>
          <div className="rf-faq-item">
            <h3>Can I cancel my subscription?</h3>
            <p>Yes, you can cancel anytime. Your access continues until the end of your billing period.</p>
          </div>
          <div className="rf-faq-item">
            <h3>What payment methods do you accept?</h3>
            <p>We accept all major credit and debit cards via Stripe.</p>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
