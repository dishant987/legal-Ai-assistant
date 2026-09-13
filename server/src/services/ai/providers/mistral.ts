import { Mistral } from '@mistralai/mistralai';

import { parseJsonResponse } from '../json.js';
import { MODELS } from '../models.js';
import type { Provider, RawRequest } from '../types.js';

/**
 * Mistral.
 *
 * Second failover, and the one that actually carries whole-document stages when
 * Gemini is down: a 40,000 token-per-minute free tier is enough for a contract,
 * where Groq's 6,000 is not.
 *
 * @param apiKey - Mistral API key.
 * @returns A provider adapter.
 */
export function createMistralProvider(apiKey: string): Provider {
  const client = new Mistral({ apiKey });

  return {
    id: 'mistral',
    supportsFiles: false,

    async complete(req: RawRequest): Promise<unknown> {
      const response = await client.chat.complete({
        model: MODELS.mistral,
        messages: [{ role: 'user', content: req.prompt }],
        temperature: req.temperature,
        responseFormat: { type: 'json_object' },
      });

      const content = response.choices[0]?.message?.content;
      // The SDK can return content as an array of chunks rather than a string.
      const text =
        typeof content === 'string'
          ? content
          : Array.isArray(content)
            ? content.map((c) => ('text' in c ? c.text : '')).join('')
            : undefined;

      return parseJsonResponse(text);
    },
  };
}
