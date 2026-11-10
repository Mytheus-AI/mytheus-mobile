import { useMutation, type UseMutationOptions } from '@tanstack/react-query';
import { newIdempotencyKey } from './client';

export interface Keyed<V> {
  input: V;
  /** Made once per user action; every retry of that action sends the same key. */
  key: string;
}

/**
 * A mutation whose variables carry an Idempotency-Key minted when the user acts. `run(input)`
 * mints it; TanStack's retries reuse the variables, so they reuse the key.
 */
export function useKeyedMutation<V, R>(
  fn: (input: V, key: string) => Promise<R>,
  options: Omit<UseMutationOptions<R, Error, Keyed<V>, unknown>, 'mutationFn'> = {},
) {
  const m = useMutation<R, Error, Keyed<V>, unknown>({
    ...options,
    mutationFn: ({ input, key }) => fn(input, key),
  });
  return {
    ...m,
    run: (input: V) => m.mutateAsync({ input, key: newIdempotencyKey() }),
  };
}
