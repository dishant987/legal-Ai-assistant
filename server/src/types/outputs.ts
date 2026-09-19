import { z } from 'zod';

/**
 * The things a reader can actually do with an analysis.
 *
 * Client-safe. As with findings, the `.describe()` text is fed to the model as
 * the field description, so these schemas are the prompt specification too.
 */

export const obligationSchema = z.object({
  party: z.string().describe('Who owes this, in the document\'s own words: "Tenant", "Company".'),
  duty: z.string().min(5).describe('What they must do, in plain English.'),
  dueBy: z.string().describe('When. Quote the deadline if there is one, or say "no deadline stated".'),
  consequence: z
    .string()
    .describe('What the document says happens if they miss it. "Not stated" is a real answer.'),
  quote: z.string().min(10).describe('The clause this comes from, copied VERBATIM.'),
});

export const obligationsResultSchema = z.object({
  obligations: z.array(obligationSchema).max(25),
});

export type Obligation = z.infer<typeof obligationSchema>;

/**
 * What the reader could do next.
 *
 * Deliberately options, never a recommendation. This is information, not
 * advice, and the difference is the line the product must not cross.
 */
export const optionSchema = z.object({
  action: z.enum(['negotiate', 'accept', 'walk-away', 'escalate', 'get-advice']),
  summary: z.string().min(10).describe('What this option involves, in one sentence.'),
  upside: z.string().min(5),
  downside: z.string().min(5),
  forum: z
    .string()
    .describe(
      'Where this happens, if anywhere: the rent authority, the consumer commission, ' +
        'the labour commissioner, a civil court. Empty string if not applicable.',
    ),
});

export const optionsResultSchema = z.object({
  options: z.array(optionSchema).min(1).max(6),
  /** Always present. The product informs; it does not advise. */
  disclaimer: z.string(),
});

/** Redline: the wording to ask for instead. */
export const redlineSchema = z.object({
  quote: z.string().min(10).describe('The clause to change, copied VERBATIM from the document.'),
  replacement: z.string().min(10).describe('Wording to ask for instead. Keep it short and usable.'),
  why: z.string().min(10).describe('Why this change matters, in one plain sentence.'),
});

export const actResultSchema = z.object({
  summary: z.string().min(20).describe('The whole document in three sentences a worried person can read.'),
  checklist: z
    .array(z.string())
    .max(10)
    .describe('What to check or settle BEFORE signing. Each item one short line.'),
  redlines: z.array(redlineSchema).max(8),
  message: z
    .string()
    .max(900)
    .describe(
      'A polite, specific message the reader can send the other side asking for the changes. ' +
        'Short enough for WhatsApp. No legal jargon, no threats, first person.',
    ),
});

/**
 * What to bring to a lawyer.
 *
 * The least-crowded bullet in the brief, and the most useful: a first
 * consultation goes better when someone arrives with the facts in order and
 * the right questions written down.
 */
export const briefResultSchema = z.object({
  facts: z.array(z.string()).max(12).describe('The facts a lawyer needs, in order, one per line.'),
  documents: z.array(z.string()).max(10).describe('What to take to the appointment.'),
  questions: z
    .array(z.string())
    .min(3)
    .max(8)
    .describe('Specific questions to ask, drawn from THIS document, not generic ones.'),
  statutesInPlay: z.array(z.string()).max(8).describe('Only provisions named in the analysis above.'),
});

/** A question answered strictly from the document, or refused. */
export const askResultSchema = z.object({
  answer: z.string().min(2).describe('The answer, in plain English.'),
  quote: z
    .string()
    .describe('The text this answer rests on, copied VERBATIM. Empty string if the document does not say.'),
  notInDocument: z
    .boolean()
    .describe('True when the document simply does not answer the question. Say so rather than guessing.'),
});

export const compareChangeSchema = z.object({
  topic: z.string().min(3).describe('What changed, e.g. "Notice period".'),
  before: z.string().describe('The old position. Empty string if newly added.'),
  after: z.string().describe('The new position. Empty string if removed.'),
  favours: z.enum(['you', 'them', 'neither']).describe('Who this change is better for.'),
  why: z.string().min(10),
});

export const compareResultSchema = z.object({
  changes: z.array(compareChangeSchema).max(30),
  /** -100 (all against you) to +100 (all in your favour). */
  balanceShift: z.number().int().min(-100).max(100),
});

export type ObligationsResult = z.infer<typeof obligationsResultSchema>;
export type OptionsResult = z.infer<typeof optionsResultSchema>;
export type ActResult = z.infer<typeof actResultSchema>;
export type BriefResult = z.infer<typeof briefResultSchema>;
export type AskResult = z.infer<typeof askResultSchema>;
export type CompareResult = z.infer<typeof compareResultSchema>;
