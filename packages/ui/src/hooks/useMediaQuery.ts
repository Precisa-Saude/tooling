import { useEffect, useState } from 'react';

/**
 * Subscribe to a CSS media query.
 *
 * SSR-safe — returns `false` on the server; syncs in the first effect on
 * the client. For responsive logic that must match SSR-rendered markup,
 * render twice (mount-stable classes first, hook-driven classes on hydration).
 */
export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    return window.matchMedia(query).matches;
  });

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const mql = window.matchMedia(query);
    const handler = (e: MediaQueryListEvent) => setMatches(e.matches);

    setMatches(mql.matches);
    mql.addEventListener('change', handler);
    return () => mql.removeEventListener('change', handler);
  }, [query]);

  return matches;
}
