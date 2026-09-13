import Groq from 'groq-sdk';

import { parseJsonResponse } from '../json.js';
import { MODELS } from '../models.js';
import type { Provider, RawRequest } from '../types.js';

/**
 * Groq.
 *
 * Much faster than the others, but the free tier allows only 6,000 tokens per
 * minute — so the router never sends it a whole document (R2.10). It earns its
 * place on the per-clause stages, where it is the quickest option available.
 *
 * @param apiKey - Groq API key.
 * @returns A provider adapter.
 */
export function createGroqProvider(apiKey: string): Provider {
  const client = new Groq({ apiKey });

  return {
    id: 'groq',
    supportsFiles: false,

    async complete(req: RawRequest): Promise<unknown> {
      const response = await client.chat.completions.create({
        model: MODELS.groq,
        messages: [{ role: 'user', content: req.prompt }],
        temperature: req.temperature,
        response_format: { type: 'json_object' },
      });

      return parseJsonResponse(response.choices[0]?.message.content);
    },
  };
}
