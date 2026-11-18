import React from 'react';
import { FlexWidget, SvgWidget, TextWidget } from 'react-native-android-widget';
import { WIDGET_FACE_DP, widgetDoodleSvg } from './doodle-svg';
import { WIDGET_PROMPT, WIDGET_URI, type WidgetPersona } from './persona';

/* The home-screen card (system.md N29): the Myte's face, its name and a fixed prompt, on a paper
   tile. It never shows content (no decisions, tasks, counts or titles) and never fetches; a tap
   only opens the app at /myte/brief, where the Myte speaks.

   The widget is drawn by the launcher, outside the app's theme, so these are the card's own
   illustration colours (mytheus-ui's paper and the doodle ink), like the doodle's tile: the same
   in light and dark. */

const PAPER = '#F0EEE6';
const INK = '#2a2620';

export function MyteWidget({ persona }: { persona: WidgetPersona }) {
  return (
    <FlexWidget
      clickAction="OPEN_URI"
      clickActionData={{ uri: WIDGET_URI }}
      accessibilityLabel={`${persona.name}. ${WIDGET_PROMPT}`}
      style={{
        height: 'match_parent',
        width: 'match_parent',
        backgroundColor: PAPER,
        borderRadius: 16,
        padding: 12,
        flexDirection: 'row',
        alignItems: 'center',
        flexGap: 12,
      }}
    >
      <SvgWidget svg={widgetDoodleSvg(persona.seed)} style={{ height: WIDGET_FACE_DP, width: WIDGET_FACE_DP }} />
      <FlexWidget style={{ flex: 1, flexDirection: 'column', flexGap: 4 }}>
        <TextWidget text={persona.name} maxLines={1} truncate="END" style={{ fontSize: 16, fontWeight: 'bold', color: INK }} />
        <TextWidget text={WIDGET_PROMPT} maxLines={3} truncate="END" style={{ fontSize: 13, color: INK }} />
      </FlexWidget>
    </FlexWidget>
  );
}
