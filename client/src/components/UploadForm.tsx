import { FileUp, Loader2 } from 'lucide-react';
import { useId, useRef, useState } from 'react';

import type { AnalyseArgs } from '../hooks/useAnalysis.js';
import { cn } from '../lib/cn.js';

const MAX_BYTES = 10 * 1024 * 1024;

const STATES = [
  'Andhra Pradesh',
  'Assam',
  'Bihar',
  'Chhattisgarh',
  'Delhi',
  'Goa',
  'Gujarat',
  'Haryana',
  'Himachal Pradesh',
  'Jharkhand',
  'Karnataka',
  'Kerala',
  'Madhya Pradesh',
  'Maharashtra',
  'Odisha',
  'Punjab',
  'Rajasthan',
  'Tamil Nadu',
  'Telangana',
  'Uttar Pradesh',
  'Uttarakhand',
  'West Bengal',
];

/**
 * Where a document comes in.
 *
 * A real `<input type="file">` behind a styled label, with drag-and-drop added
 * on top rather than replacing it (R11.6). A div with a click handler looks the
 * same and is unusable by keyboard, and this is the first thing anyone touches.
 *
 * Oversized files are rejected here, before a byte leaves the browser, with a
 * reason rather than a code.
 */
export function UploadForm({
  onAnalyse,
  running,
  onCancel,
}: {
  onAnalyse: (args: AnalyseArgs) => void;
  running: boolean;
  onCancel: () => void;
}): React.JSX.Element {
  const fileId = useId();
  const textId = useId();
  const stateId = useId();
  const storeId = useId();
  const inputRef = useRef<HTMLInputElement>(null);

  const [file, setFile] = useState<File | undefined>();
  const [text, setText] = useState('');
  const [state, setState] = useState('');
  const [store, setStore] = useState(false);
  const [problem, setProblem] = useState<string | undefined>();
  const [dragging, setDragging] = useState(false);

  function accept(candidate: File | undefined): void {
    if (!candidate) return;

    if (candidate.size > MAX_BYTES) {
      const mb = (candidate.size / 1024 / 1024).toFixed(1);
      setProblem(
        `That file is ${mb} MB and the limit is 10 MB. Exporting the PDF at lower quality usually gets it under.`,
      );
      return;
    }
    setProblem(undefined);
    setFile(candidate);
    setText('');
  }

  function submit(event: React.SyntheticEvent): void {
    event.preventDefault();
    if (!file && text.trim().length < 20) {
      setProblem('Paste your document, or choose a file. We need at least a paragraph to work with.');
      return;
    }
    setProblem(undefined);
    onAnalyse({
      ...(file ? { file } : { text }),
      ...(state !== '' ? { jurisdictionState: state } : {}),
      store,
    });
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-4">
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => {
          setDragging(false);
        }}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          accept(e.dataTransfer.files[0]);
        }}
        className={cn(
          'rounded-[var(--radius)] border-2 border-dashed p-6 text-center transition-colors',
          dragging ? 'border-accent bg-accent-sunk' : 'border-border',
        )}
      >
        <FileUp size={22} className="mx-auto mb-2 text-accent" aria-hidden="true" />

        <label
          htmlFor={fileId}
          className="cursor-pointer font-semibold text-accent underline underline-offset-4"
        >
          Choose a file
        </label>
        <span className="text-muted"> or drop one here</span>

        <input
          ref={inputRef}
          id={fileId}
          type="file"
          accept=".pdf,.png,.jpg,.jpeg,.webp,.txt,.md,.docx"
          onChange={(e) => {
            accept(e.target.files?.[0]);
          }}
          className="sr-only"
        />

        <p className="mt-2 text-xs text-muted">PDF, Word, text, or a photo of the pages. Up to 10&nbsp;MB.</p>

        {file && <p className="mt-2 text-sm">Selected: {file.name}</p>}
      </div>

      <div>
        <label htmlFor={textId} className="mb-1.5 block text-sm font-semibold">
          Or paste the text
        </label>
        <textarea
          id={textId}
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            if (e.target.value !== '') setFile(undefined);
          }}
          rows={5}
          placeholder="Paste your rent agreement, offer letter or contract here…"
          className="w-full rounded-[var(--radius)] border border-border bg-surface p-3 font-mono text-[13px]"
        />
      </div>

      <div className="flex flex-wrap items-end gap-4">
        <div>
          <label htmlFor={stateId} className="mb-1.5 block text-sm font-semibold">
            Your state
          </label>
          <select
            id={stateId}
            value={state}
            onChange={(e) => {
              setState(e.target.value);
            }}
            className="rounded-[var(--radius)] border border-border bg-surface px-3 py-2 text-sm"
          >
            <option value="">Prefer not to say</option>
            {STATES.map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </select>
          <p className="mt-1 text-xs text-muted">Tenancy law differs by state.</p>
        </div>

        <label htmlFor={storeId} className="flex items-center gap-2 pb-2 text-sm">
          <input
            id={storeId}
            type="checkbox"
            checked={store}
            onChange={(e) => {
              setStore(e.target.checked);
            }}
          />
          {/* Off by default. Legal documents deserve the safe default, even
              though it costs us the cache on most runs (R3.6). */}
          Keep a copy for 24 hours
        </label>
      </div>

      {problem !== undefined && (
        <p role="alert" className="text-sm text-danger">
          {problem}
        </p>
      )}

      <div className="flex gap-3">
        <button
          type="submit"
          disabled={running}
          className="inline-flex items-center gap-2 rounded-[var(--radius)] bg-accent px-5 py-2.5 font-semibold text-[var(--surface)] transition-opacity hover:opacity-90 disabled:opacity-60"
        >
          {running && <Loader2 size={15} className="animate-spin" aria-hidden="true" />}
          {running ? 'Reading…' : 'Read my contract'}
        </button>

        {running && (
          <button
            type="button"
            onClick={onCancel}
            className="rounded-[var(--radius)] border border-border px-4 py-2.5 text-sm"
          >
            Stop
          </button>
        )}
      </div>
    </form>
  );
}
