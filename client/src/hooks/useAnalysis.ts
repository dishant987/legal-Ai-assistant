import { analysisEventSchema, type AnalysisEvent, type StageName } from '@api/events.js';
import type { VerifiedFinding } from '@api/finding.js';
import { useCallback, useRef, useState } from 'react';

import { ApiError } from '../lib/apiError.js';

type StatuteEvent = Extract<AnalysisEvent, { type: 'statute' }>['statute'];
type ObligationEvent = Extract<AnalysisEvent, { type: 'obligation' }>['obligation'];
type DoneEvent = Extract<AnalysisEvent, { type: 'done' }>;

export interface AnalysisState {
  running: boolean;
  stages: Partial<Record<StageName, 'running' | 'done'>>;
  text: string;
  docType: string;
  findings: VerifiedFinding[];
  statutes: StatuteEvent[];
  obligations: ObligationEvent[];
  done: DoneEvent | undefined;
  error: ApiError | undefined;
}

const EMPTY: AnalysisState = {
  running: false,
  stages: {},
  text: '',
  docType: '',
  findings: [],
  statutes: [],
  obligations: [],
  done: undefined,
  error: undefined,
};

export interface AnalyseArgs {
  file?: File;
  text?: string;
  jurisdictionState?: string;
  store: boolean;
}

/**
 * Consume the analysis stream.
 *
 * `fetch` rather than `EventSource`, which only does GET and so cannot carry a
 * document. Events are applied to state as they arrive, which is the whole
 * point: on a long contract the first findings appear while the rest are still
 * being checked.
 *
 * Unknown event types are ignored rather than thrown on, so a server that
 * learns to emit something new does not break an older client.
 */
export function useAnalysis(): AnalysisState & {
  analyse: (args: AnalyseArgs) => Promise<void>;
  cancel: () => void;
  reset: () => void;
} {
  const [state, setState] = useState<AnalysisState>(EMPTY);
  const abortRef = useRef<AbortController | undefined>(undefined);

  const cancel = useCallback(() => {
    abortRef.current?.abort();
    setState((s) => ({ ...s, running: false }));
  }, []);

  const reset = useCallback(() => {
    abortRef.current?.abort();
    setState(EMPTY);
  }, []);

  const analyse = useCallback(async (args: AnalyseArgs) => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setState({ ...EMPTY, running: true });

    const body = new FormData();
    if (args.file) body.append('file', args.file);
    if (args.text !== undefined) body.append('text', args.text);
    if (args.jurisdictionState !== undefined) body.append('jurisdictionState', args.jurisdictionState);
    body.append('store', String(args.store));

    try {
      const response = await fetch(`${import.meta.env.VITE_API_URL}/analyses`, {
        method: 'POST',
        body,
        signal: controller.signal,
      });

      // A failure before the stream opens is an ordinary JSON envelope.
      if (!response.ok && !(response.headers.get('content-type') ?? '').includes('event-stream')) {
        const envelope: unknown = await response.json();
        setState((s) => ({ ...s, running: false, error: ApiError.fromEnvelope(envelope) }));
        return;
      }

      const reader = response.body?.getReader();
      if (!reader) throw new Error('no stream');

      const decoder = new TextDecoder();
      let buffer = '';

      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });

        // SSE frames are separated by a blank line; the tail may be partial.
        const frames = buffer.split('\n\n');
        buffer = frames.pop() ?? '';

        for (const frame of frames) {
          const payload = /^data: (.+)$/m.exec(frame)?.[1];
          if (payload === undefined) continue;

          const parsed = analysisEventSchema.safeParse(JSON.parse(payload));
          if (parsed.success) setState((s) => apply(s, parsed.data));
        }
      }

      setState((s) => ({ ...s, running: false }));
    } catch (error) {
      if (controller.signal.aborted) return;
      // The typed message is what the reader sees; the original goes to the
      // console, which is the only place a client-side failure can surface.
      // eslint-disable-next-line no-console
      console.error('Analysis stream failed', error);
      setState((s) => ({ ...s, running: false, error: ApiError.network() }));
    }
  }, []);

  return { ...state, analyse, cancel, reset };
}

/** Fold one event into the running state. */
function apply(state: AnalysisState, event: AnalysisEvent): AnalysisState {
  switch (event.type) {
    case 'stage':
      return { ...state, stages: { ...state.stages, [event.stage]: event.status } };
    case 'document':
      return { ...state, text: event.text, docType: event.docType };
    case 'finding':
      return { ...state, findings: [...state.findings, event.finding] };
    case 'statute':
      return { ...state, statutes: [...state.statutes, event.statute] };
    case 'obligation':
      return { ...state, obligations: [...state.obligations, event.obligation] };
    case 'done':
      return { ...state, done: event, running: false };
    case 'error':
      return {
        ...state,
        running: false,
        error: new ApiError(event.code, event.message, event.retryable, event.requestId),
      };
  }
}
