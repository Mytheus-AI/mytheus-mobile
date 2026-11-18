/* The Myte's doodle face as an SVG document for the widget's SvgWidget (rendered natively by
   androidsvg, where react-native-svg cannot run). Pure.

   It is `doodleSvgString` from src/lib/doodle.ts: built from `doodleSpec`/`drawDoodle` exactly as
   src/components/Doodle.tsx draws it (the circle clip, the tile, the body, then the back hair and
   the head under the seed's tilt about (32, 40)), so the widget wears the same face as the app
   and the web. No second copy of the drawing to keep in step. */

import { doodleSvgString } from '@/lib/doodle';

/** The face's side on the widget, in dp. */
export const WIDGET_FACE_DP = 64;

export function widgetDoodleSvg(seed: string, size: number = WIDGET_FACE_DP): string {
  return doodleSvgString(seed, size);
}
