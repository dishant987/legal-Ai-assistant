import type { AnalysisEvent } from '@api/events.js';
import { ChevronDown, ChevronUp, ChevronsUpDown } from 'lucide-react';
import { useMemo, useState } from 'react';

type Obligation = Extract<AnalysisEvent, { type: 'obligation' }>['obligation'];

const COLUMNS = [
  { key: 'party', header: 'Who' },
  { key: 'duty', header: 'Owes what' },
  { key: 'dueBy', header: 'By when' },
  { key: 'consequence', header: 'If they miss it' },
] as const satisfies readonly { key: keyof Obligation; header: string }[];

type SortKey = (typeof COLUMNS)[number]['key'];

/**
 * Who owes what, by when.
 *
 * Written by hand rather than with TanStack Table, which is a deliberate
 * reversal of the original plan. The reason for choosing a *headless* table was
 * that the accessibility markup stays ours — and it does here anyway: a real
 * `<table>` with a caption, scoped headers and `aria-sort` (R11.11). What the
 * library would have added is row-model machinery for filtering, grouping,
 * pagination and virtualisation, none of which four columns and one sort need.
 *
 * TanStack Query, by contrast, is doing real work and stays.
 */
export function ObligationsTable({ obligations }: { obligations: Obligation[] }): React.JSX.Element {
  const [sort, setSort] = useState<{ key: SortKey; desc: boolean } | undefined>();

  const rows = useMemo(() => {
    if (sort === undefined) return obligations;
    const direction = sort.desc ? -1 : 1;
    return [...obligations].sort(
      (a, b) => a[sort.key].localeCompare(b[sort.key], undefined, { numeric: true }) * direction,
    );
  }, [obligations, sort]);

  function toggle(key: SortKey): void {
    setSort((current) =>
      current?.key !== key ? { key, desc: false } : current.desc ? undefined : { key, desc: true },
    );
  }

  return (
    <div className="overflow-x-auto rounded-[var(--radius)] border border-border bg-surface">
      <table className="w-full border-collapse text-sm">
        <caption className="sr-only">
          Obligations this contract creates, for both sides. Sortable by column.
        </caption>

        <thead>
          <tr className="border-b border-border">
            {COLUMNS.map(({ key, header }) => {
              const active = sort?.key === key;
              const Icon = !active ? ChevronsUpDown : sort.desc ? ChevronDown : ChevronUp;

              return (
                <th
                  key={key}
                  scope="col"
                  aria-sort={!active ? 'none' : sort.desc ? 'descending' : 'ascending'}
                  className="p-0 text-left"
                >
                  <button
                    type="button"
                    onClick={() => {
                      toggle(key);
                    }}
                    className="flex w-full items-center gap-1.5 px-3 py-2.5 text-xs font-semibold uppercase tracking-wide text-muted hover:text-text"
                  >
                    {header}
                    <Icon size={12} aria-hidden="true" />
                  </button>
                </th>
              );
            })}
          </tr>
        </thead>

        <tbody>
          {rows.map((row, index) => (
            <tr
              key={`${row.party}-${row.duty}-${String(index)}`}
              className="border-b border-border last:border-0"
            >
              {COLUMNS.map(({ key }) => (
                <td key={key} className="px-3 py-2.5 align-top">
                  {row[key] === '' ? <span className="text-muted">—</span> : row[key]}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
