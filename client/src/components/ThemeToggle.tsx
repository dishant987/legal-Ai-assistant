import { Monitor, Moon, Sun } from 'lucide-react';

import { useTheme, themes, type Theme } from '../hooks/useTheme.js';
import { cn } from '../lib/cn.js';

const ICONS: Record<Theme, typeof Sun> = { light: Sun, dark: Moon, system: Monitor };
const LABELS: Record<Theme, string> = {
  light: 'Light theme',
  dark: 'Dark theme',
  system: 'Follow system theme',
};

/**
 * Three-state theme switch.
 *
 * A radiogroup rather than a toggle button, because "follow my system" is a
 * real third choice and cycling through it blindly is worse than showing all
 * three. `aria-checked` tells a screen reader which is active; the icons alone
 * would not.
 */
export function ThemeToggle(): React.JSX.Element {
  const { theme, setTheme } = useTheme();

  return (
    <div
      role="radiogroup"
      aria-label="Colour theme"
      className="flex gap-0.5 rounded-[var(--radius)] border border-border bg-surface p-0.5"
    >
      {themes.map((option) => {
        const Icon = ICONS[option];
        const active = theme === option;

        return (
          <button
            key={option}
            type="button"
            role="radio"
            aria-checked={active}
            aria-label={LABELS[option]}
            onClick={() => {
              setTheme(option);
            }}
            className={cn(
              'rounded-[calc(var(--radius)-3px)] p-1.5 transition-colors',
              active ? 'bg-accent-sunk text-accent' : 'text-muted hover:text-text',
            )}
          >
            <Icon size={15} aria-hidden="true" />
          </button>
        );
      })}
    </div>
  );
}
