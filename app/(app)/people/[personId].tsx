import React from 'react';
import { Linking, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { ApiError } from '@/api/client';
import { usePeople } from '@/api/hooks/identity';
import { PERSON_ID, usePersonProfile } from '@/api/hooks/people';
import type { PersonMeeting, PersonProfile } from '@/api/types';
import { Avatar, Button, Card, Chip, EmptyState, ErrorState, Screen, SectionTitle, Skeleton, T, type ChipTone } from '@/components/ui';
import { MeetingRow } from '@/components/feature/MeetingRow';
import { firstName, nameFromEmail } from '@/lib/people';

/**
 * One person (the web's `/people/{id}`): `GET /bff/people/{user_id}`. The profile carries no
 * display name, so the name comes from the workspace's people (display name, then Clerk, then the
 * email read as a name; N20), the same precedence as mytheus-ui. Read-only: a person edits their own profile on the web.
 */
export default function PersonScreen() {
  const { personId } = useLocalSearchParams<{ personId: string }>();
  const id = String(personId ?? '');
  const valid = PERSON_ID.test(id);
  const profile = usePersonProfile(id);
  const { people } = usePeople();

  if (valid && profile.isPending) {
    return (
      <Screen back title="Person">
        <Skeleton lines={4} />
      </Screen>
    );
  }
  const p = profile.data;
  if (!valid || !p) {
    const notFound = !valid || (profile.error instanceof ApiError && (profile.error.status === 404 || profile.error.code === 'NOT_FOUND'));
    return (
      <Screen back title="Person">
        {notFound ? (
          <Card>
            <EmptyState title="This person is not available" body="They may have left the workspace, or the link is from another one." />
          </Card>
        ) : (
          <ErrorState title="This profile could not be loaded" onRetry={() => void profile.refetch()} />
        )}
      </Screen>
    );
  }

  const known = people?.get(p.user_id);
  const name = known?.name || nameFromEmail(p.email);
  const first = firstName(name);
  return (
    <Screen back onRefresh={() => void profile.refetch()} refreshing={profile.isRefetching}>
      <Head profile={p} name={name} isYou={!!known?.isYou} />
      {p.email && !known?.isYou ? (
        <Button
          label={`Email ${first}`}
          variant="outline"
          onPress={() => void Linking.openURL(`mailto:${p.email}`).catch(() => undefined)}
          accessibilityHint={`Writes to ${p.email}`}
        />
      ) : null}

      <SectionTitle title="About" />
      <Card>{p.bio ? <T variant="body">{p.bio}</T> : <T variant="secondary">No bio yet.</T>}</Card>

      <SectionTitle title="Recent meetings" />
      <RecentMeetings meetings={p.recent_meetings} first={first} />

      <SectionTitle title="Skills" />
      <Card>{p.skills.length ? <Chips items={p.skills} /> : <T variant="secondary">No skills listed.</T>}</Card>

      <SectionTitle title="What their Myte listens for" />
      <Card style={{ gap: 10 }}>
        <T variant="meta">Topics from the role taxonomy. Their Myte surfaces notes on these first.</T>
        {p.topics.length ? <Chips items={p.topics} tone="signal" /> : <T variant="secondary">No topics yet.</T>}
      </Card>
    </Screen>
  );
}

function Head({ profile: p, name, isYou }: { profile: PersonProfile; name: string; isYou: boolean }) {
  return (
    <View style={{ gap: 12 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
        <Avatar name={name} seed={p.email} size={64} />
        <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
          <T variant="display" accessibilityRole="header">
            {isYou ? `${name} (you)` : name}
          </T>
          <T variant="secondary">{p.role ?? 'No role set yet'}</T>
        </View>
      </View>
      {p.department || p.team.length ? (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {p.department ? <Chip label={p.department.name} tone="low" /> : null}
          {p.team.map((t) => (
            <Chip key={t.id} label={t.name} />
          ))}
        </View>
      ) : null}
    </View>
  );
}

function Chips({ items, tone }: { items: string[]; tone?: ChipTone }) {
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
      {items.map((s) => (
        <Chip key={s} label={s} tone={tone} />
      ))}
    </View>
  );
}

const STATUS_META: Record<string, string> = { ended: 'Ended', scheduled: 'Scheduled', cancelled: '' };

/** Meetings they took part in, newest first (the web's order). */
function RecentMeetings({ meetings, first }: { meetings: PersonMeeting[]; first: string }) {
  if (!meetings.length) {
    return (
      <Card>
        <EmptyState compact title="No meetings yet" body={`Meetings ${first} takes part in will show up here.`} />
      </Card>
    );
  }
  const sorted = [...meetings].sort((a, b) => (b.scheduled_start ?? '').localeCompare(a.scheduled_start ?? ''));
  return (
    <Card padded={false}>
      {sorted.map((m, i) => (
        <MeetingRow key={m.id} meeting={m} first={i === 0} meta={STATUS_META[m.status] || null} />
      ))}
    </Card>
  );
}
