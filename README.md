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

| Problem statement bullet | Feature | Implementation | Test |
| --- | --- | --- | --- |
| Simplifying complex legal documents | Every finding restated in plain English, plus a three-sentence summary of the whole document | `stages/extract.ts`, `stages/act.ts` | `pipeline.test.ts`, `followups.test.ts` |
| Comparing contracts, agreements, or policies | Substantive diff between two versions — cosmetic edits ignored, each change labelled by who it favours, with a net balance shift | `stages/compare.ts` | `followups.test.ts` |
| Highlighting clauses, obligations, risks, inconsistencies | Span-anchored findings by severity, and a who-owes-what-by-when table, both streamed as they are verified | `stages/extract.ts`, `stages/obligations.ts`, `stages/verify.ts` | `verify.test.ts`, `pipeline.test.ts` |
| Answering questions based on provided documents | Answers drawn only from the uploaded document, anchored to the text they rest on — or an explicit "it does not say" | `stages/ask.ts` | `followups.test.ts` |
| Understanding options and potential next steps | Options with upside, downside and the actual forum for each. Deliberately unranked: information, not advice | `stages/options.ts` | `followups.test.ts` |
| Summaries, checklists, actionable outputs | Pre-signing checklist, redline wording per clause, and a message short enough to send | `stages/act.ts` | `followups.test.ts` |
| Preparing information or questions for a legal professional | Facts in order, documents to bring, and questions drawn from this contract rather than a generic list | `stages/brief.ts` | `followups.test.ts` |

### Beyond the brief

|                            |                                                                                                                                                             |
| -------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Span anchoring**         | Every finding carries `{quote, charStart, charEnd}`. Click one and the exact words highlight in your document.                                              |
| **Self-audit**             | Any claim whose quote isn't verbatim in the source is struck through, not hidden. Deterministic string containment, not a second model — it cannot be talked around. |
| **Statutes as data**       | Provisions ship in the repo with their own words quoted. The model may only pick an id from that file, so a fabricated citation has no route to a reader — including the clauses that are **void regardless of signature**. |
| **Jurisdiction honesty**   | A _model_ act is never cited as binding in a state we cannot confirm has adopted it — it carries a caveat instead of a claim. |
| **Reads a photograph**     | Stamp-paper agreements photographed on a phone go straight to the model. No OCR layer to break.                                                             |
| **Four-provider failover** | Gemini → Groq → Mistral → Ollama, with a circuit breaker and token-budget routing. A provider whose free-tier ceiling a request exceeds is skipped rather than sent a doomed call. |

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

**You need at least one provider key.** Every provider is a hosted service, so with none set the
server starts and serves health, but each analysis fails cleanly with `ALL_PROVIDERS_FAILED`.
Start with [Gemini](https://aistudio.google.com/apikey) — free, no card, and the only provider
that reads PDFs and photographs. `/api/v1/health/providers` shows what is live.

Free tiers for the rest: [Groq](https://console.groq.com/keys), [Mistral](https://console.mistral.ai/api-keys),
[Ollama](https://ollama.com/settings/keys). `OLLAMA_MODEL` overrides the model tag, because that
catalogue changes faster than anything else here — `GET https://ollama.com/v1/models` lists what
your key can reach.

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
