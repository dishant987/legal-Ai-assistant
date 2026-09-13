import { Ollama } from 'ollama';

import { parseJsonResponse } from '../json.js';
import type { Provider, RawRequest } from '../types.js';

import { resolveOllama, type OllamaConfig, type OllamaEnv } from './ollamaConfig.js';

/**
 * Ollama, local or hosted.
 *
 * Always in the chain, because local Ollama needs no key at all — that is what
 * lets the app run with zero credentials and survive a dead network.
 *
 * With OLLAMA_API_KEY set it talks to Ollama's hosted API instead, which is a
 * different proposition: a large model rather than whatever fits on the
 * laptop. The two share an id because they are the same provider from the
 * router's point of view; `mode` is what the health endpoint reports so the UI
 * can tell an honest story about which one answered.
 *
 * @param env - Ollama-related environment values.
 * @returns A provider adapter, plus the resolved configuration.
 */
export function createOllamaProvider(env: OllamaEnv): Provider & { config: OllamaConfig } {
  const config = resolveOllama(env);
  const client = new Ollama({ host: config.host, headers: config.headers });

  return {
    id: 'ollama',
    supportsFiles: false,
    config,

    async complete(req: RawRequest): Promise<unknown> {
      const response = await client.chat({
        model: config.model,
        messages: [{ role: 'user', content: req.prompt }],
        format: 'json',
        options: { temperature: req.temperature },
      });

      return parseJsonResponse(response.message.content);
    },
  };
}
