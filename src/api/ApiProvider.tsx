import React, { createContext, useContext } from 'react';
import type { ApiClient } from './client';

const ApiContext = createContext<ApiClient | null>(null);

/** Supplies the one REST client to the signed-in app (built in `app/(app)/_layout.tsx`). */
export function ApiProvider({ client, children }: { client: ApiClient; children: React.ReactNode }) {
  return <ApiContext.Provider value={client}>{children}</ApiContext.Provider>;
}

export function useApi(): ApiClient {
  const client = useContext(ApiContext);
  if (!client) throw new Error('useApi() outside <ApiProvider>');
  return client;
}
