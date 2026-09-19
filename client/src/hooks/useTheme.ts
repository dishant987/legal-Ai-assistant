import { useCallback, useEffect, useState } from 'react';

export const themes = ['light', 'dark', 'system'] as const;
export type Theme = (typeof themes)[number];

const STORAGE_KEY = 'legal-assist-theme';

function read(): Theme {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return themes.includes(stored as Theme) ? (stored as Theme) : 'system';
  } catch {
    // Private browsing, or storage blocked entirely. Following the system is a
    // perfectly good answer, so this is not worth surfacing.
    return 'system';
  }
}

/**
 * Apply a theme choice to the document.
 *
 * "system" removes the attribute rather than resolving it to a value, so the
 * CSS keeps tracking `prefers-color-scheme` live — resolving it here would
 * freeze the choice at page load and stop following the OS.
 */
function apply(theme: Theme): void {
  const root = document.documentElement;
  if (theme === 'system') root.removeAttribute('data-theme');
  else root.setAttribute('data-theme', theme);
}

/**
 * Three-state theme: light, dark, or follow the system.
 *
 * @returns The current choice and a setter that persists it.
 */
export function useTheme(): { theme: Theme; setTheme: (next: Theme) => void } {
  const [theme, setThemeState] = useState<Theme>(read);

  useEffect(() => {
    apply(theme);
  }, [theme]);

  const setTheme = useCallback((next: Theme) => {
    setThemeState(next);
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // The choice still applies for this session; it just will not be
      // remembered. Not worth an error message.
    }
  }, []);

  return { theme, setTheme };
}
