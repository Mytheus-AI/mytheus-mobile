/**
 * Small pure helpers for the meeting room on the phone.
 */

import type { CallLink } from '@/realtime/connection';

/** What a failed join says, by the server's stable code. */
export function joinErrorText(code: string | null): { title: string; body: string } {
  switch (code) {
    case 'NOT_A_PARTICIPANT':
      return { title: 'You are not on this meeting', body: 'Ask the host to add you, then try again.' };
    case 'NOT_FOUND':
      return { title: 'This meeting is not available', body: 'It may have been removed, or the link is wrong.' };
    case 'EXTERNAL_MEETING':
      return { title: 'This meeting runs in another app', body: 'Join it in Zoom, Google Meet or Teams. Mytheus follows along there.' };
    case 'VERSION_CONFLICT':
      return { title: 'This meeting has ended', body: 'You can read what was decided on the meeting page.' };
    case 'AUTH_REQUIRED':
      return { title: 'Your session expired', body: 'Sign in again to join.' };
    default:
      return { title: 'The call could not connect', body: 'Check your connection and try again.' };
  }
}

/** A call that is up (or getting there) after the first connect. */
export function inCall(status: CallLink): boolean {
  return status === 'connected' || status === 'reconnecting';
}

/** "Speaker 2" for an unmapped diarization label ("1"), the person's name once it is mapped. */
export function speakerLabel(speakerId: string, names: ReadonlyMap<string, string>): string {
  const named = names.get(speakerId);
  if (named) return named;
  const n = Number(speakerId);
  return Number.isFinite(n) ? `Speaker ${n + 1}` : 'Speaker';
}
