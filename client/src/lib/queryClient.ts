import { QueryClient } from '@tanstack/react-query';

import { ApiError } from './apiError.js';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60_000,
      gcTime: 30 * 60_000,

      /**
       * Switching tabs must not re-run an analysis.
       *
       * The default here refetches on window focus, which for most apps is a
       * nicety and for this one would silently spend another round of
       * free-tier tokens every time someone alt-tabs away to read something.
       */
      refetchOnWindowFocus: false,

      // Only failures the server said were transient. Retrying a 400 just
      // sends the same bad request three times.
      retry: (count, error) => error instanceof ApiError && error.retryable && count < 2,
      retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 8000) + Math.random() * 300,
    },
    mutations: {
      retry: false,
    },
  },
});

/**
 * Query keys in one place.
 *
 * Inline key arrays scattered through components are how invalidation quietly
 * stops working: one component writes `['analysis', id]` and another
 * `['analyses', id]`, and nothing complains.
 */
export const keys = {
  analysis: {
    all: ['analysis'] as const,
    byHash: (hash: string) => ['analysis', hash] as const,
  },
  health: {
    providers: ['health', 'providers'] as const,
  },
} as const;
