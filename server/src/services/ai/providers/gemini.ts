import { GoogleGenAI } from '@google/genai';

import { parseJsonResponse } from '../json.js';
import { MODELS } from '../models.js';
import type { Provider, RawRequest } from '../types.js';

/**
 * Google Gemini.
 *
 * The primary provider, and the only one that reads a PDF or a photograph
 * directly. That matters more than it sounds: Indian rent agreements live on
 * stamp paper, photographed on a phone, often part-Devanagari. An OCR layer is
 * the usual place that breaks — so not having one is both simpler and more
 * robust.
 *
 * @param apiKey - Gemini API key.
 * @returns A provider adapter.
 */
export function createGeminiProvider(apiKey: string): Provider {
  const client = new GoogleGenAI({ apiKey });

  return {
    id: 'gemini',
    supportsFiles: true,

    async complete(req: RawRequest): Promise<unknown> {
      const parts: object[] = [{ text: req.prompt }];

      if (req.file !== undefined) {
        parts.unshift({
          inlineData: {
            mimeType: req.file.mimeType,
            data: Buffer.from(req.file.bytes).toString('base64'),
          },
        });
      }

      const response = await client.models.generateContent({
        model: MODELS.gemini,
        contents: [{ role: 'user', parts }],
        config: {
          temperature: req.temperature,
          responseMimeType: 'application/json',
        },
      });

      return parseJsonResponse(response.text);
    },
  };
}
