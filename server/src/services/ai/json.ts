/**
 * Parse a model's reply as JSON.
 *
 * Every provider is asked for strict JSON and most obey, but all of them
 * occasionally wrap the object in a markdown fence or add a line of preamble —
 * more often on the smaller and local models, which is exactly where the
 * failover chain ends up. Stripping that here means one place handles it
 * instead of four adapters each half-handling it.
 *
 * Returning `undefined` rather than throwing lets the router treat an
 * unparseable reply as a `parse_error`, which earns one retry on the same
 * provider before falling through.
 *
 * @param raw - The model's text response.
 * @returns The parsed value, or undefined if nothing JSON-shaped was found.
 */
export function parseJsonResponse(raw: string | null | undefined): unknown {
  if (raw === null || raw === undefined) return undefined;

  const text = raw.trim();
  if (text === '') return undefined;

  const candidates = [text, stripFence(text), extractBraces(text)];

  for (const candidate of candidates) {
    if (candidate === undefined) continue;
    try {
      return JSON.parse(candidate);
    } catch {
      // Try the next shape.
    }
  }
  return undefined;
}

/** Remove a ```json … ``` wrapper, which models add despite being told not to. */
function stripFence(text: string): string | undefined {
  const match = /^```(?:json)?\s*\n?([\s\S]*?)\n?```$/.exec(text);
  return match?.[1]?.trim();
}

/** Last resort: take the outermost braces, ignoring any prose around them. */
function extractBraces(text: string): string | undefined {
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  return start !== -1 && end > start ? text.slice(start, end + 1) : undefined;
}
