import React, { useCallback } from 'react';
import { View } from 'react-native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import * as SplashScreen from 'expo-splash-screen';
import {
  useFonts,
  HankenGrotesk_400Regular,
  HankenGrotesk_500Medium,
  HankenGrotesk_600SemiBold,
  HankenGrotesk_700Bold,
  HankenGrotesk_800ExtraBold,
} from '@expo-google-fonts/hanken-grotesk';
import {
  Newsreader_400Regular,
  Newsreader_500Medium,
  Newsreader_600SemiBold,
  Newsreader_700Bold,
} from '@expo-google-fonts/newsreader';
import { Fraunces_600SemiBold } from '@expo-google-fonts/fraunces';
import { ClerkProvider } from '@clerk/clerk-expo';
import { colors } from '@/theme/tokens';
import BrandIntro from '@/components/BrandIntro';
import { ApiProvider } from '@/api/provider';
import { tokenCache } from '@/lib/secure-store';

SplashScreen.preventAutoHideAsync().catch(() => {});

// Publishable, so shipping it in the bundle is fine by design. There is no fallback value on
// purpose: a placeholder key fails at the first request with an opaque Clerk error, whereas
// an absent one fails here with a message naming the variable to set.
const CLERK_PUBLISHABLE_KEY = process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY;

export default function RootLayout() {
  const [loaded, error] = useFonts({
    HankenGrotesk_400Regular,
    HankenGrotesk_500Medium,
    HankenGrotesk_600SemiBold,
    HankenGrotesk_700Bold,
    HankenGrotesk_800ExtraBold,
    Newsreader_400Regular,
    Newsreader_500Medium,
    Newsreader_600SemiBold,
    Newsreader_700Bold,
    Fraunces_600SemiBold,
  });

  const onReady = useCallback(() => {
    if (loaded || error) SplashScreen.hideAsync().catch(() => {});
  }, [loaded, error]);

  if (!loaded && !error) return null;

  if (!CLERK_PUBLISHABLE_KEY) {
    throw new Error(
      'EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY is not set. Copy .env.example to .env and fill it.'
    );
  }

  return (
    // ClerkProvider is outermost of the two: ApiProvider reads the session through useAuth to
    // attach the bearer token, so it has to be inside.
    <ClerkProvider publishableKey={CLERK_PUBLISHABLE_KEY} tokenCache={tokenCache}>
      <ApiProvider>
        <GestureHandlerRootView style={{ flex: 1 }}>
          <SafeAreaProvider>
            <View style={{ flex: 1, backgroundColor: colors.bgApp }} onLayout={onReady}>
              <StatusBar style="dark" />
              <Stack
                screenOptions={{
                  headerShown: false,
                  contentStyle: { backgroundColor: colors.bgApp },
                  animation: 'slide_from_right',
                }}
              >
                <Stack.Screen name="(tabs)" />
                <Stack.Screen name="sign-in" options={{ animation: 'fade' }} />
                <Stack.Screen name="profile" />
                <Stack.Screen name="start-session" />
                <Stack.Screen name="live-session" />
                <Stack.Screen name="recap" />
                <Stack.Screen name="person/[id]" />
                <Stack.Screen name="insights" />
              </Stack>
              <BrandIntro />
            </View>
          </SafeAreaProvider>
        </GestureHandlerRootView>
      </ApiProvider>
    </ClerkProvider>
  );
}
