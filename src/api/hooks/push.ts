import { useQuery } from '@tanstack/react-query';
import { useApi } from '../ApiProvider';
import { endpoints } from '../endpoints';
import { qk } from '../queryKeys';

/** This person's registered phones and whether the server sends pushes at all. */
export function usePushDevices() {
  const api = useApi();
  return useQuery({ queryKey: qk.pushDevices, queryFn: () => endpoints.pushDevices(api), staleTime: 60_000 });
}
