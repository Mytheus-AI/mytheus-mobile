import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useApi } from '../ApiProvider';
import { endpoints } from '../endpoints';
import { useKeyedMutation } from '../mutation';
import { qk } from '../queryKeys';
import { POLL_MS, isWriting, type Briefing, type BriefingPreferences } from '@/lib/briefing';

/* A briefing from your agent: the newest one (Home), one by id (the push lands there), the one
   about a meeting, Brief me, heard, the server voice's URL, and the preferences. A briefing
   being written is polled every 2.5 s until it is ready. */

const poll = (b: Briefing | null | undefined) => (isWriting(b) ? POLL_MS : false);

export function useLatestBriefing() {
  const api = useApi();
  return useQuery({
    queryKey: qk.briefingLatest,
    queryFn: () => endpoints.latestBriefing(api),
    refetchInterval: (q) => poll(q.state.data?.briefing),
  });
}

export function useBriefing(id: string) {
  const api = useApi();
  return useQuery({
    queryKey: qk.briefing(id),
    queryFn: () => endpoints.briefing(api, id),
    enabled: !!id,
    refetchInterval: (q) => poll(q.state.data),
  });
}

export function useMeetingBriefing(meetingId: string, enabled: boolean) {
  const api = useApi();
  return useQuery({
    queryKey: qk.meetingBriefing(meetingId),
    queryFn: () => endpoints.meetingBriefing(api, meetingId),
    enabled: enabled && !!meetingId,
    refetchInterval: (q) => poll(q.state.data?.briefing),
  });
}

export function useBriefingPreferences() {
  const api = useApi();
  return useQuery({ queryKey: qk.briefingPreferences, queryFn: () => endpoints.briefingPreferences(api) });
}

/** Brief me: the new briefing (being written) lands in every list that shows it. */
export function useBriefMe(meetingId: string | null) {
  const api = useApi();
  const qc = useQueryClient();
  return useKeyedMutation((_: void, key: string) => endpoints.briefMe(api, meetingId, key), {
    onSuccess: (b) => {
      qc.setQueryData(qk.briefing(b.id), b);
      void qc.invalidateQueries({ queryKey: ['briefing'] });
    },
  });
}

export function useBriefingHeard() {
  const api = useApi();
  const qc = useQueryClient();
  return useKeyedMutation((id: string, key: string) => endpoints.briefingHeard(api, id, key), {
    onSuccess: (b) => qc.setQueryData(qk.briefing(b.id), b),
  });
}

export function useSaveBriefingPreferences() {
  const api = useApi();
  const qc = useQueryClient();
  return useKeyedMutation(
    (prefs: BriefingPreferences, key: string) =>
      endpoints.saveBriefingPreferences(
        api,
        {
          enabled: prefs.enabled ?? true,
          auto_play: prefs.auto_play ?? false,
          length: prefs.length === 'short' ? 'short' : 'standard',
          language: prefs.language ?? 'en',
          voice: prefs.voice ?? null,
          server_voice: prefs.server_voice ?? null,
          rate: prefs.rate ?? 1,
        },
        key,
      ),
    { onSuccess: (s) => qc.setQueryData(qk.briefingPreferences, s) },
  );
}

/** A fresh, short-lived URL to the server voice (null when there is none). */
export function useBriefingAudioUrl() {
  const api = useApi();
  return async (id: string): Promise<string | null> => {
    try {
      return (await endpoints.briefingAudio(api, id)).url;
    } catch {
      return null;
    }
  };
}
