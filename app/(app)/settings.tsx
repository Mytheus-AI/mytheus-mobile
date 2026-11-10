import React from 'react';
import { Alert, View } from 'react-native';
import { useAuth, useOrganization, useOrganizationList, useUser } from '@clerk/expo';
import { useMe } from '@/api/hooks/identity';
import { Avatar, Button, Card, Row, Screen, SectionTitle, T } from '@/components/ui';
import { SignOut } from '@/components/Icon';

/**
 * Your account on this phone: who you are signed in as, which workspace is open, and your agent.
 * Profile, agent and workspace settings are edited on the web; billing and admin stay there too.
 */
export default function Settings() {
  const { signOut } = useAuth();
  const { user } = useUser();
  const { organization } = useOrganization();
  const { userMemberships, setActive } = useOrganizationList({ userMemberships: true });
  const me = useMe();
  const others = (userMemberships?.data ?? []).filter((m) => m.organization.id !== organization?.id);
  const name = user?.fullName || user?.primaryEmailAddress?.emailAddress || 'You';

  const confirmSignOut = () =>
    Alert.alert('Sign out?', 'You will need to sign in again to see your meetings on this phone.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign out', style: 'destructive', onPress: () => void signOut() },
    ]);

  return (
    <Screen back title="Settings">
      <Card>
        <View style={{ flexDirection: 'row', gap: 14, alignItems: 'center' }}>
          <Avatar name={name} seed={user?.id} size={52} />
          <View style={{ flex: 1, gap: 2 }}>
            <T variant="lead">{name}</T>
            <T variant="secondary">{user?.primaryEmailAddress?.emailAddress}</T>
            {me.data?.role ? <T variant="meta">{me.data.role}</T> : null}
          </View>
        </View>
      </Card>

      <SectionTitle title="Your agent" />
      <Card style={{ gap: 6 }}>
        <T variant="body" tone="ink" weight="600">
          {me.data?.agent_name?.trim() || `${user?.firstName || 'Your'}'s agent`}
        </T>
        {me.data?.listen_for.length ? (
          <T variant="secondary">Listens for {me.data.listen_for.join(', ')}.</T>
        ) : (
          <T variant="secondary">Your agent listens for what matters to your role.</T>
        )}
        <T variant="meta">Change its name, voice and topics on the web.</T>
      </Card>

      <SectionTitle title="Workspace" />
      <Card padded={false}>
        <Row first>
          <T variant="body" tone="ink" weight="600">
            {organization?.name ?? 'Your workspace'}
          </T>
          <T variant="meta">Open on this phone</T>
        </Row>
        {others.map((m) => (
          <Row
            key={m.id}
            onPress={() => void setActive?.({ organization: m.organization.id })}
            accessibilityLabel={`Switch to ${m.organization.name}`}
          >
            <T variant="body" tone="ink">
              {m.organization.name}
            </T>
            <T variant="meta">Switch to this workspace</T>
          </Row>
        ))}
      </Card>

      <SectionTitle title="Appearance" />
      <Card>
        <T variant="secondary">Mytheus follows your phone&apos;s light or dark setting, and its text size.</T>
      </Card>

      <Button label="Sign out" variant="danger" icon={SignOut} onPress={confirmSignOut} style={{ marginTop: 12 }} />
    </Screen>
  );
}
