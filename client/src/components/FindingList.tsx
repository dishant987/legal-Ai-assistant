import type { VerifiedFinding } from '@api/finding.js';
import { AlertTriangle, Check } from 'lucide-react';
import { useRef } from 'react';

import { cn } from '../lib/cn.js';

const SEVERITY: Record<string, { label: string; className: string }> = {
  critical: { label: 'Critical', className: 'text-danger' },
  high: { label: 'High', className: 'text-danger' },
  medium: { label: 'Medium', className: 'text-warn' },
  low: { label: 'Low', className: 'text-muted' },
  info: { label: 'Info', className: 'text-muted' },
};

/**
 * The findings, each one a button that points at the document.
 *
 * Buttons rather than clickable divs, and arrow keys move between them
 * (R11.3). This is the highest-risk accessibility surface in the app: the whole
 * product is "click a finding, see the words" — if that only works with a
 * mouse, the product only works with a mouse.
 *
 * Unverified findings are shown struck through rather than filtered out. A tool
 * that silently drops its own hallucinations is indistinguishable from one that
 * has none.
 */
export function FindingList({
  findings,
  activeIndex,
  onSelect,
}: {
  findings: VerifiedFinding[];
  activeIndex: number | undefined;
  onSelect: (index: number) => void;
}): React.JSX.Element {
  const listRef = useRef<HTMLUListElement>(null);

  function onKeyDown(event: React.KeyboardEvent<HTMLUListElement>): void {
    if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return;
    event.preventDefault();

    const buttons = [...(listRef.current?.querySelectorAll('button') ?? [])];
    const current = buttons.indexOf(document.activeElement as HTMLButtonElement);
    const next = event.key === 'ArrowDown' ? current + 1 : current - 1;

    buttons[(next + buttons.length) % buttons.length]?.focus();
  }

  return (
    <ul ref={listRef} onKeyDown={onKeyDown} className="flex flex-col gap-2">
      {findings.map((finding, index) => {
        const severity = SEVERITY[finding.severity] ?? SEVERITY.info;
        const active = activeIndex === index;

        return (
          <li key={`${finding.quote}-${String(index)}`}>
            <button
              type="button"
              onClick={() => {
                onSelect(index);
              }}
              aria-pressed={active}
              disabled={!finding.verified}
              className={cn(
                'w-full rounded-[var(--radius)] border p-3 text-left transition-colors',
                active ? 'border-accent bg-accent-sunk' : 'border-border bg-surface hover:border-accent/50',
                !finding.verified && 'cursor-not-allowed opacity-70',
              )}
            >
              <span className="mb-1 flex items-center gap-2 text-xs">
                {finding.verified ? (
                  <Check size={13} className="text-ok" aria-hidden="true" />
                ) : (
                  <AlertTriangle size={13} className="text-danger" aria-hidden="true" />
                )}
                {/* Severity is never colour alone — the word is there too (R11.7). */}
                <span className={cn('font-semibold uppercase tracking-wide', severity?.className)}>
                  {severity?.label}
                </span>
                <span className="text-muted">{finding.kind}</span>
              </span>

              <span className="block text-sm">{finding.plainText}</span>

              <q
                className={cn(
                  'mt-2 block font-mono text-xs text-muted',
                  !finding.verified && 'line-through decoration-danger decoration-2',
                )}
              >
                {finding.quote}
              </q>

              {!finding.verified && (
                <span className="mt-2 block text-xs text-danger">
                  Couldn&rsquo;t find these words in your document, so this claim is struck out.
                </span>
              )}
            </button>
          </li>
        );
      })}
    </ul>
  );
}
