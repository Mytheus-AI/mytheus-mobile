import { useEffect } from 'react';
import { useRouter } from 'expo-router';
import * as Notifications from 'expo-notifications';
import { useApi } from '@/api/ApiProvider';
import { pushRoute } from '@/lib/push-links';
import { configureForegroundPush, registerForPush } from './push';

/**
 * Inside the signed-in workspace: register this phone for push once per person and workspace,
 * and open the right screen when a notification is tapped (including the tap that launched the
 * app). Every failure is quiet: push is a convenience, the Inbox is the authority.
 */
export function usePushRegistration(scope: string): void {
  const api = useApi();
  const router = useRouter();

  useEffect(() => {
    configureForegroundPush();
    void registerForPush(api, scope);
  }, [api, scope]);

  useEffect(() => {
    let handled: string | null = null;
    const open = (response: Notifications.NotificationResponse | null) => {
      if (!response) return;
      const id = response.notification.request.identifier;
      if (handled === id) return;
      handled = id;
      router.push(pushRoute(response.notification.request.content.data) as never);
    };
    void Notifications.getLastNotificationResponseAsync()
      .then(open)
      .catch(() => undefined);
    const sub = Notifications.addNotificationResponseReceivedListener(open);
    return () => sub.remove();
  }, [router]);
}
