import { useCallback, useMemo, useState } from 'react';
import { useUser } from '@clerk/expo';
import { useBriefingPreferences } from '@/api/hooks/briefings';
import { useDecisions } from '@/api/hooks/decisions';
import { useMe } from '@/api/hooks/identity';
import { useTasks } from '@/api/hooks/work';
import { agentDisplayName, asPersonality } from '@/lib/ask-myte/persona';
import type { Personality } from '@/lib/ask-myte/types';
import { agentSeed } from '@/lib/briefing';
import { composeMyteTalk, type MyteTalk } from '@/lib/myte-talk';

/* Your Myte talking you through your decisions and tasks (system.md N28): the four reads it
   needs, all existing ones (`GET /api/v1/decisions`, `GET /api/v1/actions/mine`, `GET /users/me`,
   the briefing preferences), and the script composed from them. No new call.

   - `now` is taken once, when the screen opens, so the script does not change while it is said.
   - `error` only when both lists failed; when one failed the script says so in a line.
   - The persona is the one the briefing card draws: the same face seed and the same name. */

export interface MytePersona {
  /** The name on screen: "Nova", else "Sam's Myte". */
  name: string;
  /** The name it says: "Nova", else "your Myte" (never "Sam's Myte" to Sam). */
  spokenName: string;
  seed: string;
  personality: Personality;
}

export type MyteTalkState = 'loading' | 'ready' | 'error';

export function useMyteTalk() {
  const { user } = useUser();
  const me = useMe();
  const decisions = useDecisions();
  const tasks = useTasks('confirmed');
  const prefs = useBriefingPreferences();
  const [now] = useState(() => new Date());

  const profile = me.data;
  const clerkFirst = user?.firstName ?? '';
  const persona = useMemo<MytePersona>(
    () => ({
      name: agentDisplayName(profile?.agent_name, profile?.display_name ?? clerkFirst),
      spokenName: profile?.agent_name?.trim() || 'your Myte',
      seed: agentSeed(profile?.agent_avatar_seed, user?.id ?? ''),
      personality: asPersonality(profile?.agent_personality),
    }),
    [profile, clerkFirst, user?.id],
  );
  const personFirstName = clerkFirst || profile?.display_name || null;

  // A list that failed with nothing cached is null (said as "I couldn't reach..."); a failed
  // refresh keeps what was already read.
  const decisionData = decisions.data;
  const decisionsFailed = !decisionData && decisions.isError;
  const taskData = tasks.data;
  const tasksFailed = !taskData && tasks.isError;

  const talk = useMemo<MyteTalk>(
    () =>
      composeMyteTalk({
        spokenName: persona.spokenName,
        personFirstName,
        decisions: decisionsFailed ? null : (decisionData?.items ?? []),
        tasks: tasksFailed ? null : (taskData?.items ?? []),
        now,
      }),
    [persona.spokenName, personFirstName, decisionData, decisionsFailed, taskData, tasksFailed, now],
  );

  const state: MyteTalkState =
    decisions.isPending || tasks.isPending || me.isPending || prefs.isPending
      ? 'loading'
      : decisionsFailed && tasksFailed
        ? 'error'
        : 'ready';

  const { refetch: refetchDecisions } = decisions;
  const { refetch: refetchTasks } = tasks;
  const { refetch: refetchMe } = me;
  const { refetch: refetchPrefs } = prefs;
  const refetch = useCallback(() => {
    void refetchDecisions();
    void refetchTasks();
    void refetchMe();
    void refetchPrefs();
  }, [refetchDecisions, refetchTasks, refetchMe, refetchPrefs]);

  return {
    state,
    persona,
    talk,
    voice: { language: prefs.data?.language ?? 'en', rate: prefs.data?.rate ?? 1 },
    refreshing: decisions.isRefetching || tasks.isRefetching,
    refetch,
  };
}
