import React from 'react';
import AppShell from '../components/AppShell';
import LandlordDashboardPage from './LandlordDashboardPage';

export default function DashboardPage() {
  return (
    <AppShell active="dashboard">
      <LandlordDashboardPage />
    </AppShell>
  );
}
