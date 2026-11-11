/**
 * Phone push through Expo (notification-service `PUSH_PROVIDER=expo`).
 *
 * - `registerForPush(api, scope)`: after sign-in, inside the workspace. Asks for permission only if
 *   the person has not answered yet, gets this install's Expo push token and registers it for the
 *   signed-in person (`POST /notifications/push-devices`, idempotent). The returned device id is
 *   kept in expo-secure-store so sign-out removes exactly this registration.
 * - `unregisterPush(api)`: before Clerk sign-out and before switching workspace
 *   (`DELETE /notifications/push-devices/{id}`); best effort, a 404 means it is already gone.
 *
 * Quietly "not connected" (never a crash or a nag): on a simulator, without an EAS project id
 * (`expo.extra.eas.projectId`, needed for an Expo push token), when permission is denied, or when
 * the server sends no pushes (`push_configured: false`, shown in Settings). A push is a pointer,
 * never durable truth: the Inbox (`GET /notifications`) stays the authority.
 */

import { Platform } from 'react-native';
import Constants from 'expo-constants';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import * as SecureStore from 'expo-secure-store';
import type { ApiClient } from '@/api/client';
import { endpoints } from '@/api/endpoints';
import { parseStoredDevice } from '@/lib/push-links';

const STORE_KEY = 'mytheus.push-device';

export type PushSetup =
  | { state: 'registered'; deviceId: string; serverSends: boolean }
  | { state: 'unavailable'; reason: 'simulator' | 'no_project' | 'denied' | 'unsupported' | 'error' };

function projectId(): string | null {
  const extra = Constants.expoConfig?.extra as { eas?: { projectId?: unknown } } | undefined;
  const id = extra?.eas?.projectId ?? Constants.easConfig?.projectId;
  return typeof id === 'string' && id ? id : null;
}

let handlerSet = false;

/** Show a push that arrives while the app is open as a banner (the Inbox updates too). */
export function configureForegroundPush(): void {
  if (handlerSet) return;
  handlerSet = true;
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: false,
      shouldSetBadge: false,
    }),
  });
}

export async function registerForPush(api: ApiClient, scope: string): Promise<PushSetup> {
  if (Platform.OS !== 'ios' && Platform.OS !== 'android') return { state: 'unavailable', reason: 'unsupported' };
  if (!Device.isDevice) return { state: 'unavailable', reason: 'simulator' };
  const project = projectId();
  if (!project) return { state: 'unavailable', reason: 'no_project' };
  try {
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'Mytheus',
        importance: Notifications.AndroidImportance.DEFAULT,
      });
    }
    let perm = await Notifications.getPermissionsAsync();
    if (perm.status === 'undetermined' && perm.canAskAgain) {
      perm = await Notifications.requestPermissionsAsync();
    }
    if (perm.status !== 'granted') return { state: 'unavailable', reason: 'denied' };
    const { data: token } = await Notifications.getExpoPushTokenAsync({ projectId: project });
    const device = await endpoints.registerPushDevice(api, token, Platform.OS);
    await SecureStore.setItemAsync(STORE_KEY, JSON.stringify({ id: device.id, scope }));
    return { state: 'registered', deviceId: device.id, serverSends: device.push_configured };
  } catch {
    return { state: 'unavailable', reason: 'error' };
  }
}

/** Remove this phone's registration (sign-out, workspace switch). Never throws. */
export async function unregisterPush(api: ApiClient): Promise<void> {
  let stored = null;
  try {
    stored = parseStoredDevice(await SecureStore.getItemAsync(STORE_KEY));
  } catch {
    return;
  }
  if (!stored) return;
  try {
    await endpoints.unregisterPushDevice(api, stored.id);
  } catch {
    // 404: already gone (the token moved to someone else, or Expo reported it dead). Any other
    // failure leaves the row; the next person to sign in on this phone takes the token over.
  }
  try {
    await SecureStore.deleteItemAsync(STORE_KEY);
  } catch {
    // nothing to do
  }
}
