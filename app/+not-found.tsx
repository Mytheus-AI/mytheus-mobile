import React from 'react';
import { useRouter } from 'expo-router';
import { Card, EmptyState, Screen } from '@/components/ui';

export default function NotFound() {
  const router = useRouter();
  return (
    <Screen title="Not found">
      <Card>
        <EmptyState title="This page does not exist" body="The link may be old, or it opens something only the web app has." actionLabel="Go home" onAction={() => router.replace('/')} />
      </Card>
    </Screen>
  );
}
