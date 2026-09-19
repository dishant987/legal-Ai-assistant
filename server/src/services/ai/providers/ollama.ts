import { Ollama } from 'ollama';

import { parseJsonResponse } from '../json.js';
import { MODELS, OLLAMA_HOST } from '../models.js';
import type { Provider, RawRequest } from '../types.js';

/**
 * Ollama's hosted API.
 *
 * Cloud only — there is no local daemon mode. That makes Ollama symmetric with
 * the other three: an API key puts it in the chain, and its absence leaves it
 * out. It sits last because it is the deepest fallback, not because it is
 * weakest; the hosted models are large.
 *
 * @param apiKey - Ollama API key, from ollama.com/settings/keys.
 * @param model - Optional tag override. Defaults to the shared model table.
 * @returns A provider adapter.
 */
export function createOllamaProvider(apiKey: string, model?: string): Provider {
  const client = new Ollama({
    host: OLLAMA_HOST,
    headers: { Authorization: `Bearer ${apiKey}` },
  });

  return {
    id: 'ollama',
    supportsFiles: false,

    async complete(req: RawRequest): Promise<unknown> {
      const response = await client.chat({
        model: model ?? MODELS.ollama,
        messages: [{ role: 'user', content: req.prompt }],
        format: 'json',
        options: { temperature: req.temperature },
      });

      return parseJsonResponse(response.message.content);
    },
  };
}
