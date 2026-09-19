import type { Finding, VerifiedFinding } from '../../../types/finding.js';

/**
 * Characters models silently "improve" when quoting.
 *
 * A model asked for a verbatim quote will still straighten a curly apostrophe
 * or turn an em dash into a hyphen. Rejecting a finding over that would throw
 * away a true statement about the document, so these are folded before
 * comparison — and only these.
 */
const CANONICAL: Record<string, string> = {
  '‘': "'",
  '’': "'",
  '‚': "'",
  '“': '"',
  '”': '"',
  '„': '"',
  '–': '-',
  '—': '-',
  '−': '-',
  ' ': ' ',
  ' ': ' ',
  ' ': ' ',
};

interface Normalised {
  /** Comparison form: case-folded, whitespace collapsed, punctuation canonical. */
  text: string;
  /** `map[i]` is the index in the ORIGINAL string of normalised character `i`. */
  map: number[];
}

/**
 * Build the comparison form of a string alongside a map back to the original.
 *
 * The map is the point. Matching happens in normalised space, but the offsets
 * we report must index the original document, or the UI would highlight the
 * wrong words.
 */
function normalise(source: string): Normalised {
  const out: string[] = [];
  const map: number[] = [];
  let pendingSpace = false;

  for (let i = 0; i < source.length; i++) {
    const raw = source.charAt(i);
    const ch = CANONICAL[raw] ?? raw;

    if (/\s/.test(ch)) {
      // Collapse any run of whitespace, and never lead with one.
      pendingSpace = out.length > 0;
      continue;
    }

    if (pendingSpace) {
      out.push(' ');
      map.push(i);
      pendingSpace = false;
    }

    out.push(ch.toLowerCase());
    map.push(i);
  }

  return { text: out.join(''), map };
}

/**
 * Check every finding against the document it claims to come from.
 *
 * This is the self-audit (F9), and it is deliberately not a model call. It is
 * string containment: either those words are in the document or they are not.
 * A second model asked "is this accurate?" could be talked round; `indexOf`
 * cannot, and it costs nothing.
 *
 * Offsets are recomputed from the match rather than taken from the model.
 * Models are unreliable at character arithmetic, and a finding that highlights
 * the wrong sentence is worse than one that highlights nothing.
 *
 * Tolerances are narrow and deliberate: case, runs of whitespace, and the
 * curly-quote and dash substitutions above. Everything else is a rejection.
 *
 * @param source - The document text, exactly as shown to the user.
 * @param findings - What the model claimed to find.
 * @returns Every finding, each marked verified or not. Nothing is dropped.
 */
export interface Anchor {
  verified: boolean;
  charStart: number;
  charEnd: number;
  rejectedReason?: string;
}

/**
 * Locate a quote in the document, or report why it is not there.
 *
 * The single implementation of the check. Findings and statute matches both go
 * through it, so a claim of either kind is held to exactly the same standard.
 *
 * @param source - The document text, exactly as shown to the user.
 * @param quote - The text claimed to come from it.
 * @returns Whether it was found, and where in the original it sits.
 */
export function anchorQuote(source: string, quote: string): Anchor {
  const haystack = normalise(source);
  const needle = normalise(quote);

  if (needle.text.length === 0) {
    return { verified: false, charStart: 0, charEnd: 0, rejectedReason: 'empty quote' };
  }

  const at = haystack.text.indexOf(needle.text);
  if (at === -1) {
    return { verified: false, charStart: 0, charEnd: 0, rejectedReason: 'not found in the document' };
  }

  // Both indices are provably in range: `at` came from indexOf on
  // haystack.text, the needle is non-empty, and map has one entry per
  // character of haystack.text. A runtime guard here would be an unreachable
  // branch rather than a safety net.
  /* eslint-disable @typescript-eslint/no-non-null-assertion */
  const charStart = haystack.map[at]!;
  const lastIndex = haystack.map[at + needle.text.length - 1]!;
  /* eslint-enable @typescript-eslint/no-non-null-assertion */

  return { verified: true, charStart, charEnd: lastIndex + 1 };
}

export function verify(source: string, findings: readonly Finding[]): VerifiedFinding[] {
  return findings.map((finding) => ({ ...finding, ...anchorQuote(source, finding.quote) }));
}

/** Split verified from rejected, for the summary counts. */
export function tally(findings: readonly VerifiedFinding[]): { verified: number; rejected: number } {
  const verified = findings.filter((f) => f.verified).length;
  return { verified, rejected: findings.length - verified };
}
