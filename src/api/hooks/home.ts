import { useQuery } from '@tanstack/react-query';
import { useApi } from '../ApiProvider';
import { endpoints } from '../endpoints';
import { qk } from '../queryKeys';

/** `GET /bff/dashboard`: upcoming and recent meetings, open tasks, decisions, what needs review. */
export function useDashboard() {
  const api = useApi();
  return useQuery({ queryKey: qk.dashboard, queryFn: () => endpoints.dashboard(api) });
}
