import { useEffect, useState } from 'react';

// Tracks the app's `.dark` class so canvas/SVG layers (recharts) can pick
// readable colors in both themes. Lightweight + SSR-safe enough for Vite SPA.
export function useDark(): boolean {
  const [dark, setDark] = useState<boolean>(() =>
    typeof document !== 'undefined' && document.documentElement.classList.contains('dark'),
  );
  useEffect(() => {
    const sync = () => setDark(document.documentElement.classList.contains('dark'));
    const ob = new MutationObserver(sync);
    ob.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    return () => ob.disconnect();
  }, []);
  return dark;
}

// Shared monochrome chart tokens per theme.
export function chartTheme(dark: boolean) {
  return {
    fg: dark ? '#FAFAFA' : '#18181B',
    muted: dark ? '#A1A1AA' : '#71717A',
    grid: dark ? '#27272A' : '#E4E4E7',
    ramp: dark
      ? ['#FAFAFA', '#D4D4D8', '#A1A1AA', '#71717A', '#52525B', '#3F3F46']
      : ['#09090B', '#3F3F46', '#71717A', '#A1A1AA', '#D4D4D8', '#E4E4E7'],
    tooltip: {
      backgroundColor: dark ? '#09090B' : '#FFFFFF',
      borderColor: dark ? '#3F3F46' : '#E4E4E7',
      borderRadius: 12,
      fontSize: 12,
      color: dark ? '#FAFAFA' : '#09090B',
    } as const,
  };
}
