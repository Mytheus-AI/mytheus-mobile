import React, { useState } from 'react';
import { View } from 'react-native';
import { useRouter } from 'expo-router';
import { useDirectory } from '@/api/hooks/people';
import { Avatar, Card, EmptyState, ErrorState, Row, Screen, Skeleton, T } from '@/components/ui';
import { Field } from '@/components/Field';
import { plural } from '@/lib/format';

/**
 * People in the open workspace; each opens their profile. The web's People page is the org chart
 * (departments, then teams) with its admin editing; on the phone this is the read-only directory
 * of the same people, and admin stays on the web.
 */
export default function People() {
  const router = useRouter();
  const { entries, query, orgName } = useDirectory();
  const [q, setQ] = useState('');
  const needle = q.trim().toLowerCase();
  const shown = (entries ?? []).filter(
    (e) => !needle || e.name.toLowerCase().includes(needle) || e.email.toLowerCase().includes(needle) || (e.role ?? '').toLowerCase().includes(needle),
  );

  return (
    <Screen
      back
      title="People"
      context={entries ? `${plural(entries.length, 'person', 'people')} in ${orgName ?? 'your workspace'}` : null}
      onRefresh={() => void query.refetch()}
      refreshing={query.isRefetching}
    >
      {query.isPending ? (
        <Skeleton lines={4} />
      ) : !entries ? (
        <ErrorState title="People could not be loaded" onRetry={() => void query.refetch()} />
      ) : (
        <>
          {entries.length > 6 ? (
            <Field label="Find someone" value={q} onChangeText={setQ} placeholder="Name, email or role" autoCorrect={false} autoCapitalize="none" returnKeyType="search" />
          ) : null}
          {shown.length === 0 ? (
            <Card>
              <EmptyState compact title={needle ? 'Nobody matches' : 'Nobody here yet'} body={needle ? 'Try part of a name or an email.' : undefined} />
            </Card>
          ) : (
            <Card padded={false}>
              {shown.map((e, i) => (
                <Row
                  key={e.id}
                  first={i === 0}
                  onPress={() => router.push(`/people/${e.id}`)}
                  accessibilityLabel={[e.isYou ? `${e.name} (you)` : e.name, e.role].filter(Boolean).join(', ')}
                >
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                    <Avatar name={e.name} seed={e.email} size={36} />
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <T variant="body" tone="ink" weight="600" numberOfLines={1}>
                        {e.isYou ? `${e.name} (you)` : e.name}
                      </T>
                      <T variant="meta" numberOfLines={1}>
                        {e.role ?? e.email}
                      </T>
                    </View>
                  </View>
                </Row>
              ))}
            </Card>
          )}
        </>
      )}
    </Screen>
  );
}
