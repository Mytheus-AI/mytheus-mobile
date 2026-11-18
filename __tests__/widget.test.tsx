import { resetMocks } from './helpers/mocks';
import React from 'react';
import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import { waitFor } from '@testing-library/react-native';
import { FlexWidget, SvgWidget, TextWidget, registerWidgetTaskHandler, requestWidgetUpdate } from 'react-native-android-widget';
import type { WidgetTaskHandlerProps } from 'react-native-android-widget';
import { fakeApi, renderWithApi } from './helpers/render';
import { agentDisplayName } from '@/lib/ask-myte/persona';
import { agentSeed } from '@/lib/briefing';
import { doodleSvgString } from '@/lib/doodle';
import {
  GENERIC_PERSONA,
  WIDGET_NAME,
  WIDGET_PROMPT,
  WIDGET_URI,
  parsePersona,
  serializePersona,
  widgetPersona,
  type WidgetPersona,
} from '@/widget/persona';
import { widgetDoodleSvg } from '@/widget/doodle-svg';
import { MyteWidget } from '@/widget/MyteWidget';
import { PERSONA_STORE_KEY } from '@/widget/store';
import { widgetTaskHandler } from '@/widget/task-handler';
import { MyteWidgetSync } from '@/widget/sync';

/* The Android home-screen widget (system.md N29): the Myte's face, its name and a fixed prompt,
   nothing else, rendered or stored. A tap opens mytheus://myte/brief. The native library never
   runs under Jest; it is replaced here (and only here). */

jest.mock('react-native-android-widget', () => ({
  FlexWidget: jest.fn(() => null),
  TextWidget: jest.fn(() => null),
  SvgWidget: jest.fn(() => null),
  requestWidgetUpdate: jest.fn(async () => undefined),
  registerWidgetTaskHandler: jest.fn(),
}));

const getItem = SecureStore.getItemAsync as jest.Mock;
const setItem = SecureStore.setItemAsync as jest.Mock;
const deleteItem = SecureStore.deleteItemAsync as jest.Mock;
const update = requestWidgetUpdate as jest.Mock;
const register = registerWidgetTaskHandler as jest.Mock;

const PIP: WidgetPersona = { name: 'Pip', seed: 'abcd2345' };

function onAndroid() {
  jest.replaceProperty(Platform, 'OS', 'android');
}

type El = React.ReactElement<Record<string, unknown>>;

/** Every element in the widget tree (the widget primitives are plain components, so the tree is
    the JSX itself). */
function walk(el: El): El[] {
  const kids = React.Children.toArray(el.props.children as React.ReactNode).filter(React.isValidElement) as El[];
  return [el, ...kids.flatMap(walk)];
}

function tree(persona: WidgetPersona): El[] {
  return walk(MyteWidget({ persona }) as El);
}

