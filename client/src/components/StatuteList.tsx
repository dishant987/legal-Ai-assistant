import type { AnalysisEvent } from '@api/events.js';
import { Info, Scale } from 'lucide-react';

import { cn } from '../lib/cn.js';

type Statute = Extract<AnalysisEvent, { type: 'statute' }>['statute'];

const EFFECT: Record<string, { label: string; className: string }> = {
  void: { label: 'Void', className: 'bg-danger text-[var(--surface)]' },
  unenforceable: { label: 'Unenforceable', className: 'bg-danger text-[var(--surface)]' },
  capped: { label: 'Over the cap', className: 'bg-warn text-[var(--surface)]' },
  minimum: { label: 'Below the floor', className: 'bg-warn text-[var(--surface)]' },
  requires: { label: 'Requirement', className: 'bg-surface-sunk text-text' },
};

/**
 * What the law says about these clauses.
 *
 * Separate from findings because the authority is different: a finding quotes
 * the document, this quotes the statute. The provision's own words are shown
 * rather than a paraphrase, so a reader can check it.
 *
 * The caveat is displayed as prominently as the claim. A model Act binds nobody
 * until a state enacts it, and burying that would turn the most useful thing
 * here into the most misleading.
 */
export function StatuteList({ statutes }: { statutes: Statute[] }): React.JSX.Element {
  return (
    <ul className="flex flex-col gap-3">
      {statutes.map((statute) => (
        <li key={statute.statuteId} className="rounded-[var(--radius)] border border-border bg-surface p-4">
          <p className="mb-2 flex flex-wrap items-center gap-2">
            <Scale size={14} className="text-accent" aria-hidden="true" />
            <span className="font-serif font-semibold">
              {statute.act}, s.{statute.section}
            </span>
            <span
              className={cn(
                'rounded-full px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide',
                EFFECT[statute.effect]?.className,
              )}
            >
              {EFFECT[statute.effect]?.label ?? statute.effect}
            </span>
          </p>

          <p className="mb-2 text-sm">{statute.plain}</p>
          <p className="mb-3 text-sm text-muted">{statute.because}</p>

          <blockquote className="border-l-2 border-border pl-3 font-mono text-xs text-muted">
            {statute.text}
          </blockquote>

          {statute.caveat !== undefined && (
            <p className="mt-3 flex gap-2 rounded-[var(--radius)] bg-surface-sunk p-3 text-xs">
              <Info size={14} className="mt-0.5 shrink-0 text-warn" aria-hidden="true" />
              <span>{statute.caveat}</span>
            </p>
          )}
        </li>
      ))}
    </ul>
  );
}
