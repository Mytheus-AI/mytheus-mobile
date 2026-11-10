import React from 'react';
import { View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { T } from '@/components/ui';
import { Wordmark } from '@/components/Wordmark';
import BrandMark from '@/components/BrandMark';
import { config } from '@/lib/config';
import { useTheme } from '@/theme';

/**
 * Shown when the build has no gateway address or Clerk key. There are no defaults on purpose (see
 * `src/lib/config.ts`), so this is the honest state of such a build, not an error.
 */
export default function NotConnected() {
  const p = useTheme();
  const insets = useSafeAreaInsets();
  const missing = [
    !config.apiGatewayUrl && 'EXPO_PUBLIC_API_GATEWAY_URL',
    !config.clerkPublishableKey && 'EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY',
    !config.realtimeUrl && 'EXPO_PUBLIC_REALTIME_WS_URL',
  ].filter(Boolean) as string[];
  return (
    <View style={{ flex: 1, padding: 24, paddingTop: insets.top + 48, gap: 16, backgroundColor: p.bg }}>
      <Wordmark size={30} />
      <BrandMark width={72} strokeWidth={7} />
      <T variant="display">This app is not connected to a workspace</T>
      <T variant="body">
        This build does not know which Mytheus server to use, so it cannot sign you in. Install the Mytheus app from your
        company, or set these values and rebuild:
      </T>
      <View style={{ gap: 6 }}>
        {missing.map((m) => (
          <T key={m} variant="secondary" selectable style={{ fontFamily: 'Courier' }}>
            {m}
          </T>
        ))}
      </View>
    </View>
  );
}
