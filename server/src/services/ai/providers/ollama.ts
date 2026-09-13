import { Ollama } from 'ollama';

import { parseJsonResponse } from '../json.js';
import { MODELS } from '../models.js';
import type { Provider, RawRequest } from '../types.js';

/**
 * Ollama — local inference.
 *
 * Always in the chain, because it needs no key. It is the reason the app runs
 * with zero cloud credentials and the reason a demo survives a dead network.
 *
 * It is also the weakest link, and honestly so: a small local model asked for
 * forty schema-valid findings from a twenty-page contract will often fall
 * short. The router marks anything it serves as degraded, and the UI says as
 * much rather than passing a thin answer off as a full one (R2.11).
 *
 * @param host - Base URL of the local Ollama server.
 * @returns A provider adapter.
 */
export function createOllamaProvider(host: string): Provider {
  const client = new Ollama({ host });

  return {
    id: 'ollama',
    supportsFiles: false,

    async complete(req: RawRequest): Promise<unknown> {
      const response = await client.chat({
        model: MODELS.ollama,
        messages: [{ role: 'user', content: req.prompt }],
        format: 'json',
        options: { temperature: req.temperature },
      });

      return parseJsonResponse(response.message.content);
    },
  };
}
