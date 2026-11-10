import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useApi } from '../ApiProvider';
import { endpoints } from '../endpoints';
import { useKeyedMutation } from '../mutation';
import { qk } from '../queryKeys';

/** The decision log: confirmed and superseded decisions from meetings you can see. */
export function useDecisions() {
  const api = useApi();
  return useQuery({ queryKey: qk.decisions, queryFn: () => endpoints.decisions(api) });
}

/** One decision's record: what was decided, by whom, its lineage, and the meeting's actions. */
export function useDecisionRecord(id: string) {
  const api = useApi();
  return useQuery({ queryKey: qk.decision(id), queryFn: () => endpoints.decisionRecord(api, id), enabled: !!id });
}

export function useShareLinks(decisionId: string) {
  const api = useApi();
  return useQuery({
    queryKey: qk.shareLinks(decisionId),
    queryFn: () => endpoints.decisionShareLinks(api, decisionId),
    enabled: !!decisionId,
  });
}

/** A read-only link to the decision record for people outside the workspace (30 days). */
export function useCreateShareLink() {
  const api = useApi();
  const qc = useQueryClient();
  return useKeyedMutation((decisionId: string, key: string) => endpoints.createDecisionShareLink(api, decisionId, key), {
    onSuccess: (_link, { input }) => {
      void qc.invalidateQueries({ queryKey: qk.shareLinks(input) });
    },
  });
}
