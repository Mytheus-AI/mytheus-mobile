import React from 'react';
import type { WidgetTaskHandlerProps } from 'react-native-android-widget';
import { MyteWidget } from './MyteWidget';
import { GENERIC_PERSONA } from './persona';
import { readPersona } from './store';

/* The headless task Android runs for the widget (system.md N29), with no app UI, no Clerk session
   and no network: it draws from the stored persona alone, else the generic one. Deliberately no
   Clerk, React Query, LiveKit or REST import here. */

export async function widgetTaskHandler({ widgetAction, renderWidget }: WidgetTaskHandlerProps): Promise<void> {
  switch (widgetAction) {
    case 'WIDGET_ADDED':
    case 'WIDGET_UPDATE':
    case 'WIDGET_RESIZED': {
      const persona = (await readPersona()) ?? GENERIC_PERSONA;
      renderWidget(<MyteWidget persona={persona} />);
      return;
    }
    case 'WIDGET_DELETED':
    case 'WIDGET_CLICK':
      // Nothing is kept per widget, and the tap is OPEN_URI, which Android handles without JS.
      return;
  }
}
