import React from 'react';
import { Redirect, Stack } from 'expo-router';
import { useAuth } from '@clerk/expo';
import { useTheme } from '@/theme';

export default function AuthLayout() {
  const { isLoaded, isSignedIn } = useAuth();
  const p = useTheme();
  if (isLoaded && isSignedIn) return <Redirect href="/" />;
  return <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: p.bg } }} />;
}
