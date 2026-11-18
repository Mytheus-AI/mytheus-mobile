/* The Android home-screen widget's one piece of data: who the Myte is (system.md N29).
   Pure: no React, no native modules, so the headless widget task and Jest load it freely.

   The widget is content-free on purpose. It shows the Myte's face, its name and a fixed prompt,
   and nothing else: no decisions, tasks, counts or meeting titles, rendered or stored. A home
   screen is visible to anyone holding the phone, and content there would either be stale or need
   a Clerk token in a background task. */

import { agentDisplayName } from '@/lib/ask-myte/persona';
import { agentSeed } from '@/lib/briefing';
import { isDoodleSeed } from '@/lib/doodle';

/** The widget's name in app.json (`react-native-android-widget` plugin) and in every update. */
export const WIDGET_NAME = 'MyteWidget';

/** Where a tap goes: Expo Router path `/myte/brief`, where the Myte talks you through it. */
export const WIDGET_URI = 'mytheus://myte/brief';

export const WIDGET_PROMPT = "Tap and I'll talk you through your decisions and tasks.";

export type WidgetPersona = { name: string; seed: string };

/** Fresh install, signed out, or nothing readable: still a face, a name and the prompt. */
export const GENERIC_PERSONA: WidgetPersona = { name: 'Your Myte', seed: agentSeed(null, '') };

/** The fields of `GET /users/me` the persona is built from. */
export type PersonaSource = {
  agent_name?: string | null;
  agent_avatar_seed?: string | null;
  display_name?: string | null;
};

/** The Clerk user's fields the persona falls back to, as Home and the talk screen use them. */
export type ClerkPersonaSource = { id?: string | null; firstName?: string | null };

/** The same name and face the app draws elsewhere (Home's "Talk me through it" card, the talk
    screen, the briefing's doodle): identity's `display_name`, else the Clerk first name. */
export function widgetPersona(me: PersonaSource | null | undefined, clerk: ClerkPersonaSource | null | undefined): WidgetPersona {
  return {
    name: agentDisplayName(me?.agent_name ?? null, me?.display_name ?? clerk?.firstName ?? ''),
    seed: agentSeed(me?.agent_avatar_seed ?? null, clerk?.id ?? ''),
  };
}

const MAX_NAME = 80;

/** The stored JSON back to a persona; anything malformed is null (the caller draws the generic one). */
export function parsePersona(raw: string | null | undefined): WidgetPersona | null {
  if (!raw) return null;
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const { name, seed } = value as Record<string, unknown>;
  if (typeof name !== 'string' || !name.trim() || name.length > MAX_NAME) return null;
  if (!isDoodleSeed(seed)) return null;
  return { name: name.trim(), seed };
}

/** Only the two fields, so nothing else can ride along into storage. */
export function serializePersona(persona: WidgetPersona): string {
  return JSON.stringify({ name: persona.name, seed: persona.seed });
}

export function samePersona(a: WidgetPersona | null, b: WidgetPersona | null): boolean {
  return !!a && !!b && a.name === b.name && a.seed === b.seed;
}
