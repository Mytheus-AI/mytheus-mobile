import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useApi } from '../ApiProvider';
import { endpoints } from '../endpoints';
import { useKeyedMutation } from '../mutation';
import { qk } from '../queryKeys';

/* The voice your Myte speaks with (ADR-0050): the curated Kokoro voices, your choice (or none,
   so your Myte's personality picks), and whether the server voice is connected at all. */

export function useVoices() {
  const api = useApi();
  return useQuery({ queryKey: qk.voices, queryFn: () => endpoints.voices(api), staleTime: 60_000 });
}

/** `null` hands the choice back to your Myte's personality. */
export function useChooseVoice() {
  const api = useApi();
  const qc = useQueryClient();
  return useKeyedMutation((voice: string | null, key: string) => endpoints.chooseVoice(api, voice, key), {
    onSuccess: (v) => {
      qc.setQueryData(qk.voices, v);
      // The choice is stored with the briefing preferences: a later speed save must not undo it.
      void qc.invalidateQueries({ queryKey: qk.briefingPreferences });
    },
  });
}
