import { useQuery } from '@tanstack/react-query';

import { AppShell } from './components/AppShell.js';
import { api } from './lib/axios.js';
import { keys } from './lib/queryClient.js';

interface ProviderHealth {
  configured: string[];
  breakers: Record<string, { open: boolean; failures: number }>;
}

/**
 * Placeholder home page.
 *
 * The upload surface, document pane and findings list land in Step 8. For now
 * this proves the whole client chain end to end: the Axios instance, the
 * normalised errors, TanStack Query, and the theme — against the real API.
 */
export default function App(): React.JSX.Element {
  const { data, isPending, error } = useQuery({
    queryKey: keys.health.providers,
    queryFn: async () => (await api.get<ProviderHealth>('/health/providers')).data,
  });

  return (
    <AppShell>
      <h1 className="mb-2 text-3xl">Read your contract before you sign it</h1>
      <p className="mb-8 max-w-2xl text-muted">
        Every finding points at the exact words that caused it. Anything that can&rsquo;t be traced back to
        your document is struck through rather than quietly shown.
      </p>

      <section
        aria-labelledby="providers-heading"
        className="rounded-[var(--radius)] border border-border bg-surface p-5"
      >
        <h2 id="providers-heading" className="mb-3 text-lg">
          AI providers
        </h2>

        {isPending && (
          <p role="status" className="text-sm text-muted">
            Checking…
          </p>
        )}

        {error !== null && (
          <p role="alert" className="text-sm text-danger">
            {error.message}
          </p>
        )}

        {data !== undefined &&
          (data.configured.length === 0 ? (
            <p className="text-sm text-muted">
              No provider keys are set, so an analysis has nothing to call. Add at least one to{' '}
              <code className="font-mono text-xs">server/.env</code>.
            </p>
          ) : (
            <ul className="flex flex-wrap gap-2">
              {data.configured.map((provider) => (
                <li key={provider} className="rounded-full border border-border px-3 py-1 font-mono text-xs">
                  {provider}
                  {data.breakers[provider]?.open === true && <span className="ml-2 text-warn">paused</span>}
                </li>
              ))}
            </ul>
          ))}
      </section>
    </AppShell>
  );
}