beforeEach(() => {
  resetMocks();
  getItem.mockReset().mockImplementation(async () => null);
  setItem.mockClear();
  deleteItem.mockClear();
  update.mockClear();
  register.mockClear();
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe('the persona', () => {
  it('round-trips through its stored form, carrying only name and seed', () => {
    expect(parsePersona(serializePersona(PIP))).toEqual(PIP);
    const leaky = { ...PIP, tasks: ['Ship it'] } as WidgetPersona;
    expect(JSON.parse(serializePersona(leaky))).toEqual({ name: 'Pip', seed: 'abcd2345' });
  });

  it('rejects anything malformed', () => {
    for (const raw of [null, undefined, '', 'not json', '[]', 'null', '42', '{"name":"Pip"}', '{"seed":"abcd2345"}',
      '{"name":"","seed":"abcd2345"}', '{"name":"Pip","seed":"NOT A SEED"}', '{"name":7,"seed":"abcd2345"}',
      JSON.stringify({ name: 'x'.repeat(81), seed: 'abcd2345' })]) {
      expect(parsePersona(raw)).toBeNull();
    }
  });

  it('is generic with nothing to go on', () => {
    expect(GENERIC_PERSONA).toEqual({ name: 'Your Myte', seed: agentSeed(null, '') });
    expect(widgetPersona(null, null)).toEqual(GENERIC_PERSONA);
  });

  it('names and draws the Myte exactly as the rest of the app does', () => {
    const me = { agent_name: null, agent_avatar_seed: null, display_name: 'Maya Rao' };
    const clerk = { id: 'clerk_me', firstName: 'Sam' };
    expect(widgetPersona(me, clerk)).toEqual({ name: agentDisplayName(null, 'Maya Rao'), seed: agentSeed(null, 'clerk_me') });
    expect(widgetPersona(me, clerk).name).toBe("Maya's Myte");
    expect(widgetPersona({ agent_name: ' Pip ', agent_avatar_seed: 'abcd2345', display_name: 'Maya Rao' }, clerk)).toEqual(PIP);
    expect(widgetPersona(me, clerk).seed).not.toBe(widgetPersona(me, { id: 'clerk_other', firstName: 'Sam' }).seed);
  });

  it('falls back to the Clerk first name when identity has no display name, as Home does', () => {
    const me = { agent_name: null, agent_avatar_seed: null, display_name: null };
    expect(widgetPersona(me, { id: 'clerk_me', firstName: 'Sam' }).name).toBe("Sam's Myte");
    expect(widgetPersona(me, { id: 'clerk_me', firstName: 'Sam' }).name).toBe(agentDisplayName(null, 'Sam'));
    expect(widgetPersona(me, { id: 'clerk_me', firstName: null }).name).toBe('Your Myte');
  });
});

describe('the face', () => {
  it('is an SVG document, the same per seed, and the app’s own drawing', () => {
    const svg = widgetDoodleSvg(PIP.seed);
    expect(svg.startsWith('<svg')).toBe(true);
    expect(widgetDoodleSvg(PIP.seed)).toBe(svg);
    expect(widgetDoodleSvg('zzzz2345')).not.toBe(svg);
    expect(svg).toBe(doodleSvgString(PIP.seed, 64));
  });
});

describe('the widget tree', () => {
  it('opens the talk screen on tap', () => {
    const [root] = tree(PIP);
    expect(root.type).toBe(FlexWidget);
    expect(root.props.clickAction).toBe('OPEN_URI');
    expect(root.props.clickActionData).toEqual({ uri: 'mytheus://myte/brief' });
    expect(WIDGET_URI).toBe('mytheus://myte/brief');
  });

  it('says nothing but the name and the prompt, and draws the face', () => {
    const els = tree(PIP);
    const types = new Set(els.map((e) => e.type));
    expect([...types].every((t) => t === FlexWidget || t === TextWidget || t === SvgWidget)).toBe(true);
    expect(els.filter((e) => e.type === TextWidget).map((e) => e.props.text)).toEqual(['Pip', WIDGET_PROMPT]);
    expect(els[0].props.accessibilityLabel).toBe(`Pip. ${WIDGET_PROMPT}`);
    const svgs = els.filter((e) => e.type === SvgWidget);
    expect(svgs).toHaveLength(1);
    expect(svgs[0].props.svg).toBe(widgetDoodleSvg(PIP.seed));
  });
});

describe('the headless task', () => {
  const info = { widgetName: WIDGET_NAME, widgetId: 7, width: 250, height: 110, screenInfo: { screenHeightDp: 800, screenWidthDp: 400, density: 2, densityDpi: 320, fontScale: 1 } };

  function run(widgetAction: WidgetTaskHandlerProps['widgetAction']) {
    const renderWidget = jest.fn();
    return widgetTaskHandler({ widgetInfo: info, widgetAction, renderWidget }).then(() => renderWidget);
  }

  it.each(['WIDGET_ADDED', 'WIDGET_UPDATE', 'WIDGET_RESIZED'] as const)('%s draws the stored persona', async (action) => {
    getItem.mockImplementation(async () => serializePersona(PIP));
    const renderWidget = await run(action);
    expect(getItem).toHaveBeenCalledWith(PERSONA_STORE_KEY);
    expect(renderWidget).toHaveBeenCalledTimes(1);
    expect((renderWidget.mock.calls[0][0] as El).props.persona).toEqual(PIP);
  });

  it.each(['WIDGET_ADDED', 'WIDGET_UPDATE', 'WIDGET_RESIZED'] as const)('%s draws the generic persona with nothing stored, or a failed read', async (action) => {
    let renderWidget = await run(action);
    expect((renderWidget.mock.calls[0][0] as El).props.persona).toEqual(GENERIC_PERSONA);
    getItem.mockImplementation(async () => {
      throw new Error('keystore');
    });
    renderWidget = await run(action);
    expect((renderWidget.mock.calls[0][0] as El).props.persona).toEqual(GENERIC_PERSONA);
  });

  it('does nothing when a widget is removed or tapped', async () => {
    expect(await run('WIDGET_DELETED')).not.toHaveBeenCalled();
    expect(await run('WIDGET_CLICK')).not.toHaveBeenCalled();
    expect(getItem).not.toHaveBeenCalled();
  });

  it('is registered on Android only', () => {
    /* Each run loads the entry's side effect afresh; the fresh registry has its own Platform and
       its own stand-in library. */
    const load = (os: 'ios' | 'android') => {
      let registered: jest.Mock | undefined;
      let handler: unknown;
      jest.isolateModules(() => {
        jest.replaceProperty(require('react-native').Platform, 'OS', os);
        registered = require('react-native-android-widget').registerWidgetTaskHandler;
        handler = require('@/widget/task-handler').widgetTaskHandler;
        require('@/widget/register');
      });
      return { registered: registered!, handler };
    };
    expect(load('ios').registered).not.toHaveBeenCalled();
    const android = load('android');
    expect(android.registered).toHaveBeenCalledTimes(1);
    expect(android.registered).toHaveBeenCalledWith(android.handler);
  });
});

describe('keeping the widget in step', () => {
  const ME = { id: 'u1', agent_name: 'Pip', agent_avatar_seed: 'abcd2345', display_name: 'Maya Rao' };

  it('does nothing off Android', async () => {
    const api = fakeApi({ 'GET /users/me': ME });
    const view = renderWithApi(<MyteWidgetSync />, api.client);
    await waitFor(() => expect(api.calls.map((c) => c.key)).toContain('GET /users/me'));
    view.unmount();
    await new Promise((r) => setTimeout(r, 0));
    expect(setItem).not.toHaveBeenCalled();
    expect(deleteItem).not.toHaveBeenCalled();
    expect(update).not.toHaveBeenCalled();
  });

  it('stores the persona and redraws on Android, then forgets it on unmount', async () => {
    onAndroid();
    const api = fakeApi({ 'GET /users/me': ME });
    const view = renderWithApi(<MyteWidgetSync />, api.client);
    await waitFor(() => expect(update).toHaveBeenCalledTimes(1));
    expect(setItem).toHaveBeenCalledWith(PERSONA_STORE_KEY, serializePersona(PIP));
    const first = update.mock.calls[0][0] as { widgetName: string; renderWidget: () => El; widgetNotFound: () => void };
    expect(first.widgetName).toBe(WIDGET_NAME);
    expect(first.renderWidget().props.persona).toEqual(PIP);
    expect(first.widgetNotFound()).toBeUndefined();
    expect(deleteItem).not.toHaveBeenCalled();

    view.unmount();
    await waitFor(() => expect(update).toHaveBeenCalledTimes(2));
    expect(deleteItem).toHaveBeenCalledWith(PERSONA_STORE_KEY);
    const second = update.mock.calls[1][0] as { renderWidget: () => El };
    expect(second.renderWidget().props.persona).toEqual(GENERIC_PERSONA);
  });
});
