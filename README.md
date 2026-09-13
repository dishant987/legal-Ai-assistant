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

Two independent projects. Two terminals.

```bash
cd server && npm install && cp .env.example .env && npm run dev
```

```bash
cd client && npm install && cp .env.example .env && npm run dev
```

Open http://localhost:5173 — the dev server proxies `/api` to the backend on port 3001.

Each project has its own environment file:

- **`server/.env`** — `DATABASE_URL` is the only required value. Every AI provider key is
  optional; a missing one just drops that provider from the failover chain.
- **`client/.env`** — only `VITE_API_URL`, and the defaults work as-is in development.

Only `VITE_`-prefixed variables reach the browser. **No key, secret or connection string
ever belongs in `client/.env`** — everything there is compiled into the bundle and is
readable by anyone who opens the page. All provider credentials stay server-side.

**No API keys?** It still runs — install [Ollama](https://ollama.com), `ollama pull llama3.2`, and the chain falls through to local inference. Set `DEMO=true` to serve recorded fixtures with no model at all.

**No Postgres?** Create a free [Neon](https://neon.tech) project and paste its connection string into `DATABASE_URL`. No code changes, no Docker.

---

## Stack

PostgreSQL (Drizzle ORM) · Express 5 · React 19 · TypeScript strict · TanStack Query/Table/Virtual · Axios · Tailwind + shadcn/ui · Vitest + Playwright + axe-core

## Project structure

Two self-contained projects. Each owns its dependencies, TypeScript config, ESLint
config and scripts — there is nothing shared at the repository root.

```
client/                 Vite + React 19                     → localhost:5173
├─ package.json         own deps and scripts
├─ eslint.config.js     own rules
├─ vite.config.ts       proxies /api → :3001, aliases @api
└─ src/

server/                 Express 5 + Drizzle + Postgres      → localhost:3001
├─ package.json         own deps and scripts
├─ eslint.config.js     own rules, including the MVC boundaries
├─ .env.example
└─ src/
   ├─ models/           data access only — every Drizzle query lives here
   ├─ views/            response shaping (DTOs)
   ├─ controllers/      thin: parse → service → view
   ├─ services/         business logic — AI router, analysis pipeline, statutes
   ├─ routes/           /api/v1 wiring
   ├─ middleware/       validation, errors, rate limits, uploads
   ├─ config/           environment, parsed once by Zod
   └─ types/            the API contract — see below

README.md               this file
```

**One contract, no duplication.** `server/src/types/` holds the Zod schemas and error
codes. The client compiles the very same files through an `@api` alias, so the API
contract cannot drift between the two projects and there is no third package to publish
or version. Two ESLint rules keep it honest: the client may not reach into `server/src`
by any other path, and `server/src/types` may not import Node built-ins, config or
server internals, since it ends up in the browser bundle.

**The architecture is machine-checked.** The MVC layering isn't a convention — ESLint
enforces it. Controllers cannot import models, services cannot import Express, and
models cannot import upward. Each rule was verified by planting a violation and watching
it fail.

Architecture notes, threat model and privacy policy arrive alongside the features they
describe.

---

## Status

Under active development. See the commit history for what has landed.
