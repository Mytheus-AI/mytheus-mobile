import { useApi } from '../ApiProvider';
import { endpoints } from '../endpoints';
import { useKeyedMutation } from '../mutation';

/**
 * Ask across your meetings (`POST /api/v1/ask` on bff): a grounded answer with numbered citations,
 * or an honest abstention when the sources do not support one. Optionally narrowed to one meeting
 * you took part in.
 */
export function useAsk() {
  const api = useApi();
  return useKeyedMutation(
    ({ question, meetingId }: { question: string; meetingId: string | null }, key: string) =>
      endpoints.ask(api, question, meetingId, key),
    { retry: false },
  );
}
