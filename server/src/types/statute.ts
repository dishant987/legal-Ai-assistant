import { z } from 'zod';

/**
 * How binding a provision is where the reader lives.
 *
 * The distinction exists because getting it wrong is the most common way legal
 * tooling misleads people. A central Act applies everywhere. A *model* Act is a
 * template the Union government publishes for states to enact — it binds nobody
 * until a state passes its own version, and citing one as though it were law is
 * simply incorrect (F11).
 */
export const bindingSchema = z.discriminatedUnion('scope', [
  z.object({ scope: z.literal('all-india') }),
  z.object({
    scope: z.literal('model-act'),
    /**
     * States known to have enacted it. Deliberately conservative: a state
     * absent from this list produces a caveat rather than a claim, because
     * under-claiming is recoverable and over-claiming is not.
     */
    adoptedBy: z.array(z.string()),
  }),
  z.object({ scope: z.literal('state'), states: z.array(z.string()) }),
]);

export type Binding = z.infer<typeof bindingSchema>;

/** What a provision does to a clause that contradicts it. */
export const effects = ['void', 'unenforceable', 'capped', 'minimum', 'requires'] as const;
export type Effect = (typeof effects)[number];

export const statuteSchema = z.object({
  id: z.string().min(1),
  act: z.string().min(1),
  section: z.string().min(1),
  /** The provision's own words, quoted rather than paraphrased. */
  text: z.string().min(20),
  /** What it means, in plain English. */
  plain: z.string().min(20),
  binding: bindingSchema,
  effect: z.enum(effects),
  /** Document kinds this can bear on. */
  appliesTo: z.array(z.string()).min(1),
  /** What in a document should make us reach for it. */
  trigger: z.string().min(10),
  sourceUrl: z.url(),
});

export type Statute = z.infer<typeof statuteSchema>;

export const corpusSchema = z.array(statuteSchema);

/**
 * A provision matched against a specific document.
 *
 * `caveat` is present whenever the provision cannot simply be asserted — a
 * model act in a state we cannot confirm has adopted it. The UI shows it with
 * the finding rather than tucking it away.
 */
export const statuteHitSchema = z.object({
  statuteId: z.string(),
  act: z.string(),
  section: z.string(),
  text: z.string(),
  plain: z.string(),
  effect: z.enum(effects),
  /** Why this provision was reached for, tied to the clause it bears on. */
  because: z.string(),
  caveat: z.string().optional(),
});

export type StatuteHit = z.infer<typeof statuteHitSchema>;
