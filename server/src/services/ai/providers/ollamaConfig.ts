export type OllamaMode = 'local' | 'cloud';

export interface OllamaConfig {
  mode: OllamaMode;
  host: string;
  model: string;
  headers: Record<string, string>;
}

/** Ollama's hosted endpoint. */
export const OLLAMA_CLOUD_HOST = 'https://ollama.com';
const LOCAL_HOST_DEFAULT = 'http://localhost:11434';

/** Small enough to run on a laptop. Weak, and the UI says so. */
const LOCAL_MODEL_DEFAULT = 'llama3.2';
/**
 * Cloud default.
 *
 * Ollama's hosted catalogue churns faster than anything else here, so this is
 * overridable with OLLAMA_MODEL. A wrong tag is then a one-line `.env` fix
 * rather than a code change and a redeploy.
 */
const CLOUD_MODEL_DEFAULT = 'gpt-oss:120b-cloud';

export interface OllamaEnv {
  OLLAMA_BASE_URL: string;
  OLLAMA_API_KEY?: string | undefined;
  OLLAMA_MODEL?: string | undefined;
}

/**
 * Decide whether Ollama runs locally or against the hosted API.
 *
 * Presence of an API key is the switch. If a key is set but the base URL is
 * still the local default, the URL is assumed to be left over from local
 * development and the cloud host wins — otherwise the key would be sent to
 * localhost, which fails confusingly. An explicitly different URL is respected,
 * so a self-hosted instance behind an auth proxy still works.
 *
 * Kept free of config and SDK imports so it can be tested on its own.
 *
 * @param env - The relevant environment values.
 * @returns Host, model, headers and which mode was chosen.
 */
export function resolveOllama(env: OllamaEnv): OllamaConfig {
  const apiKey = env.OLLAMA_API_KEY?.trim();
  const hasKey = apiKey !== undefined && apiKey !== '';

  if (!hasKey) {
    return {
      mode: 'local',
      host: env.OLLAMA_BASE_URL,
      model: env.OLLAMA_MODEL ?? LOCAL_MODEL_DEFAULT,
      headers: {},
    };
  }

  const host = env.OLLAMA_BASE_URL === LOCAL_HOST_DEFAULT ? OLLAMA_CLOUD_HOST : env.OLLAMA_BASE_URL;

  return {
    mode: 'cloud',
    host,
    model: env.OLLAMA_MODEL ?? CLOUD_MODEL_DEFAULT,
    headers: { Authorization: `Bearer ${apiKey}` },
  };
}
