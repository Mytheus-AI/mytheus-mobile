import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Track, type LocalParticipant, type RemoteParticipant } from 'livekit-client';
import { VideoView } from '@livekit/react-native';
import { Avatar, T } from '@/components/ui';
import { HandPalm, MicrophoneSlash } from '@/components/Icon';
import { radii, useTheme } from '@/theme';

type P = LocalParticipant | RemoteParticipant;

const MAX_TILES = 6;

/** Who is in the call: their camera when it is on, their initials when it is not. */
export function Stage({
  participants,
  nameOf,
  handRaised,
}: {
  participants: P[];
  /** LiveKit identity is the internal user id; the name comes from the token or the member list. */
  nameOf: (participant: P) => string;
  handRaised: (identity: string) => boolean;
}) {
  const shown = participants.slice(0, MAX_TILES);
  const more = participants.length - shown.length;
  return (
    <View style={styles.grid} accessibilityLabel={`${participants.length} in the call`}>
      {shown.map((pt) => (
        <Tile key={pt.sid || pt.identity} participant={pt} name={nameOf(pt)} raised={handRaised(pt.identity)} count={shown.length} />
      ))}
      {more > 0 ? <MoreTile n={more} /> : null}
    </View>
  );
}

function Tile({ participant, name, raised, count }: { participant: P; name: string; raised: boolean; count: number }) {
  const p = useTheme();
  const local = participant.isLocal;
  const cam = participant.getTrackPublication(Track.Source.Camera);
  const videoTrack = cam && !cam.isMuted ? cam.videoTrack : undefined;
  const muted = !participant.isMicrophoneEnabled;
  const speaking = participant.isSpeaking;
  const width = count <= 1 ? '100%' : '48.5%';
  const label = `${local ? 'You' : name}${muted ? ', muted' : ''}${speaking ? ', speaking' : ''}${raised ? ', hand raised' : ''}`;
  return (
    <View
      accessible
      accessibilityLabel={label}
      style={[
        styles.tile,
        { width, backgroundColor: p.bg2, borderColor: speaking ? p.signalLine : 'transparent', aspectRatio: count <= 1 ? 16 / 10 : 1 },
      ]}
    >
      {videoTrack ? (
        <VideoView videoTrack={videoTrack} objectFit="cover" mirror={local} style={StyleSheet.absoluteFillObject} />
      ) : (
        <View style={styles.center}>
          <Avatar name={name} seed={participant.identity} size={count <= 1 ? 72 : 52} />
        </View>
      )}
      <View style={[styles.nameTag, { backgroundColor: p.surface }]}>
        {muted ? <MicrophoneSlash size={13} color={p.high} /> : null}
        <T variant="meta" weight="600" tone="ink" numberOfLines={1} maxFontSizeMultiplier={1.3}>
          {local ? 'You' : name}
        </T>
      </View>
      {raised ? (
        <View style={[styles.hand, { backgroundColor: p.mediumSoft }]}>
          <HandPalm size={16} color={p.medium} />
        </View>
      ) : null}
    </View>
  );
}

function MoreTile({ n }: { n: number }) {
  const p = useTheme();
  return (
    <View style={[styles.tile, styles.center, { width: '48.5%', aspectRatio: 1, backgroundColor: p.bg2 }]} accessible accessibilityLabel={`${n} more in the call`}>
      <T variant="title">+{n}</T>
    </View>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, justifyContent: 'space-between' },
  tile: { borderRadius: radii.card, overflow: 'hidden', borderWidth: 2 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  nameTag: {
    position: 'absolute',
    left: 8,
    bottom: 8,
    maxWidth: '85%',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radii.full,
  },
  hand: { position: 'absolute', right: 8, top: 8, padding: 6, borderRadius: radii.full },
});
