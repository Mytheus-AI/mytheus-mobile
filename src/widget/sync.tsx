import React, { useEffect } from 'react';
import { Platform } from 'react-native';
import { useUser } from '@clerk/expo';
import { useMe } from '@/api/hooks/identity';
import { GENERIC_PERSONA, WIDGET_NAME, widgetPersona, type WidgetPersona } from './persona';
import { clearPersona, writePersona } from './store';

/* Keeps the home-screen widget's persona in step with the signed-in person (system.md N29).
   Mounted once inside the signed-in workspace shell (app/(app)/_layout.tsx, under ApiProvider).

   The app pushes every change (the widget has no periodic update): when the Myte's name or face
   changes, store it and redraw every placed widget; when the shell unmounts (sign-out, or leaving
   the workspace), forget it and redraw the generic face. Only the name and seed ever leave memory.

   Android only. The native library and the widget tree are loaded lazily behind the platform
   check, so iOS and Jest (which runs as iOS) never evaluate them. */

const noop = () => undefined;

/** Writes, clears and redraws run one after another, so an unmount's clear never lands before
    the write it follows. */
let queue: Promise<void> = Promise.resolve();

function enqueue(step: () => Promise<void>): void {
  queue = queue.then(step).catch(noop);
}

/* A lazy `require`, not `import()`: Metro would accept either, but Jest's CommonJS runtime cannot
   run a dynamic `import()` (no --experimental-vm-modules), and the Android path is tested. */
function loadWidget(): { requestWidgetUpdate: WidgetLib['requestWidgetUpdate']; MyteWidget: WidgetView['MyteWidget'] } {
  /* eslint-disable @typescript-eslint/no-require-imports */
  const { requestWidgetUpdate } = require('react-native-android-widget') as WidgetLib;
  const { MyteWidget } = require('./MyteWidget') as WidgetView;
  /* eslint-enable @typescript-eslint/no-require-imports */
  return { requestWidgetUpdate, MyteWidget };
}

type WidgetLib = typeof import('react-native-android-widget');
type WidgetView = typeof import('./MyteWidget');

async function redraw(persona: WidgetPersona): Promise<void> {
  const { requestWidgetUpdate, MyteWidget } = loadWidget();
  await requestWidgetUpdate({
    widgetName: WIDGET_NAME,
    renderWidget: () => <MyteWidget persona={persona} />,
    widgetNotFound: noop,
  });
}

export function MyteWidgetSync(): null {
  const me = useMe();
  const { user } = useUser();
  const persona = me.data ? widgetPersona(me.data, user) : null;
  const name = persona?.name ?? null;
  const seed = persona?.seed ?? null;

  useEffect(() => {
    if (Platform.OS !== 'android' || name === null || seed === null) return;
    const next = { name, seed };
    enqueue(async () => {
      await writePersona(next);
      await redraw(next);
    });
  }, [name, seed]);

  useEffect(() => {
    if (Platform.OS !== 'android') return;
    return () => {
      enqueue(async () => {
        await clearPersona();
        await redraw(GENERIC_PERSONA);
      });
    };
  }, []);

  return null;
}
