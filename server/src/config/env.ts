import { config as loadDotenv } from 'dotenv';
import { z } from 'zod';

/**
 * An optional value where blank counts as absent.
 *
 * `.env.example` ships every key present but empty, so a copied `.env` gives
 * dotenv `GEMINI_API_KEY=""`. Without this, an empty string fails `.min(1)` and
 * the server refuses to boot — which would break the whole point of the keys
 * being optional. Blank and missing must mean the same thing: no provider.
 *
 * @param inner - The schema to apply when a real value is present.
 */
function blankAsAbsent<T extends z.ZodType>(inner: T): z.ZodOptional<T> {
  return z.preprocess(
    (value) => (typeof value === 'string' && value.trim() === '' ? undefined : value),
    inner.optional(),
  ) as unknown as z.ZodOptional<T>;
}

/**
 * Environment schema. Parsed exactly once, at boot.
 *
 * Two deliberate choices:
 *  - Every AI provider key is optional. A missing key means that provider is
 *    simply absent from the failover chain (R2.8) — never a crash. The app must
 *    run with zero keys set.
 *  - Malformed config fails loudly at startup rather than at request time, so a
 *    typo surfaces in one second instead of during a demo.
 */
const EnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(3001),
  LOG_LEVEL: z.enum(['silent', 'fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),

  /** Local Postgres or Neon — the only thing that changes between them (R12.1). */
  DATABASE_URL: z.url(),
  /** Neon only: the unpooled host. drizzle-kit needs it for migrations (R12.3). */
  DIRECT_DATABASE_URL: blankAsAbsent(z.url()),

  CORS_ORIGIN: z.string().default('http://localhost:5173'),

  /** Serve recorded fixtures instead of calling providers. Demo + CI insurance (R13.2). */
  DEMO: z
    .enum(['true', 'false'])
    .default('false')
    .transform((v) => v === 'true'),

  // --- AI providers: all optional (R2.8) ---
  GEMINI_API_KEY: blankAsAbsent(z.string().min(1)),
  GROQ_API_KEY: blankAsAbsent(z.string().min(1)),
  MISTRAL_API_KEY: blankAsAbsent(z.string().min(1)),
  OLLAMA_BASE_URL: z.url().default('http://localhost:11434'),

  // --- Storage: optional. Absent means in-memory only, which is a valid mode (R3.9) ---
  CLOUDINARY_CLOUD_NAME: blankAsAbsent(z.string().min(1)),
  CLOUDINARY_API_KEY: blankAsAbsent(z.string().min(1)),
  CLOUDINARY_API_SECRET: blankAsAbsent(z.string().min(1)),
});

export type Env = z.infer<typeof EnvSchema>;

/**
 * Parse `process.env` against the schema, or exit with a readable report.
 *
 * @param source - Raw environment values. Defaults to `process.env`; injectable for tests.
 * @returns The validated, typed environment.
 * @throws {Error} If validation fails and `NODE_ENV` is `test` (so tests can assert on it).
 */
export function parseEnv(source: NodeJS.ProcessEnv = process.env): Env {
  const result = EnvSchema.safeParse(source);

  if (!result.success) {
    const report = z.prettifyError(result.error);
    if (source.NODE_ENV === 'test') {
      throw new Error(`Invalid environment:\n${report}`);
    }
    console.error(
      `\nInvalid environment:\n${report}\n\nSee .env.example for what each value should look like.\n`,
    );
    process.exit(1);
  }

  return result.data;
}

let cached: Env | undefined;

/**
 * The validated environment, parsed on first access and memoised.
 *
 * Deliberately lazy: importing this module must not have side effects, or the
 * config becomes untestable and every test file needs a full environment. The
 * server calls this once at startup so a bad value still fails loudly at boot
 * rather than mid-request.
 *
 * @returns The validated, typed environment.
 */
export function getEnv(): Env {
  if (cached === undefined) {
    // dotenv never overwrites values already in the environment, so a real
    // deployment's variables always win over a stray .env file.
    loadDotenv({ quiet: true });
    cached = parseEnv();
  }
  return cached;
}

/** Drop the memoised environment. Tests only. */
export function resetEnvCache(): void {
  cached = undefined;
}
