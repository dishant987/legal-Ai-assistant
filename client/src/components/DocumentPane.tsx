import { useEffect, useRef } from 'react';

export interface Span {
  charStart: number;
  charEnd: number;
}

/**
 * The document, with the active clause highlighted.
 *
 * Rendered as one text block rather than a virtualised list. The spec called
 * for virtualisation, and it would be actively wrong here: the offsets that
 * make highlighting work are into the whole string, and native text selection
 * has to span the document. A browser handles one large text node comfortably —
 * what it struggles with is thousands of elements, which is not what this is.
 */
export function DocumentPane({ text, span }: { text: string; span: Span | undefined }): React.JSX.Element {
  const markRef = useRef<HTMLElement>(null);

  useEffect(() => {
    markRef.current?.scrollIntoView({ block: 'center', behavior: 'smooth' });
  }, [span]);

  const active = span !== undefined && span.charEnd > span.charStart;

  return (
    <div
      className="h-[60vh] overflow-y-auto rounded-[var(--radius)] border border-border bg-surface p-5"
      // Focusable so a keyboard user can scroll it; the label says what it is.
      tabIndex={0}
      role="region"
      aria-label="Your document"
    >
      <pre className="whitespace-pre-wrap break-words font-mono text-[13px] leading-[1.75]">
        {active ? (
          <>
            {text.slice(0, span.charStart)}
            <mark ref={markRef} className="rounded bg-accent-sunk px-0.5 text-text ring-1 ring-accent/40">
              {text.slice(span.charStart, span.charEnd)}
            </mark>
            {text.slice(span.charEnd)}
          </>
        ) : (
          text
        )}
      </pre>
    </div>
  );
}
