# Legal AI Assistant

**Every sentence this tool outputs points at the exact words that caused it.**

Nothing is asserted that isn't either (a) a verbatim span in your document, or (b) a provision in the statute corpus shipped with this repo. Claims that can't be traced back to one of those are struck through on screen rather than quietly shown.

> ⚖️ **This provides information, not legal advice.** It does not replace a qualified legal professional. Free legal aid in India is available through [NALSA](https://nalsa.gov.in) (helpline **15100**).

---

## Problem statement

> **AI for Legal Assistance & Access**
>
> Legal information can often be complex, difficult to understand, and challenging to navigate without professional assistance. Build a GenAI-powered solution that makes legal information and basic legal assistance more accessible by helping users understand, compare, and navigate legal documents and information.
>
> Potential use cases include:
>
> - Simplifying complex legal documents
> - Comparing contracts, agreements, or policies
> - Highlighting important clauses, obligations, risks, or inconsistencies
> - Answering questions based on provided legal documents
> - Helping users understand their options and potential next steps
> - Generating summaries, checklists, or other actionable outputs
> - Helping users prepare information or questions for a legal professional
>
> NOTE:
>
> - Solutions should provide information and assistance, rather than replace professional legal advice.
> - The use cases listed above are intended as potential directions and are not exhaustive or prescriptive.
> - Participants are encouraged to explore the problem space, think creatively, and develop innovative approaches or entirely different use cases within the theme.

### Coverage

Every bullet above maps to a feature, a file, and a test.

| Problem statement bullet                                    | Feature                                                                                                | Implementation                                       | Test             |
| ----------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ | ---------------------------------------------------- | ---------------- |
| Simplifying complex legal documents                         | Per-clause plain-language rewrite at Grade-8 reading level, Hindi/Marathi toggle                       | `server/src/services/analysis/stages/simplify.ts`    | _pending Step 6_ |
| Comparing contracts, agreements, or policies                | Two-document clause-level semantic diff with a balance-of-power read on each change                    | `.../stages/compare.ts`                              | _pending Step 6_ |
| Highlighting clauses, obligations, risks, inconsistencies   | Span-anchored findings with severity; obligations table; internal-contradiction check                  | `.../stages/extract.ts`, `.../stages/obligations.ts` | _pending Step 5_ |
| Answering questions based on provided documents             | Grounded Q&A — answers only from the uploaded document, cites the span, or says "not in this document" | `.../stages/ask.ts`                                  | _pending Step 6_ |
| Understanding options and potential next steps              | Options ladder (negotiate / walk away / escalate) with the actual forum for each                       | `.../stages/options.ts`                              | _pending Step 6_ |
| Summaries, checklists, actionable outputs                   | One-page summary, pre-signing checklist, redline wording, ready-to-send negotiation message            | `.../stages/act.ts`                                  | _pending Step 6_ |
| Preparing information or questions for a legal professional | Lawyer brief: facts timeline, documents to carry, the questions to ask, statutes in play               | `.../stages/brief.ts`                                | _pending Step 6_ |

### Beyond the brief

|                            |                                                                                                                                                             |
| -------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Span anchoring**         | Every finding carries `{quote, charStart, charEnd}`. Click one and the exact words highlight in your document.                                              |
| **Self-audit**             | A separate verification pass strikes out any claim whose quote isn't verbatim in the source. Deterministic string containment — it cannot be talked around. |
| **You / Market / Law**     | Each material clause is shown against market standard _and_ against the statutory floor — including clauses that are **void regardless of signature**.      |
| **Jurisdiction honesty**   | A _model_ act is never cited as binding in a state that hasn't adopted it.                                                                                  |
| **Reads a photograph**     | Stamp-paper agreements photographed on a phone go straight to the model. No OCR layer to break.                                                             |
| **Four-provider failover** | Gemini → Groq → Mistral → Ollama, with a circuit breaker. Runs entirely offline on Ollama alone.                                                            |

---

## Quickstart

```bash
npm install
cp .env.example .env      # fill in DATABASE_URL; AI keys are optional
npm run db:migrate
npm run dev
```

Open http://localhost:5173.

**No API keys?** It still runs — install [Ollama](https://ollama.com), `ollama pull llama3.2`, and the chain falls through to local inference. Set `DEMO=true` to serve recorded fixtures with no model at all.

**No Postgres?** Create a free [Neon](https://neon.tech) project and paste its connection string into `DATABASE_URL`. No code changes, no Docker.

---

## Stack

PostgreSQL (Drizzle ORM) · Express 5 · React 19 · TypeScript strict · TanStack Query/Table/Virtual · Axios · Tailwind + shadcn/ui · Vitest + Playwright + axe-core

Architecture, threat model and privacy policy: [`ARCHITECTURE.md`](ARCHITECTURE.md) · [`SECURITY.md`](SECURITY.md) · [`PRIVACY.md`](PRIVACY.md)

---

## Status

Under active development. See the commit history for what has landed.
