import { useState } from 'react';

import { AppShell } from './components/AppShell.js';
import { DocumentPane } from './components/DocumentPane.js';
import { FindingList } from './components/FindingList.js';
import { ObligationsTable } from './components/ObligationsTable.js';
import { StatuteList } from './components/StatuteList.js';
import { UploadForm } from './components/UploadForm.js';
import { useAnalysis } from './hooks/useAnalysis.js';
import { cn } from './lib/cn.js';

type Tab = 'findings' | 'law' | 'obligations';

export default function App(): React.JSX.Element {
  const analysis = useAnalysis();
  const [active, setActive] = useState<number | undefined>();
  const [tab, setTab] = useState<Tab>('findings');

  const started = analysis.running || analysis.done !== undefined || analysis.error !== undefined;
  const span = active !== undefined ? analysis.findings[active] : undefined;

  const tabs: { id: Tab; label: string; count: number }[] = [
    { id: 'findings', label: 'Findings', count: analysis.findings.length },
    { id: 'law', label: 'The law', count: analysis.statutes.length },
    { id: 'obligations', label: 'Who owes what', count: analysis.obligations.length },
  ];

  return (
    <AppShell>
      {!started && (
        <>
          <h1 className="mb-2 text-3xl">Read your contract before you sign it</h1>
          <p className="mb-8 max-w-2xl text-muted">
            Every finding points at the exact words that caused it. Anything that can&rsquo;t be traced back
            to your document is struck through rather than quietly shown.
          </p>
          <div className="max-w-2xl">
            <UploadForm
              onAnalyse={(args) => {
                void analysis.analyse(args);
              }}
              running={analysis.running}
              onCancel={analysis.cancel}
            />
          </div>
        </>
      )}

      {started && (
        <>
          <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
            <h1 className="text-2xl">
              {analysis.docType !== '' ? analysis.docType.replace(/-/g, ' ') : 'Your document'}
            </h1>
            <button
              type="button"
              onClick={() => {
                analysis.reset();
                setActive(undefined);
              }}
              className="rounded-[var(--radius)] border border-border px-3 py-1.5 text-sm"
            >
              Read another
            </button>
          </div>

          {/* Counts, not tokens: announcing every streamed word would make a
              screen reader unusable while the analysis runs (R11.4). */}
          <p role="status" aria-live="polite" className="sr-only">
            {analysis.running
              ? `Reading. ${String(analysis.findings.length)} findings so far.`
              : analysis.done
                ? `Finished. ${String(analysis.done.verified)} findings verified, ${String(analysis.done.rejected)} struck out.`
                : ''}
          </p>

          {analysis.error !== undefined && (
            <p
              role="alert"
              className="mb-5 rounded-[var(--radius)] border border-danger/40 bg-surface p-4 text-sm"
            >
              {analysis.error.message}
              {analysis.error.requestId !== undefined && (
                <span className="mt-2 block font-mono text-xs text-muted">
                  Reference: {analysis.error.requestId}
                </span>
              )}
            </p>
          )}

          {analysis.done !== undefined && (
            <p className="mb-5 text-sm text-muted">
              <strong className="text-text">{analysis.done.verified} verified</strong>
              {analysis.done.rejected > 0 && (
                <>
                  {' · '}
                  <strong className="text-danger">{analysis.done.rejected} struck out</strong>
                </>
              )}
              {' · '}
              answered by <span className="font-mono">{analysis.done.provider}</span>
              {analysis.done.degraded && ' (a backup provider)'}
              {' · '}
              {(analysis.done.durationMs / 1000).toFixed(1)}s
            </p>
          )}

          <div className="grid gap-6 lg:grid-cols-2">
            <section aria-label="Analysis">
              <div role="tablist" aria-label="Analysis sections" className="mb-3 flex gap-1">
                {tabs.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    role="tab"
                    aria-selected={tab === t.id}
                    onClick={() => {
                      setTab(t.id);
                    }}
                    className={cn(
                      'rounded-[var(--radius)] px-3 py-1.5 text-sm transition-colors',
                      tab === t.id
                        ? 'bg-accent-sunk font-semibold text-accent'
                        : 'text-muted hover:text-text',
                    )}
                  >
                    {t.label}
                    <span className="ml-1.5 font-mono text-xs">{t.count}</span>
                  </button>
                ))}
              </div>

              {tab === 'findings' &&
                (analysis.findings.length > 0 ? (
                  <FindingList findings={analysis.findings} activeIndex={active} onSelect={setActive} />
                ) : (
                  <Empty running={analysis.running} nothing="No risks found in this one." />
                ))}

              {tab === 'law' &&
                (analysis.statutes.length > 0 ? (
                  <StatuteList statutes={analysis.statutes} />
                ) : (
                  <Empty running={analysis.running} nothing="Nothing here runs into a provision we ship." />
                ))}

              {tab === 'obligations' &&
                (analysis.obligations.length > 0 ? (
                  <ObligationsTable obligations={analysis.obligations} />
                ) : (
                  <Empty running={analysis.running} nothing="No obligations were picked out." />
                ))}
            </section>

            <section aria-label="Document" className="lg:sticky lg:top-6 lg:self-start">
              {analysis.text !== '' ? (
                <DocumentPane text={analysis.text} span={span} />
              ) : (
                <Empty running={analysis.running} nothing="Nothing to show." />
              )}
            </section>
          </div>
        </>
      )}
    </AppShell>
  );
}

function Empty({ running, nothing }: { running: boolean; nothing: string }): React.JSX.Element {
  return (
    <p className="rounded-[var(--radius)] border border-border bg-surface p-6 text-sm text-muted">
      {running ? 'Reading…' : nothing}
    </p>
  );
}
