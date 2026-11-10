import React, { useEffect, useState } from 'react';
import { View } from 'react-native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import * as SplashScreen from 'expo-splash-screen';
import { ClerkProvider } from '@clerk/expo';
import { tokenCache } from '@clerk/expo/token-cache';
import { QueryClientProvider } from '@tanstack/react-query';
import { registerGlobals } from '@livekit/react-native';
import {
  useFonts,
  HankenGrotesk_400Regular,
  HankenGrotesk_500Medium,
  HankenGrotesk_600SemiBold,
  HankenGrotesk_700Bold,
} from '@expo-google-fonts/hanken-grotesk';
import {
  Newsreader_400Regular,
  Newsreader_400Regular_Italic,
  Newsreader_500Medium,
  Newsreader_600SemiBold,
} from '@expo-google-fonts/newsreader';
import { Fraunces_600SemiBold } from '@expo-google-fonts/fraunces';
import { createQueryClient, wireAppFocus } from '@/api/query';
import { ToastProvider } from '@/components/ui';
import NotConnected from '@/components/NotConnected';
import { config, isConnected } from '@/lib/config';
import { useIsDark, useTheme } from '@/theme';

// LiveKit's WebRTC globals, once, before any room exists.
registerGlobals();
SplashScreen.preventAutoHideAsync().catch(() => undefined);

export default function RootLayout() {
  const p = useTheme();
  const dark = useIsDark();
  const [queryClient] = useState(createQueryClient);
  const [loaded, error] = useFonts({
    HankenGrotesk_400Regular,
    HankenGrotesk_500Medium,
    HankenGrotesk_600SemiBold,
    HankenGrotesk_700Bold,
    Newsreader_400Regular,
    Newsreader_400Regular_Italic,
    Newsreader_500Medium,
    Newsreader_600SemiBold,
    Fraunces_600SemiBold,
  });

  useEffect(() => wireAppFocus(), []);
  useEffect(() => {
    if (loaded || error) SplashScreen.hideAsync().catch(() => undefined);
  }, [loaded, error]);

  if (!loaded && !error) return null;

  const shell = (children: React.ReactNode) => (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <View style={{ flex: 1, backgroundColor: p.bg }}>
          <StatusBar style={dark ? 'light' : 'dark'} />
          {children}
        </View>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );

  // Not built for a workspace: say so plainly rather than guess a server.
  if (!isConnected() || !config.clerkPublishableKey) return shell(<NotConnected />);

  return shell(
    <ClerkProvider publishableKey={config.clerkPublishableKey} tokenCache={tokenCache}>
      <QueryClientProvider client={queryClient}>
        <ToastProvider>
          <Stack
            screenOptions={{
              headerShown: false,
              contentStyle: { backgroundColor: p.bg },
              animation: 'slide_from_right',
            }}
          >
            <Stack.Screen name="(auth)" options={{ animation: 'fade' }} />
            <Stack.Screen name="(app)" options={{ animation: 'fade' }} />
          </Stack>
        </ToastProvider>
      </QueryClientProvider>
    </ClerkProvider>,
  );
}
