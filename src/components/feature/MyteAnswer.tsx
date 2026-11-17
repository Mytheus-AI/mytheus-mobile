import React, { useMemo } from 'react';
import { Pressable, View } from 'react-native';
import { Button, Card, T } from '@/components/ui';
import StreamingDots from '@/components/StreamingDots';
import { ArrowsClockwise, CaretRight, WarningCircle } from '@/components/Icon';
import { blocksOf, inlineParts, type Block } from '@/lib/ask-myte/answer-text';
import { sourceHref, sourceLinkLabel, sourceMeta, sourceTitle } from '@/lib/ask-myte/citations';
import { failureCopy } from '@/lib/ask-myte/failure';
import { isSlow, type Answer } from '@/lib/ask-myte/reducer';
import type { Source } from '@/lib/ask-myte/types';
import { appRoute } from '@/lib/routes';
import { radii, useTheme } from '@/theme';

/**
 * One Myte answer as it streams and after (ADR-0047 D8, D10), drawn from the shared reducer's
 * `Answer`: what it is doing, the text laid out as the web's `AnswerText` lays it out (paragraphs,
 * lists, **bold**, `[n]` markers with a source; a marker with none is dropped), the numbered
 * sources (each opens its screen when the app has one), the follow-ups, and every failure in the
 * Myte's own words with its way out (Retry, or Sign in again for an expired session).
 * Cards and proposals are kept in the stored answer but not drawn on the phone yet (Phase A).
 */
export function MyteAnswer({
  answer,
  now,
  last,
  onRetry,
  onFollowup,
  onOpen,
  onSignIn,
}: {
  answer: Answer;
  now: number;
  /** the conversation's latest answer: only it offers Retry and follow-ups */
  last: boolean;
  onRetry: () => void;
  onFollowup: (question: string) => void;
  onOpen: (route: string) => void;
  /** the "Sign in again" way out of an expired session (the web reloads into its sign-in) */
  onSignIn: () => void;
}) {
  const p = useTheme();
  const streaming = answer.status === 'streaming';
  const settled = answer.status === 'done';
  const hasText = answer.text.trim().length > 0;
  const blocks = useMemo(() => blocksOf(answer.text), [answer.text]);
  const running = answer.steps.filter((s) => s.state === 'running');
  const failure =
    answer.status === 'stopped'
      ? failureCopy('stopped', { name: 'Myte' })
      : answer.status === 'error' && answer.error
        ? failureCopy(answer.error.reason, { name: 'Myte', message: answer.error.message })
        : null;

  return (
    <Card style={{ gap: 10 }}>
      {streaming && !hasText ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }} accessibilityLiveRegion="polite">
          <T variant="secondary">{isSlow(answer, now) ? 'Still looking' : running[running.length - 1]?.label || 'Looking'}</T>
          <StreamingDots visible />
        </View>
      ) : null}

      {settled && answer.abstained ? (
        <T variant="meta" weight="600">
          Nothing found
        </T>
      ) : null}

      {hasText ? (
        <View style={{ gap: 12 }} accessibilityLiveRegion={streaming ? 'polite' : 'none'}>
          {blocks.map((b, i) => (
            <AnswerBlock key={i} block={b} sources={answer.sources} />
          ))}
        </View>
      ) : null}

      {settled && answer.degraded ? (
        <T variant="meta">A shorter answer than usual: your workspace&apos;s AI budget is nearly used.</T>
      ) : null}
      {answer.saved === false ? <T variant="meta">This answer couldn&apos;t be saved to your history.</T> : null}

      {failure ? (
        <View accessibilityRole="alert" style={{ gap: 8, padding: 12, borderRadius: radii.ctl, backgroundColor: p.surface2 }}>
          <View style={{ flexDirection: 'row', gap: 8, alignItems: 'flex-start' }}>
            {answer.status === 'stopped' ? null : <WarningCircle size={18} color={p.medium} />}
            <T variant="body" tone="ink" style={{ flex: 1 }}>
              <T variant="body" weight="600" tone="ink">
                {failure.title}
              </T>{' '}
              <T variant="body" tone="ink2">
                {failure.detail}
              </T>
            </T>
          </View>
          {(failure.retry && last) || failure.action ? (
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              {failure.retry && last ? <Button small variant="outline" icon={ArrowsClockwise} label="Retry" onPress={onRetry} /> : null}
              {/* Only the session's way out exists on the phone: the admin ones (`isAdmin`) open
                  web-only Workspace pages and are never offered here. */}
              {failure.action && answer.error?.reason === 'session' ? (
                <Button small variant="outline" label={failure.action.label} onPress={onSignIn} />
              ) : null}
            </View>
          ) : null}
        </View>
      ) : null}

      {answer.sources.length ? (
        <View style={{ gap: 8, marginTop: 4 }}>
          <T variant="label">Sources</T>
          {answer.sources.map((s) => (
            <SourceRow key={s.n} source={s} onOpen={onOpen} />
          ))}
        </View>
      ) : null}

      {settled && last && answer.followups.length ? (
        <View style={{ gap: 4, marginTop: 4 }} accessibilityLabel="Ask next">
          <T variant="label">Ask next</T>
          {answer.followups.map((f) => (
            <Pressable
              key={f}
              onPress={() => onFollowup(f)}
              accessibilityRole="button"
              accessibilityLabel={`Ask: ${f}`}
              style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 40, paddingHorizontal: 4, borderRadius: radii.ctl, backgroundColor: pressed ? p.bg2 : 'transparent' })}
            >
              <T variant="secondary" tone="ink2" style={{ flex: 1 }}>
                {f}
              </T>
              <CaretRight size={14} color={p.ink4} />
            </Pressable>
          ))}
        </View>
      ) : null}
    </Card>
  );
}

