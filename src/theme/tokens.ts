import { Platform, ViewStyle } from 'react-native';

/**
 * Design tokens for the Reprise AI "Meeting Pod" flow.
 * Values are lifted verbatim from the Claude Design source
 * (Meeting Pod - Flow.dc.html) so the app matches the draft 1:1.
 */
export const colors = {
  // Surfaces
  bgOuter: '#DCD9CE',
  bgApp: '#F0EEE6',
  surface: '#FFFFFF',
  surfaceAlt: '#FAF9F4',
  navBorder: '#EAE7DE',
  tabTrack: '#E7E3D9',

  // Ink / text
  ink: '#1F1E1D',
  inkDeep: '#28221C',
  body: '#33302C',
  bodySoft: '#3A352F',

  // Muted greys
  muted: '#A8A096',
  mutedAlt: '#ABA398',
  mutedLabel: '#A39A8E',
  mutedIcon: '#BBAFA3',
  mutedDeep: '#998F84',
  mutedTime: '#8A847B',

  // Warm browns (peach context)
  warmText: '#8C6F5D',
  warmText2: '#6F5D54',
  warmText3: '#5A4A40',
  warmText4: '#7A6356',
  warmLabelOnPeach: '#A07D67',

  // Accents
  accent: '#D97757', // Reprise sparkle / primary accent
  accentDeep: '#C15F3C',
  green: '#5F7355',
  brown: '#9A7B4F',
  brownDot: '#B0875A',

  // Chips
  chipOrangeBg: '#F7E9E1',
  chipOrangeText: '#C15F3C',
  chipGreenBg: '#ECEFE5',
  chipGreenText: '#5F7355',
  chipBrownBg: '#F4ECDF',
  chipBrownText: '#9A7B4F',
  chipNeutralBg: '#F3EFE9',
  chipNeutralText: '#7A6F64',

  // Components
  dark: '#262625',
  avatarBg: '#E4DDD2',
  avatarText: '#8A7D70',
  checkboxBorder: '#D9D3C8',

  // Speaker avatars
  speakerP: '#C15F3C',
  speakerM: '#7A6A53',
  speakerD: '#B0875A',

  white: '#FFFFFF',
} as const;

export const gradients = {
  // 157deg, top-left -> bottom-right
  hero: {
    colors: ['#E6B398', '#EAC4AC', '#F0DBC9', '#F6EFE4'] as const,
    locations: [0, 0.27, 0.54, 1] as const,
    start: { x: 0.08, y: 0 },
    end: { x: 0.92, y: 1 },
  },
  overview: {
    colors: ['#EAC4AC', '#F0DBC9', '#F6EFE4'] as const,
    locations: [0, 0.45, 1] as const,
    start: { x: 0.08, y: 0 },
    end: { x: 0.92, y: 1 },
  },
} as const;

export const radii = {
  hero: 28,
  card: 22,
  tab: 14,
  button: 16,
  control: 22,
  iconBtn: 14,
  chip: 999,
  checkbox: 7,
} as const;

export const spacing = {
  screenX: 14,
  gutter: 18,
} as const;

type Shadow = Pick<
  ViewStyle,
  'shadowColor' | 'shadowOffset' | 'shadowOpacity' | 'shadowRadius' | 'elevation'
>;

const shadow = (
  color: string,
  opacity: number,
  radius: number,
  offsetY: number,
  elevation: number,
): Shadow =>
  Platform.select<Shadow>({
    ios: {
      shadowColor: color,
      shadowOffset: { width: 0, height: offsetY },
      shadowOpacity: opacity,
      shadowRadius: radius,
    },
    default: { elevation },
  }) as Shadow;

export const shadows = {
  card: shadow('#3C2D23', 0.08, 12, 6, 2),
  hero: shadow('#C18F6D', 0.3, 24, 14, 8),
  darkButton: shadow('#1E1C1A', 0.2, 14, 8, 5),
  control: shadow('#1E1C1A', 0.22, 18, 10, 6),
  iconBtn: shadow('#3C2D23', 0.08, 3, 1, 1),
} as const;
