import React from 'react';
import { Pressable, View } from 'react-native';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { useUser } from '@clerk/expo';
import { useDashboard } from '@/api/hooks/home';
import { useInbox } from '@/api/hooks/inbox';
import { useBriefingPreferences, useLatestBriefing } from '@/api/hooks/briefings';
import { BriefingPanel } from '@/components/feature/Briefing';
import { Avatar, Button, Card, EmptyState, ErrorState, PageHead, Row, Screen, SectionTitle, Skeleton, T } from '@/components/ui';
import { MeetingRow, meetingTitle } from '@/components/feature/MeetingRow';
import { Scales, Tray, CheckSquare, Microphone, type IconType } from '@/components/Icon';
import { greeting, plural, whenLabel } from '@/lib/format';
import { radii, useTheme } from '@/theme';
import type { DashboardMeeting } from '@/api/types';

/** Home: the next meeting, what is waiting on you, and what was decided lately. */
export default function Home() {
  const router = useRouter();
  const { user } = useUser();
  const dash = useDashboard();
  const inbox = useInbox();
  const d = dash.data;

  const upcoming = (d?.upcoming_meetings.items ?? []).filter((m) => m.status === 'live' || m.status === 'scheduled');
  const next = upcoming.find((m) => m.status === 'live') ?? upcoming[0] ?? null;
  const rest = upcoming.filter((m) => m.id !== next?.id).slice(0, 4);
  const name = user?.firstName || user?.fullName || '';

  return (
    <Screen
      onRefresh={() => {
        void dash.refetch();
        inbox.refetch();
      }}
      refreshing={dash.isRefetching}
    >
      <PageHead
        kicker={greeting()}
        title={name ? `Hello, ${name}` : 'Hello'}
        right={
          <Pressable accessibilityRole="button" accessibilityLabel="Settings and account" onPress={() => router.push('/settings')} hitSlop={8}>
            <Avatar name={user?.fullName || name || 'You'} seed={user?.id} size={40} />
          </Pressable>
        }
      />

      {dash.isPending ? (
        <Skeleton lines={2} />
      ) : dash.isError && !d ? (
        <ErrorState onRetry={() => void dash.refetch()} />
      ) : (
        <NextMeeting meeting={next} />
      )}

      <HomeBriefing />

      <View style={{ flexDirection: 'row', gap: 12 }}>
        <Tile
          icon={Tray}
          label="Waiting on you"
          value={inbox.loading ? null : inbox.counts.all}
          onPress={() => router.push('/inbox')}
        />
        <Tile
          icon={CheckSquare}
          label="Open tasks"
          value={d ? (d.action_items.status === 'degraded' ? null : d.action_items.items.length) : null}
          onPress={() => router.push('/work?tab=tasks')}
        />
      </View>

      <Button
        label="Record in person"
        variant="outline"
        icon={Microphone}
        accessibilityHint="Records a meeting held in a room on this phone"
        onPress={() => router.push('/capture')}
      />

      {rest.length ? (
        <>
          <SectionTitle title="Coming up" right={<Button label="All meetings" variant="ghost" small onPress={() => router.push('/meetings')} />} />
          <Card padded={false}>
            {rest.map((m, i) => (
              <MeetingRow key={m.id} meeting={m} first={i === 0} />
            ))}
          </Card>
        </>
      ) : null}

      <SectionTitle title="Recent decisions" right={<Button label="Decision log" variant="ghost" small icon={Scales} onPress={() => router.push('/decisions')} />} />
      {d?.decisions.status === 'degraded' ? (
        <ErrorState title="Decisions could not be loaded" onRetry={() => void dash.refetch()} />
      ) : d && d.decisions.items.length === 0 ? (
        <Card>
          <EmptyState compact title="No decisions yet" body="When someone confirms a decision in a meeting, it is kept here with its lineage." />
        </Card>
      ) : d ? (
        <Card padded={false}>
          {d.decisions.items.slice(0, 3).map((dec, i) => (
            <Row
              key={dec.id}
              first={i === 0}
              onPress={() => router.push(`/decisions/${dec.id}`)}
              accessibilityLabel={`Decision: ${dec.content}`}
            >
              <T variant="body" tone="ink" numberOfLines={3}>
                {dec.content}
              </T>
              {dec.meeting_title ? (
                <T variant="meta" style={{ marginTop: 4 }}>
                  {dec.meeting_title}
                </T>
              ) : null}
            </Row>
          ))}
        </Card>
      ) : null}

      {d && d.recent_meetings.items.length ? (
        <>
          <SectionTitle title="Recent meetings" />
          <Card padded={false}>
            {d.recent_meetings.items.slice(0, 4).map((m, i) => (
              <MeetingRow
                key={m.id}
                first={i === 0}
                meeting={{ ...m, status: 'ended' }}
                meta={[m.decision_count ? plural(m.decision_count, 'decision') : null, m.action_count ? plural(m.action_count, 'action') : null]
                  .filter(Boolean)
                  .join(', ')}
              />
            ))}
          </Card>
        </>
      ) : null}
    </Screen>
  );
}

