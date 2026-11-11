import { useQuery } from '@tanstack/react-query';
import { useApi } from '../ApiProvider';
import { endpoints } from '../endpoints';
import { qk } from '../queryKeys';

/** Whether this server can take an in-person recording (`configured: false` = not connected). */
export function useCaptureStatus() {
  const api = useApi();
  return useQuery({ queryKey: qk.captureStatus, queryFn: () => endpoints.captureStatus(api), staleTime: 60_000 });
}
