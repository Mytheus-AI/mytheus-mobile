import React from 'react';
import { Redirect, Stack, useGlobalSearchParams } from 'expo-router';
import { useAuth } from '@clerk/expo';
import { signInReturn } from '@/lib/routes';
import { useTheme } from '@/theme';

export default function AuthLayout() {
  const { isLoaded, isSignedIn } = useAuth();
  const { next } = useGlobalSearchParams<{ next?: string }>();
  const p = useTheme();
  // Back to where a signed-out launch was headed, only if it is an allowed place (system.md N28).
  if (isLoaded && isSignedIn) return <Redirect href={signInReturn(next) ?? '/'} />;
  return <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: p.bg } }} />;
}
