/* Side effect only, imported from the entry after Expo Router (src/observability/entry.ts): on
   Android, hand the widget's headless task to react-native-android-widget. It must be registered
   while the bundle loads, since Android may start the bundle for the widget alone (no app UI).
   iOS has no widget yet; the library is a no-op there, and nothing is registered. */

import { Platform } from 'react-native';
import { registerWidgetTaskHandler } from 'react-native-android-widget';
import { widgetTaskHandler } from './task-handler';

if (Platform.OS === 'android') {
  registerWidgetTaskHandler(widgetTaskHandler);
}
