import React, { useEffect, useMemo, useRef } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { Redirect, Stack } from 'expo-router';
import { useAuth, useOrganizationList } from '@clerk/expo';
import { useQueryClient } from '@tanstack/react-query';
import { ApiProvider } from '@/api/ApiProvider';
import { createApiClient } from '@/api/client';
import { Button, Card, EmptyState, Screen, T } from '@/components/ui';
import { config } from '@/lib/config';
import { useTheme } from '@/theme';

/**
 * The signed-in shell, and the ONLY place tenancy is touched: the active organization is chosen in
 * Clerk (which re-issues the session token with that org), never sent as a header or parameter.
 * The REST client is built here from the Clerk session; every screen below reads through it.
 */
export default function AppLayout() {
  const p = useTheme();
  const { isLoaded, isSignedIn, orgId, userId, getToken } = useAuth();
  const queryClient = useQueryClient();

  // A different person or workspace must never see the last one's cached data.
  const scope = `${userId ?? ''}:${orgId ?? ''}`;
  const lastScope = useRef(scope);
  useEffect(() => {
    if (lastScope.current !== scope) {
      queryClient.clear();
      lastScope.current = scope;
    }
  }, [scope, queryClient]);

  const client = useMemo(
    () =>
      createApiClient({
        baseUrl: config.apiGatewayUrl ?? '',
        getToken: (o) => getToken(o?.fresh ? { skipCache: true } : undefined),
      }),
    [getToken],
  );

  if (!isLoaded) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: p.bg }}>
        <ActivityIndicator color={p.ink3} accessibilityLabel="Loading" />
      </View>
    );
  }
  if (!isSignedIn) return <Redirect href="/sign-in" />;
  if (!orgId) return <ChooseWorkspace />;

  return (
    <ApiProvider client={client}>
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: p.bg }, animation: 'slide_from_right' }}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="meetings/[meetingId]/room" options={{ presentation: 'fullScreenModal', gestureEnabled: false, animation: 'fade' }} />
      </Stack>
    </ApiProvider>
  );
}

/** A person in several workspaces picks one; a person in none is told how to get in. */
function ChooseWorkspace() {
  const { signOut } = useAuth();
  const { isLoaded, userMemberships, setActive } = useOrganizationList({ userMemberships: true });
  const items = userMemberships?.data ?? [];
  const only = items.length === 1 ? items[0].organization.id : null;

  useEffect(() => {
    if (only && setActive) void setActive({ organization: only });
  }, [only, setActive]);

  if (!isLoaded || only) {
    return (
      <Screen title="Opening your workspace">
        <ActivityIndicator accessibilityLabel="Loading" />
      </Screen>
    );
  }
  if (items.length === 0) {
    return (
      <Screen title="No workspace yet">
        <Card>
          <EmptyState
            title="You are not in a Mytheus workspace"
            body="Ask your admin to invite you. Once you accept the invite on the web, your workspace opens here."
            actionLabel="Sign out"
            onAction={() => void signOut()}
          />
        </Card>
      </Screen>
    );
  }
  return (
    <Screen title="Choose a workspace" context="You belong to more than one. You can switch later in Settings.">
      {items.map((m) => (
        <Card key={m.id}>
          <View style={{ gap: 10 }}>
            <T variant="lead">{m.organization.name}</T>
            <Button label={`Open ${m.organization.name}`} onPress={() => void setActive?.({ organization: m.organization.id })} />
          </View>
        </Card>
      ))}
    </Screen>
  );
}