/** The one washed surface in the app: what is next, and the way in. */
function NextMeeting({ meeting }: { meeting: DashboardMeeting | null }) {
  const p = useTheme();
  const router = useRouter();
  return (
    <LinearGradient
      colors={p.wash}
      start={{ x: 0.08, y: 0 }}
      end={{ x: 0.92, y: 1 }}
      style={{ borderRadius: radii.hero, padding: 20, gap: 8 }}
    >
      {meeting ? (
        <>
          <T variant="label" style={{ color: p.ink2 }}>
            {meeting.status === 'live' ? (meeting.recorded_in_person ? 'Recording in person now' : 'Happening now') : 'Next meeting'}
          </T>
          <T variant="title" style={{ fontSize: 24, lineHeight: 30 }}>
            {meetingTitle(meeting)}
          </T>
          <T variant="secondary" style={{ color: p.ink2 }}>
            {whenLabel(meeting.scheduled_start) || 'No time set'}
          </T>
          <View style={{ flexDirection: 'row', gap: 10, marginTop: 8, flexWrap: 'wrap' }}>
            {meeting.recorded_in_person ? null : <Button label="Join meeting" onPress={() => router.push(`/meetings/${meeting.id}/join`)} />}
            <Button label="Details" variant="outline" onPress={() => router.push(`/meetings/${meeting.id}`)} />
          </View>
        </>
      ) : (
        <>
          <T variant="label" style={{ color: p.ink2 }}>
            Next meeting
          </T>
          <T variant="title">Nothing on your calendar</T>
          <T variant="secondary" style={{ color: p.ink2 }}>
            Meetings you are invited to show up here, with a way to join from your phone.
          </T>
        </>
      )}
    </LinearGradient>
  );
}

function Tile({ icon: Icon, label, value, onPress }: { icon: IconType; label: string; value: number | null; onPress: () => void }) {
  const p = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={value === null ? label : `${label}: ${value}`}
      style={({ pressed }) => ({ flex: 1, opacity: pressed ? 0.85 : 1 })}
    >
      <Card style={{ gap: 6 }}>
        <Icon size={20} color={p.ink3} />
        <T variant="display" style={{ fontSize: 28, lineHeight: 32 }}>
          {value === null ? '-' : String(value)}
        </T>
        <T variant="secondary">{label}</T>
      </Card>
    </Pressable>
  );
}

/** The newest briefing from your agent, with Brief me ("since my last briefing"). */
function HomeBriefing() {
  const latest = useLatestBriefing();
  const prefs = useBriefingPreferences();
  if (latest.isPending) return <Skeleton lines={2} />;
  if (latest.isError && !latest.data) return <ErrorState title="Your briefing could not be loaded" onRetry={() => void latest.refetch()} />;
  return <BriefingPanel briefing={latest.data?.briefing ?? null} prefs={prefs.data ?? null} enabled={latest.data?.enabled ?? true} />;
}
