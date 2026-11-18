/* The widget's persona at rest (system.md N29): the Myte's name and doodle seed, and nothing else,
   in expo-secure-store (Android Keystore), so the headless widget task can redraw the face after a
   reboot or a launcher restart with no network call and no Clerk token. Never throws: a read that
   fails is "no persona" (the generic face), a write or clear that fails is dropped. */

import * as SecureStore from 'expo-secure-store';
import { parsePersona, serializePersona, type WidgetPersona } from './persona';

export const PERSONA_STORE_KEY = 'mytheus.widget-persona';

export async function readPersona(): Promise<WidgetPersona | null> {
  try {
    return parsePersona(await SecureStore.getItemAsync(PERSONA_STORE_KEY));
  } catch {
    return null;
  }
}

export async function writePersona(persona: WidgetPersona): Promise<void> {
  try {
    await SecureStore.setItemAsync(PERSONA_STORE_KEY, serializePersona(persona));
  } catch {
    // The widget keeps what it last drew; the next sign-in writes again.
  }
}

export async function clearPersona(): Promise<void> {
  try {
    await SecureStore.deleteItemAsync(PERSONA_STORE_KEY);
  } catch {
    // Nothing more to do: the widget is redrawn generic by the caller either way.
  }
}
