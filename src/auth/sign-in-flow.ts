/**
 * Which step a Clerk sign-in attempt needs next, from its status. Pure, so it is tested without
 * Clerk. Accounts are provisioned by the company on the web, so the phone only signs in: with a
 * password, or with a code emailed to the address (when the workspace allows either), plus the
 * second step Clerk asks for on a new device or with two-step verification.
 */

export type SignInStep = 'done' | 'email-code' | 'second-factor' | 'unsupported';

export interface FactorLike {
  strategy: string;
  emailAddressId?: string;
}

export interface SignInLike {
  status: string | null;
  supportedFirstFactors?: FactorLike[] | null;
  supportedSecondFactors?: FactorLike[] | null;
}

export function nextStep(s: SignInLike): SignInStep {
  switch (s.status) {
    case 'complete':
      return 'done';
    case 'needs_first_factor':
      return emailCodeFactor(s.supportedFirstFactors) ? 'email-code' : 'unsupported';
    case 'needs_second_factor':
    case 'needs_client_trust':
      return secondFactor(s.supportedSecondFactors) ? 'second-factor' : 'unsupported';
    default:
      return 'unsupported';
  }
}

export function emailCodeFactor(factors: FactorLike[] | null | undefined): FactorLike | null {
  return factors?.find((f) => f.strategy === 'email_code' && !!f.emailAddressId) ?? null;
}

/** The second factor the phone can complete: an emailed code first, then an authenticator app. */
export function secondFactor(factors: FactorLike[] | null | undefined): FactorLike | null {
  return (
    factors?.find((f) => f.strategy === 'email_code' && !!f.emailAddressId) ??
    factors?.find((f) => f.strategy === 'totp') ??
    factors?.find((f) => f.strategy === 'phone_code') ??
    null
  );
}

/** Clerk's own message for a failed step, or a plain fallback. Never a raw code. */
export function clerkMessage(err: unknown, fallback: string): string {
  const errors = (err as { errors?: { longMessage?: string; message?: string }[] } | null)?.errors;
  const first = Array.isArray(errors) ? errors[0] : undefined;
  return first?.longMessage || first?.message || fallback;
}
