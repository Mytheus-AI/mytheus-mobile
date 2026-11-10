import { Platform, type ViewStyle } from 'react-native';

/**
 * The app's design tokens: the same values as mytheus-ui's app theme (`src/app/globals.css` for
 * light, `src/styles/app-theme.css` for dark) and the one-line design contract
 * (mytheus-ui `docs/DESIGN-ONELINE.md`). Never write a raw colour in a component; read the palette
 * from `useTheme()` so both themes stay right.
 */
export interface Palette {
  /** The page stage. */
  bg: string;
  /** Wells and tracks. */
  bg2: string;
  bg3: string;
  /** Cards. */
  surface: string;
  /** Raised on a card, list heads, pressed fills. */
  surface2: string;
  ink: string;
  /** Body text. */
  ink2: string;
  /** Secondary text. */
  ink3: string;
  /** Tertiary: large text and icons only. */
  ink4: string;
  line: string;
  line2: string;
  /** Accent fill and text. */
  signal: string;
  /** The drawn line. */
  signalLine: string;
  /** Text on a soft coral chip. */
  signalInk: string;
  signalSoft: string;
  /** Dark controls and their text. */
  pill: string;
  pill2: string;
  pillOn: string;
  /** Frozen priority language: red acts now, amber needs attention, blue informs. */
  high: string;
  highSoft: string;
  medium: string;
  mediumSoft: string;
  low: string;
  lowSoft: string;
  ok: string;
  okSoft: string;
  tintPeach: string;
  tintOchre: string;
  tintSage: string;
  tintSky: string;
  /** The peach wash, as gradient stops (Home hero only). */
  wash: readonly [string, string, ...string[]];
  /** The scrim behind sheets. */
  scrim: string;
  /** Shadow colour (warm in light, black in dark). */
  shadow: string;
}

export const light: Palette = {
  bg: '#f0eee6',
  bg2: '#e8e5da',
  bg3: '#ded9cb',
  surface: '#ffffff',
  surface2: '#faf9f4',
  ink: '#1f1e1d',
  ink2: '#3a352f',
  ink3: '#6b645b',
  ink4: '#8a8378',
  line: '#e6e2d6',
  line2: '#d6d1c2',
  signal: '#c15f3c',
  signalLine: '#d97757',
  signalInk: '#a8472a',
  signalSoft: '#f7e9e1',
  pill: '#262625',
  pill2: '#33312f',
  pillOn: '#faf9f4',
  high: '#b3402e',
  highSoft: '#f6e0da',
  medium: '#875d14',
  mediumSoft: '#f6ecd9',
  low: '#4f6f84',
  lowSoft: '#e6eef2',
  ok: '#3f6a37',
  okSoft: '#e4efe1',
  tintPeach: '#efcbb5',
  tintOchre: '#ecd9ae',
  tintSage: '#cfd8bf',
  tintSky: '#c7d8e1',
  wash: ['#eab9a0', '#efcbb5', '#f4dfd0', '#f8f1e7'],
  scrim: 'rgba(31, 30, 29, 0.38)',
  shadow: '#3c2d23',
};

export const dark: Palette = {
  bg: '#1a1816',
  bg2: '#302d2a',
  bg3: '#3d3935',
  surface: '#232120',
  surface2: '#2a2725',
  ink: '#f3f0e8',
  ink2: '#d9d4c8',
  ink3: '#a9a296',
  ink4: '#8a8378',
  line: '#38342f',
  line2: '#4c4741',
  signal: '#e0805f',
  signalLine: '#e0805f',
  signalInk: '#f0a285',
  signalSoft: '#3a2a23',
  pill: '#f3f0e8',
  pill2: '#e2ddd2',
  pillOn: '#1a1816',
  high: '#ee8a78',
  highSoft: '#3b221d',
  medium: '#e0b062',
  mediumSoft: '#382d18',
  low: '#8fb3c8',
  lowSoft: '#1f2d35',
  ok: '#9cbb8f',
  okSoft: '#232e20',
  tintPeach: '#4a3226',
  tintOchre: '#46391f',
  tintSage: '#313a2b',
  tintSky: '#263640',
  wash: ['#4a2e22', '#3a2820', '#2a2220', '#232120'],
  scrim: 'rgba(0, 0, 0, 0.55)',
  shadow: '#000000',
};

/** Controls 12, cards 20, stages and big panels 28, chips and avatars full. Nothing else. */
export const radii = { ctl: 12, card: 20, hero: 28, full: 999 } as const;

/** The six type sizes (polish plan, "One component kit"), plus the page title. */
export const size = {
  meta: 12.5,
  secondary: 14,
  body: 15,
  lead: 17,
  title: 22,
  display: 30,
} as const;

export const space = { gutter: 16, gap: 12, section: 24 } as const;

/** Minimum touch target (DESIGN-ONELINE: at least 40; platform guidance 44). */
export const TOUCH = 44;

type Shadow = Pick<ViewStyle, 'shadowColor' | 'shadowOffset' | 'shadowOpacity' | 'shadowRadius' | 'elevation'>;

/** The warm card shadow (`--sh-1`/`--sh-2`). Quiet in dark mode, where depth comes from surfaces. */
export function cardShadow(p: Palette, level: 1 | 2 = 1): Shadow {
  const isDark = p === dark;
  return Platform.select<Shadow>({
    ios: {
      shadowColor: p.shadow,
      shadowOffset: { width: 0, height: level === 1 ? 1 : 6 },
      shadowOpacity: isDark ? 0.3 : level === 1 ? 0.06 : 0.08,
      shadowRadius: level === 1 ? 2 : 14,
    },
    default: { elevation: level === 1 ? 1 : 3 },
  }) as Shadow;
}
