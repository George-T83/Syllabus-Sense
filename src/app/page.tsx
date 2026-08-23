'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import AppLoadingScreen from '@/components/layout/AppLoadingScreen';
import LandingPage from '@/components/marketing/LandingPage';

/**
 * VA-1: the root route used to redirect unconditionally to /login, so a
 * first-time visitor never saw a pitch before being asked to create an
 * account. Now only an already-authenticated visitor is redirected (to
 * /dashboard, same as before); everyone else sees the real landing page
 * instead of bouncing straight to the paywall of signup.
 */
export default function Home() {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    if (user) router.replace('/dashboard');
  }, [user, loading, router]);

  if (loading) return <AppLoadingScreen />;
  if (user) return <AppLoadingScreen />;

  return <LandingPage />;
}
