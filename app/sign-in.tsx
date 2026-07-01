import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, radii, shadows } from '@/theme/tokens';
import { sans, wordmark } from '@/theme/typography';
import { Lock } from '@/components/icons';
import BrandMark from '@/components/BrandMark';
import Tappable from '@/components/Tappable';
import { currentUser } from '@/data/mock';
import { signIn } from '@/lib/session';

/**
 * Sign-in. Workspaces are provisioned by the company, so there is no
 * sign-up path - one tap establishes the (mock) session.
 */
export default function SignInScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const onSignIn = () => {
    signIn();
    router.replace('/');
  };

  return (
    <View style={[styles.screen, { paddingTop: insets.top, paddingBottom: insets.bottom + 18 }]}>
      <View style={styles.heroArea}>
        <BrandMark width={190} strokeWidth={7} />
        <Text style={styles.wordmark}>Mytheus</Text>
        <Text style={styles.tagline}>Every meeting, remembered.</Text>
      </View>

      <View style={styles.footer}>
        <Tappable scaleTo={0.97} onPress={onSignIn}>
          <View style={styles.ssoBtn}>
            <Text style={styles.ssoText}>Sign in with {currentUser.org}</Text>
          </View>
        </Tappable>

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
  ssoText: { fontFamily: sans('700'), fontSize: 15.5, color: colors.white },
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
