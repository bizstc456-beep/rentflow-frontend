import React, { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';

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

      // Call backend to create Stripe checkout session
      const response = await fetch(
        `${process.env.REACT_APP_BACKEND_URL}/api/create-checkout-session`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
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
    <div className="payment-container">
      <div className="payment-header">
        <h1>Rentflow Pricing</h1>
        <p>Simple, transparent pricing for landlords</p>
        {user && <p className="payment-user">Signed in as {user.email}</p>}
      </div>

      {/* Pricing Card */}
      <div className="pricing-card">
        <div className="pricing-header">
          <h2>Pro Plan</h2>
          <div className="price">
            <span className="amount">$150</span>
            <span className="period">/month</span>
          </div>
        </div>

        <div className="trial-badge">30-Day Free Trial</div>
        <p className="trial-note">Card required to start your trial — you won't be charged for 30 days.</p>

        <div className="features-list">
          <div className="feature">✅ Unlimited properties</div>
          <div className="feature">✅ Unlimited tenants</div>
          <div className="feature">✅ Payment tracking</div>
          <div className="feature">✅ SMS notifications</div>
          <div className="feature">✅ Document storage</div>
          <div className="feature">✅ AI-powered tenant analysis</div>
          <div className="feature">✅ Priority support</div>
        </div>

        {subscription ? (
          <div className="subscription-status active">
            <div className="status-badge">✓ Active Subscription</div>
            <p>Next billing date: {new Date(subscription.next_billing_date).toLocaleDateString()}</p>
            <button className="btn btn-secondary" disabled>
              Already Subscribed
            </button>
          </div>
        ) : (
          <button
            className="btn btn-primary btn-large"
            onClick={handleCheckout}
            disabled={loading}
          >
            {loading ? 'Processing...' : 'Start 30-Day Free Trial'}
          </button>
        )}

        <div className="pricing-footer">
          <p>Cancelling before day 30 means you're never charged</p>
          <p>Cancel anytime</p>
        </div>
      </div>

      {/* FAQ */}
      <div className="payment-faq">
        <h2>Common Questions</h2>
        <div className="faq-item">
          <h3>Do I need a credit card for the trial?</h3>
          <p>Yes, we collect your card when you start the trial, but you won't be charged anything for 30 days. Cancel anytime before then and you won't be billed.</p>
        </div>
        <div className="faq-item">
          <h3>Can I cancel my subscription?</h3>
          <p>Yes, you can cancel anytime. Your access continues until the end of your billing period.</p>
        </div>
        <div className="faq-item">
          <h3>What payment methods do you accept?</h3>
          <p>We accept all major credit and debit cards via Stripe.</p>
        </div>
      </div>
    </div>
  );
}