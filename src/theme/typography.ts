/**
 * Font families, loaded in `app/_layout.tsx`. Hanken Grotesk for everything; Newsreader for
 * display titles and the quiet italic voice (captions, "what your agent keeps"); Fraunces only for
 * the wordmark. Same faces as mytheus-ui.
 */
export type SansWeight = '400' | '500' | '600' | '700';
export type SerifWeight = '400' | '500' | '600';

const SANS: Record<SansWeight, string> = {
  '400': 'HankenGrotesk_400Regular',
  '500': 'HankenGrotesk_500Medium',
  '600': 'HankenGrotesk_600SemiBold',
  '700': 'HankenGrotesk_700Bold',
};

const SERIF: Record<SerifWeight, string> = {
  '400': 'Newsreader_400Regular',
  '500': 'Newsreader_500Medium',
  '600': 'Newsreader_600SemiBold',
};

export const sans = (weight: SansWeight = '400') => SANS[weight];
export const serif = (weight: SerifWeight = '500') => SERIF[weight];
export const serifItalic = () => 'Newsreader_400Regular_Italic';
export const wordmark = () => 'Fraunces_600SemiBold';
