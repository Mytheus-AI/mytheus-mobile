/**
 * Font family helpers. Names map to the @expo-google-fonts packages
 * loaded in app/_layout.tsx.
 *
 * - Hanken Grotesk: UI / sans (weights 400-800)
 * - Newsreader: serif display headings (weights 400-700)
 * - Fraunces: the wordmark face - warm, soft, matches the squiggle;
 *   reserved for the brand name, not general headings
 */
export type SansWeight = '400' | '500' | '600' | '700' | '800';
export type SerifWeight = '400' | '500' | '600' | '700';

const SANS: Record<SansWeight, string> = {
  '400': 'HankenGrotesk_400Regular',
  '500': 'HankenGrotesk_500Medium',
  '600': 'HankenGrotesk_600SemiBold',
  '700': 'HankenGrotesk_700Bold',
  '800': 'HankenGrotesk_800ExtraBold',
};

const SERIF: Record<SerifWeight, string> = {
  '400': 'Newsreader_400Regular',
  '500': 'Newsreader_500Medium',
  '600': 'Newsreader_600SemiBold',
  '700': 'Newsreader_700Bold',
};

export const sans = (weight: SansWeight = '400') => SANS[weight];
export const serif = (weight: SerifWeight = '600') => SERIF[weight];

/** The Mytheus wordmark face. */
export const wordmark = () => 'Fraunces_600SemiBold';
