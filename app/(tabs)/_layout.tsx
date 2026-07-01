import React from 'react';
import { Redirect, Tabs } from 'expo-router';
import CustomTabBar from '@/components/CustomTabBar';
import { colors } from '@/theme/tokens';
import { useSignedIn } from '@/lib/session';

export default function TabsLayout() {
  const signedIn = useSignedIn();
  if (!signedIn) return <Redirect href="/sign-in" />;

  return (
    <Tabs
      tabBar={(props) => <CustomTabBar {...props} />}
      screenOptions={{
        headerShown: false,
        sceneStyle: { backgroundColor: colors.bgApp },
      }}
    >
      <Tabs.Screen name="index" options={{ title: 'Home' }} />
      <Tabs.Screen name="ask" options={{ title: 'Ask' }} />
      <Tabs.Screen name="actions" options={{ title: 'Actions' }} />
      <Tabs.Screen name="people" options={{ title: 'People' }} />
      <Tabs.Screen name="library" options={{ title: 'Library' }} />
    </Tabs>
  );
}
