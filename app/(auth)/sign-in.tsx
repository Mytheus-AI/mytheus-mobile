import React, { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useSignIn } from '@clerk/expo/legacy';
import { Button, T } from '@/components/ui';
import { Wordmark } from '@/components/Wordmark';
import BrandMark from '@/components/BrandMark';
import { Field } from '@/components/Field';
import { clerkMessage, emailCodeFactor, nextStep, secondFactor, type FactorLike } from '@/auth/sign-in-flow';
import { useTheme } from '@/theme';

type Stage = 'identify' | 'email-code' | 'second-factor';

/**
 * Sign in with the account your company gave you. There is no sign-up here: workspaces invite
 * people on the web (CLAUDE.md: admin flows stay on the web).
 */
export default function SignIn() {
  const p = useTheme();
  const insets = useSafeAreaInsets();
  const { isLoaded, signIn, setActive } = useSignIn();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [stage, setStage] = useState<Stage>('identify');
  const [factor, setFactor] = useState<FactorLike | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function finish(sessionId: string | null) {
    if (!setActive || !sessionId) return;
    await setActive({ session: sessionId });
  }

  async function follow(attempt: NonNullable<typeof signIn>) {
    const step = nextStep(attempt);
    if (step === 'done') return finish(attempt.createdSessionId);
    if (step === 'second-factor') {
      const f = secondFactor(attempt.supportedSecondFactors as FactorLike[] | null);
      if (f?.strategy === 'email_code' && f.emailAddressId) {
        await attempt.prepareSecondFactor({ strategy: 'email_code', emailAddressId: f.emailAddressId });
      } else if (f?.strategy === 'phone_code') {
        await attempt.prepareSecondFactor({ strategy: 'phone_code' });
      }
      setFactor(f);
      setCode('');
      setStage('second-factor');
      return;
    }
    if (step === 'email-code') return sendCode(attempt);
    setError('This account needs a sign-in step the app does not support yet. Sign in on the web first.');
  }

  async function sendCode(attempt: NonNullable<typeof signIn>) {
    const f = emailCodeFactor(attempt.supportedFirstFactors as FactorLike[] | null);
    if (!f?.emailAddressId) {
      setError('This workspace does not allow sign-in codes. Use your password.');
      return;
    }
    await attempt.prepareFirstFactor({ strategy: 'email_code', emailAddressId: f.emailAddressId });
    setFactor(f);
    setCode('');
    setStage('email-code');
  }

  async function run(fn: () => Promise<unknown>, fallback: string) {
    setBusy(true);
    setError(null);
    try {
      await fn();
    } catch (err) {
      setError(clerkMessage(err, fallback));
    } finally {
      setBusy(false);
    }
  }

  const withPassword = () =>
    run(async () => {
      if (!signIn) return;
      const attempt = await signIn.create({ identifier: email.trim(), password });
      await follow(attempt);
    }, 'That email and password did not work.');

  const withCode = () =>
    run(async () => {
      if (!signIn) return;
      const attempt = await signIn.create({ identifier: email.trim() });
      await sendCode(attempt);
    }, 'A code could not be sent to that address.');

  const verify = () =>
    run(async () => {
      if (!signIn) return;
      const attempt =
        stage === 'email-code'
          ? await signIn.attemptFirstFactor({ strategy: 'email_code', code: code.trim() })
          : await signIn.attemptSecondFactor({
              strategy: (factor?.strategy as 'email_code' | 'totp' | 'phone_code') ?? 'email_code',
              code: code.trim(),
            });
      await follow(attempt);
    }, 'That code did not work. Check it and try again.');

  const emailOk = /^\S+@\S+\.\S+$/.test(email.trim());

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: p.bg }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView
        contentContainerStyle={{ padding: 24, paddingTop: insets.top + 48, gap: 18 }}
        keyboardShouldPersistTaps="handled"
      >
        <Wordmark size={30} />
        <BrandMark width={72} strokeWidth={7} />
        <View style={{ gap: 6 }}>
          <T variant="display">{stage === 'identify' ? 'Sign in' : 'Check your email'}</T>
          <T variant="body">
            {stage === 'identify'
              ? 'Use the account your company set up for Mytheus.'
              : stage === 'email-code' || factor?.strategy === 'email_code'
                ? `We sent a six-digit code to ${email.trim()}.`
                : factor?.strategy === 'totp'
                  ? 'Enter the code from your authenticator app.'
                  : 'Enter the code we sent to your phone.'}
          </T>
        </View>

        {stage === 'identify' ? (
          <>
            <Field
              label="Work email"
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              autoComplete="email"
              keyboardType="email-address"
              textContentType="emailAddress"
              returnKeyType="next"
            />
            <Field
              label="Password"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              autoComplete="password"
              textContentType="password"
              returnKeyType="go"
              onSubmitEditing={() => emailOk && password && void withPassword()}
            />
            {error ? (
              <T variant="secondary" tone="high" accessibilityRole="alert">
                {error}
              </T>
            ) : null}
            <Button label="Sign in" full busy={busy} disabled={!isLoaded || !emailOk || !password} onPress={() => void withPassword()} />
            <Button
              label="Email me a sign-in code"
              variant="ghost"
              full
              disabled={!isLoaded || !emailOk || busy}
              onPress={() => void withCode()}
            />
          </>
        ) : (
          <>
            <CodeField value={code} onChange={setCode} />
            {error ? (
              <T variant="secondary" tone="high" accessibilityRole="alert">
                {error}
              </T>
            ) : null}
            <Button label="Continue" full busy={busy} disabled={code.trim().length < 6} onPress={() => void verify()} />
            <Button
              label="Use a different account"
              variant="ghost"
              full
              onPress={() => {
                setStage('identify');
                setError(null);
                setCode('');
              }}
            />
          </>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function CodeField({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <Field
      label="Code"
      value={value}
      onChangeText={(v) => onChange(v.replace(/\D/g, '').slice(0, 6))}
      keyboardType="number-pad"
      autoComplete="one-time-code"
      textContentType="oneTimeCode"
      maxLength={6}
    />
  );
}

