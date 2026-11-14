import React from 'react';
import { Alert, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth, useOrganization, useOrganizationList, useUser } from '@clerk/expo';
import { useApi } from '@/api/ApiProvider';
import { useMe } from '@/api/hooks/identity';
import { usePushDevices } from '@/api/hooks/push';
import { useVoices } from '@/api/hooks/voice';
import { unregisterPush } from '@/push/push';
import { Avatar, Button, Card, Row, Screen, SectionTitle, T } from '@/components/ui';
import { SignOut } from '@/components/Icon';

/**
 * Your account on this phone: who you are signed in as, which workspace is open, and your agent
 * (its voice is chosen here, `/voice`). Its name and topics, and workspace settings, are edited on
 * the web; billing and admin stay there too.
 */
export default function Settings() {
  const { signOut } = useAuth();
  const { user } = useUser();
  const { organization } = useOrganization();
  const { userMemberships, setActive } = useOrganizationList({ userMemberships: true });
  const me = useMe();
  const api = useApi();
  const push = usePushDevices();
  const voices = useVoices();
  const router = useRouter();
  const voiceName = voices.data?.voices.find((v) => v.id === voices.data?.selected)?.name;
  const voiceLine = voices.isPending
    ? 'Checking...'
    : !voices.data
      ? 'Choose how your Myte sounds'
      : !voices.data.connected
        ? 'Not connected on this server'
        : voiceName
          ? `${voiceName}${voices.data.chosen ? '' : ', matched to its personality'}`
          : 'Choose how your Myte sounds';
  // This phone's push registration belongs to the person and workspace it was made in: remove it
  // before leaving either, so the next person (or workspace) never gets the last one's pushes.
  const leave = async (then: () => unknown) => {
    await unregisterPush(api);
    await then();
  };
  const others = (userMemberships?.data ?? []).filter((m) => m.organization.id !== organization?.id);
  const agentName = me.data?.agent_name?.trim() || (user?.firstName ? `${user.firstName}'s Myte` : 'Your Myte');
  const name = user?.fullName || user?.primaryEmailAddress?.emailAddress || 'You';

  const confirmSignOut = () =>
    Alert.alert('Sign out?', 'You will need to sign in again to see your meetings on this phone.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign out', style: 'destructive', onPress: () => void leave(() => signOut()) },
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

      <SectionTitle title="Your Myte" />
      <Card padded={false}>
        <View style={{ gap: 6, padding: 16 }}>
          <T variant="body" tone="ink" weight="600">
            {agentName}
          </T>
          {me.data?.listen_for.length ? (
            <T variant="secondary">Listens for {me.data.listen_for.join(', ')}.</T>
          ) : (
            <T variant="secondary">Your Myte is your personal AI agent: it listens for what matters to your role, takes notes only you see, and remembers across meetings.</T>
          )}
          <T variant="meta">Change its name and topics on the web.</T>
        </View>
        <Row onPress={() => router.push('/voice')} accessibilityLabel={`Voice: ${voiceLine}`} accessibilityHint="Choose how your Myte sounds">
          <T variant="body" tone="ink">
            Voice
          </T>
          <T variant="meta">{voiceLine}</T>
        </Row>
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
            onPress={() => void leave(() => setActive?.({ organization: m.organization.id }))}
            accessibilityLabel={`Switch to ${m.organization.name}`}
          >
            <T variant="body" tone="ink">
              {m.organization.name}
            </T>
            <T variant="meta">Switch to this workspace</T>
          </Row>
        ))}
      </Card>

      <SectionTitle title="Notifications" />
      <Card style={{ gap: 6 }}>
        {push.isPending ? (
          <T variant="secondary">Checking push notifications...</T>
        ) : push.isError ? (
          <T variant="secondary">Push status could not be loaded. Your Inbox still has everything.</T>
        ) : !push.data?.push_configured ? (
          <>
            <T variant="body" tone="ink" weight="600">
              Push is not connected on this server
            </T>
            <T variant="secondary">Your Inbox has every notification. Pushes start once your workspace turns them on.</T>
          </>
        ) : push.data.items.length ? (
          <>
            <T variant="body" tone="ink" weight="600">
              Push is on
            </T>
            <T variant="secondary">
              {push.data.items.length === 1 ? 'This phone gets' : `${push.data.items.length} phones get`} your
              notifications. Turn them off in your phone&apos;s settings.
            </T>
          </>
        ) : (
          <>
            <T variant="body" tone="ink" weight="600">
              Push is off on this phone
            </T>
            <T variant="secondary">Allow notifications for Mytheus in your phone&apos;s settings, then open the app again.</T>
          </>
        )}
      </Card>

      <SectionTitle title="Appearance" />
      <Card>
        <T variant="secondary">Mytheus follows your phone&apos;s light or dark setting, and its text size.</T>
      </Card>

      <Button label="Sign out" variant="danger" icon={SignOut} onPress={confirmSignOut} style={{ marginTop: 12 }} />
    </Screen>
  );
}