/** One paragraph or list of the answer, as the web's `AnswerText` draws it. */
function AnswerBlock({ block, sources }: { block: Block; sources: Source[] }) {
  const p = useTheme();
  if (block.kind === 'p') return <Inline text={block.text} sources={sources} />;
  return (
    <View style={{ gap: 4 }}>
      {block.items.map((item, i) => (
        <View key={i} style={{ flexDirection: 'row', gap: 8 }}>
          <T variant="body" style={{ color: block.kind === 'ul' ? p.ink4 : p.ink3, minWidth: 16 }} accessibilityElementsHidden importantForAccessibility="no">
            {block.kind === 'ul' ? '•' : `${i + 1}.`}
          </T>
          <View style={{ flex: 1 }}>
            <Inline text={item} sources={sources} />
          </View>
        </View>
      ))}
    </View>
  );
}

/** A run of text with its bold spans and `[n]` source markers. */
function Inline({ text, sources }: { text: string; sources: Source[] }) {
  const p = useTheme();
  const parts = inlineParts(text, sources);
  return (
    <T variant="body" tone="ink2">
      {parts.map((part, i) =>
        part.kind === 'text' ? (
          part.text
        ) : part.kind === 'bold' ? (
          <T key={i} variant="body" weight="600" tone="ink">
            {part.text}
          </T>
        ) : (
          <T key={i} variant="meta" weight="700" style={{ color: p.signalInk }} accessibilityLabel={`source ${part.n}`}>
            {` [${part.n}]`}
          </T>
        ),
      )}
    </T>
  );
}

function SourceRow({ source: s, onOpen }: { source: Source; onOpen: (route: string) => void }) {
  const p = useTheme();
  // Web paths mapped to this app's screens; a source with no screen here is shown, not linked.
  const route = appRoute(sourceHref(s));
  const title = sourceTitle(s);
  const meta = sourceMeta(s);
  const link = route ? sourceLinkLabel(s) : null;
  return (
    <Pressable
      disabled={!route}
      onPress={() => route && onOpen(route)}
      accessibilityRole={route ? 'link' : 'text'}
      accessibilityLabel={[`Source ${s.n}`, title, meta, s.text].filter(Boolean).join('. ')}
      accessibilityHint={link ?? undefined}
      style={({ pressed }) => ({ flexDirection: 'row', gap: 10, padding: 10, borderRadius: radii.ctl, backgroundColor: pressed ? p.bg2 : p.surface2 })}
    >
      <T variant="meta" weight="700" style={{ color: p.signalInk }}>
        {s.n}
      </T>
      <View style={{ flex: 1, gap: 2 }}>
        <T variant="secondary" weight="600" tone="ink" numberOfLines={2}>
          {title}
        </T>
        {meta ? <T variant="meta">{meta}</T> : null}
        {s.text ? (
          <T variant="secondary" tone="ink2" numberOfLines={4}>
            {s.text}
          </T>
        ) : null}
      </View>
    </Pressable>
  );
}
