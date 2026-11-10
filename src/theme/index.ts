import { useMemo } from 'react';
import { useColorScheme } from 'react-native';
import { dark, light, type Palette } from './tokens';

export * from './tokens';
export * from './typography';

/** The palette for the device's appearance. The app follows the system theme, like the OS does. */
export function useTheme(): Palette {
  return useColorScheme() === 'dark' ? dark : light;
}

export function useIsDark(): boolean {
  return useColorScheme() === 'dark';
}

/** Styles built from the current palette, rebuilt only when the theme flips. */
export function useStyles<T>(factory: (p: Palette) => T): T {
  const p = useTheme();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  return useMemo(() => factory(p), [p]);
}
