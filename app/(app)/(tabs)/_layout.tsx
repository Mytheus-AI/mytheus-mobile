import React from 'react';
import { StyleSheet } from 'react-native';
import { Tabs } from 'expo-router';
import { useInbox } from '@/api/hooks/inbox';
import { Calendar, CheckSquare, House, Sparkle, Tray, type IconType } from '@/components/Icon';
import { countLabel } from '@/lib/inbox';
import { sans, useTheme } from '@/theme';

function icon(I: IconType) {
  function TabIcon({ color, size }: { color: string; size: number }) {
    return <I color={color} size={size} />;
  }
  return TabIcon;
}

/**
 * The phone's navigation: the web sidebar folded to five places. Home, Inbox (everything waiting
 * on you, with its count), Meetings, My work (tasks, promises, updates you owe) and Ask. Decisions
 * and Settings open from Home.
 */
export default function TabsLayout() {
  const p = useTheme();
  const { counts } = useInbox();
  const badge = countLabel(counts.all);
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        sceneStyle: { backgroundColor: p.bg },
        tabBarActiveTintColor: p.signal,
        tabBarInactiveTintColor: p.ink3,
        tabBarStyle: { backgroundColor: p.surface, borderTopColor: p.line, borderTopWidth: StyleSheet.hairlineWidth },
        tabBarLabelStyle: { fontFamily: sans('600'), fontSize: 11.5 },
        tabBarAllowFontScaling: false,
      }}
    >
      <Tabs.Screen name="index" options={{ title: 'Home', tabBarIcon: icon(House) }} />
      <Tabs.Screen
        name="inbox"
        options={{
          title: 'Inbox',
          tabBarIcon: icon(Tray),
          tabBarBadge: badge ?? undefined,
          tabBarBadgeStyle: { backgroundColor: p.signal, color: '#ffffff', fontFamily: sans('700'), fontSize: 11 },
          tabBarAccessibilityLabel: badge ? `Inbox, ${badge} waiting` : 'Inbox',
        }}
      />
      <Tabs.Screen name="meetings" options={{ title: 'Meetings', tabBarIcon: icon(Calendar) }} />
      <Tabs.Screen name="work" options={{ title: 'My work', tabBarIcon: icon(CheckSquare) }} />
      <Tabs.Screen name="ask" options={{ title: 'Ask', tabBarIcon: icon(Sparkle) }} />
    </Tabs>
  );
}
