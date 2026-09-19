import { Scale } from 'lucide-react';
import type { ReactNode } from 'react';

import { ThemeToggle } from './ThemeToggle.js';

/**
 * The frame every page sits in.
 *
 * Real landmarks, a skip link, and one `<h1>` per page (R11.1, R11.2). The
 * disclaimer lives here rather than on a page so it cannot be navigated away
 * from — the brief is explicit that this gives information, not advice, and a
 * notice you can lose by clicking is not much of a notice.
 */
export function AppShell({ children }: { children: ReactNode }): React.JSX.Element {
  return (
    <>
      <a
        href="#main"
        className="sr-only rounded-[var(--radius)] bg-accent px-4 py-2 text-[var(--surface)] focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50"
      >
        Skip to content
      </a>

      <header className="border-b border-border bg-surface">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-6 py-3">
          <span className="flex items-center gap-2 font-serif text-lg font-semibold">
            <Scale size={18} className="text-accent" aria-hidden="true" />
            Legal AI Assistant
          </span>
          <ThemeToggle />
        </div>
      </header>

      <main id="main" className="mx-auto max-w-6xl px-6 py-8">
        {children}
      </main>

      <footer className="mt-auto border-t border-border bg-surface-sunk">
        <p className="mx-auto max-w-6xl px-6 py-4 text-sm text-muted">
          <strong className="font-semibold text-text">This gives information, not legal advice.</strong> It
          does not replace a qualified legal professional. Free legal aid in India is available through{' '}
          <a href="https://nalsa.gov.in" className="text-accent underline underline-offset-2">
            NALSA
          </a>{' '}
          on <span className="font-mono">15100</span>.
        </p>
      </footer>
    </>
  );
}
