import { Component, type ErrorInfo, type ReactNode } from 'react';

import { ApiError, FALLBACKS } from '../lib/apiError.js';

interface Props {
  children: ReactNode;
}

interface State {
  error: Error | undefined;
}

/**
 * The last line before a white screen.
 *
 * A render that throws must still leave the reader with a sentence they can
 * understand, a way to try again, and a reference code — not an empty page
 * with the work they were doing gone from view (R4.10).
 */
export class ErrorBoundary extends Component<Props, State> {
  override state: State = { error: undefined };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  override componentDidCatch(error: Error, info: ErrorInfo): void {
    // The browser console is the only place a client-side crash can be
    // reported from, and losing it would make render failures invisible.
    // eslint-disable-next-line no-console
    console.error('Render failed', error, info.componentStack);
  }

  override render(): ReactNode {
    const { error } = this.state;
    if (error === undefined) return this.props.children;

    const isApi = error instanceof ApiError;

    return (
      <div role="alert" className="mx-auto max-w-lg p-8">
        <h1 className="mb-3 text-2xl">Something went wrong</h1>

        <p className="mb-6 text-muted">{isApi ? error.message : FALLBACKS.INTERNAL}</p>

        <button
          type="button"
          onClick={() => {
            this.setState({ error: undefined });
          }}
          className="rounded-[var(--radius)] bg-accent px-4 py-2 text-[var(--surface)] transition-colors hover:opacity-90"
        >
          Try again
        </button>

        {isApi && error.requestId !== undefined && (
          <p className="mt-6 font-mono text-xs text-muted">
            Reference: <span className="select-all">{error.requestId}</span>
          </p>
        )}
      </div>
    );
  }
}
