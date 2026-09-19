import { corpusSchema, type Statute, type StatuteHit } from '../../types/statute.js';
import rawCorpus from '../../types/corpus/statutes.json' with { type: 'json' };

/**
 * The shipped corpus, validated once.
 *
 * The model never writes a citation. It may only name an id from this file, and
 * an id that is not here is dropped (F12). That is what stops a fabricated
 * section number reaching a reader, which is the single most damaging thing
 * legal tooling does.
 */
export const CORPUS: readonly Statute[] = corpusSchema.parse(rawCorpus);

const BY_ID = new Map(CORPUS.map((s) => [s.id, s]));

const WORD_NUMBERS: Record<string, number> = {
  one: 1,
  two: 2,
  three: 3,
  four: 4,
  five: 5,
  six: 6,
  seven: 7,
  eight: 8,
  nine: 9,
  ten: 10,
  eleven: 11,
  twelve: 12,
};

/**
 * How many months of security deposit a document asks for.
 *
 * Deterministic on purpose. This drives a "your deposit exceeds the statutory
 * cap" claim, and that claim must not be able to hallucinate — it is checked
 * against the document's own numbers, not inferred.
 *
 * Handles the forms Indian agreements actually use: "six (6) months",
 * "6 months", "two months'", "2 (Two) months".
 *
 * @param text - The document text.
 * @returns Months of deposit, or undefined if none was stated clearly.
 */
export function depositMonths(text: string): number | undefined {
  const window = /security\s+deposit[^.;\n]{0,120}/gi;

  for (const match of text.matchAll(window)) {
    const phrase = match[0];
    const numeric = /(\d{1,2})\s*(?:\([^)]*\)\s*)?month/i.exec(phrase);
    if (numeric?.[1] !== undefined) return Number(numeric[1]);

    const worded = /\b([a-z]+)\s*(?:\(\s*\d{1,2}\s*\)\s*)?month/i.exec(phrase);
    const word = worded?.[1]?.toLowerCase();
    if (word !== undefined && word in WORD_NUMBERS) return WORD_NUMBERS[word];
  }
  return undefined;
}

/**
 * Whether a provision can be stated plainly, or only with a caveat.
 *
 * A model Act binds nobody until a state enacts its own version. Saying "the
 * law caps your deposit at two months" to someone in a state that never adopted
 * it is simply wrong, so an unconfirmed state gets the caveat rather than the
 * claim (F11).
 *
 * @param statute - The provision.
 * @param state - The reader's state, if they told us.
 * @returns A caveat to show alongside, or undefined when it applies outright.
 */
export function bindingCaveat(statute: Statute, state?: string): string | undefined {
  const binding = statute.binding;

  if (binding.scope === 'all-india') return undefined;

  if (binding.scope === 'state') {
    const listed = binding.states.some((s) => s.toLowerCase() === state?.toLowerCase());
    return listed
      ? undefined
      : `This applies in ${binding.states.join(', ')}. Check what governs tenancies in your state.`;
  }

  const adopted = binding.adoptedBy.some((s) => s.toLowerCase() === state?.toLowerCase());
  if (adopted) return undefined;

  const where = state !== undefined && state !== '' ? state : 'your state';
  return (
    `The ${statute.act} is a model law, not binding by itself — each state has to enact its own ` +
    `version. We cannot confirm that ${where} has done so, so your tenancy may still be governed ` +
    `by the older state Rent Control Act. Worth checking before you rely on this.`
  );
}

export interface MatchInput {
  docType: string;
  text: string;
  state?: string;
  /** Corpus ids the model proposed. Anything unrecognised is discarded. */
  proposedIds?: readonly string[];
}

/**
 * Work out which provisions bear on this document.
 *
 * Two sources, in order of trust. Deterministic rules fire from the document's
 * own numbers and cannot be talked out of it. Model-proposed ids are then
 * admitted only if they name a real provision that is relevant to this kind of
 * document — so the worst a confused model can do is suggest nothing.
 *
 * @param input - The document and what the model proposed.
 * @returns Matched provisions, deterministic ones first, deduplicated.
 */
export function matchStatutes(input: MatchInput): StatuteHit[] {
  const hits = new Map<string, StatuteHit>();

  const add = (statute: Statute, because: string): void => {
    if (hits.has(statute.id)) return;
    const caveat = bindingCaveat(statute, input.state);
    hits.set(statute.id, {
      statuteId: statute.id,
      act: statute.act,
      section: statute.section,
      text: statute.text,
      plain: statute.plain,
      effect: statute.effect,
      because,
      ...(caveat !== undefined ? { caveat } : {}),
    });
  };

  // --- Deterministic: the deposit cap, read off the document's own figure ---
  if (input.docType === 'rent-agreement') {
    const months = depositMonths(input.text);
    const cap = BY_ID.get('model-tenancy-act-2021-s11');

    if (months !== undefined && cap !== undefined && months > 2) {
      add(
        cap,
        `The document asks for ${String(months)} months' deposit. The Model Tenancy Act caps a ` +
          `residential deposit at two.`,
      );
    }
  }

  // --- Model-proposed, admitted only if real and relevant ---
  for (const id of input.proposedIds ?? []) {
    const statute = BY_ID.get(id);
    if (statute === undefined) continue;
    if (!statute.appliesTo.includes(input.docType)) continue;
    add(statute, statute.trigger);
  }

  return [...hits.values()];
}

/** The ids and triggers a prompt may offer the model to choose between. */
export function selectableFor(docType: string): { id: string; trigger: string }[] {
  return CORPUS.filter((s) => s.appliesTo.includes(docType)).map((s) => ({
    id: s.id,
    trigger: s.trigger,
  }));
}
