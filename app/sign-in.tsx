import React, { useCallback, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useSSO } from '@clerk/clerk-expo';
import * as Linking from 'expo-linking';
import { colors, radii, shadows } from '@/theme/tokens';
import { sans, wordmark } from '@/theme/typography';
import { Lock } from '@/components/icons';
import BrandMark from '@/components/BrandMark';
import Tappable from '@/components/Tappable';

/**
 * Sign-in through Clerk. Workspaces are provisioned by the company, so there is no sign-up
 * path: signing in establishes the session and org membership already exists.
 *
 * The session token this produces carries the Clerk organization claim that `api-gateway`
 * resolves to our `org_id`. The client never sees or sends that `org_id`, which is why there
 * is no org picker here: switching organizations re-authenticates through Clerk rather than
 * changing anything the app holds.
 */
export default function SignInScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { startSSOFlow } = useSSO();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onSignIn = useCallback(async () => {
    if (pending) return; // a double tap would open two browser sessions
    setPending(true);
    setError(null);
    try {
      const { createdSessionId, setActive } = await startSSOFlow({
        strategy: 'oauth_google',
        redirectUrl: Linking.createURL('/'),
      });
      if (createdSessionId && setActive) {
        await setActive({ session: createdSessionId });
        router.replace('/');
        return;
      }
      // No session and no throw means the user dismissed the browser. Not an error state:
      // showing a red message for "changed my mind" is noise.
    } catch {
      // Deliberately generic. Clerk's message can name whether an account exists, which is
      // an account-enumeration oracle on a sign-in screen.
      setError('Could not sign in. Check your connection and try again.');
    } finally {
      setPending(false);
    }
  }, [pending, router, startSSOFlow]);

  return (
    <View style={[styles.screen, { paddingTop: insets.top, paddingBottom: insets.bottom + 18 }]}>
      <View style={styles.heroArea}>
        <BrandMark width={190} strokeWidth={7} />
        <Text style={styles.wordmark}>Mytheus</Text>
        <Text style={styles.tagline}>Every meeting, remembered.</Text>
      </View>

      <View style={styles.footer}>
        <Tappable scaleTo={0.97} onPress={onSignIn}>
          <View style={[styles.ssoBtn, pending && styles.ssoBtnPending]}>
            <Text style={styles.ssoText}>
              {pending ? 'Opening sign-in...' : 'Sign in with your work account'}
            </Text>
          </View>
        </Tappable>

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <View style={styles.provisionRow}>
          <Lock size={12} color={colors.mutedDeep} />
          <Text style={styles.provisionText}>
            Your workspace is provisioned by your company.
          </Text>
        </View>

        <Text style={styles.legal}>Terms · Privacy</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bgApp, paddingHorizontal: 24 },
  heroArea: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  wordmark: {
    fontFamily: wordmark(),
    fontSize: 40,
    letterSpacing: -0.8,
    color: colors.inkDeep,
    marginTop: 22,
  },
  tagline: {
    fontFamily: sans('500'),
    fontSize: 14.5,
    color: colors.mutedDeep,
    marginTop: 8,
  },
  footer: { gap: 14 },
  ssoBtn: {
    backgroundColor: colors.dark,
    borderRadius: radii.button,
    paddingVertical: 16,
    alignItems: 'center',
    ...shadows.darkButton,
  },
  ssoBtnPending: { opacity: 0.6 },
  ssoText: { fontFamily: sans('700'), fontSize: 15.5, color: colors.white },
  error: {
    fontFamily: sans('500'),
    fontSize: 13,
    color: colors.mutedDeep,
    textAlign: 'center',
  },
  provisionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  provisionText: { fontFamily: sans('500'), fontSize: 12.5, color: colors.mutedDeep },
  legal: {
    fontFamily: sans('600'),
    fontSize: 11.5,
    color: colors.mutedLabel,
    textAlign: 'center',
    marginTop: 2,
  },
});
