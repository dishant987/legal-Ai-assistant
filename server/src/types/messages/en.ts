import type { ErrorCode } from '../errors.js';

/**
 * What users actually read when something fails.
 *
 * Every message follows the same shape: **what happened → why → what to do
 * next** (R4.7). No status codes, no exception names, no blame. A person who
 * hits one of these should know whether to wait, retry, or change something.
 *
 * Typed as a complete record, so adding an error code without a message is a
 * compile error rather than a blank dialog in production.
 */
export const en: Record<ErrorCode, string> = {
  VALIDATION_FAILED:
    "Some of what you sent didn't look right. The details are marked on the fields below — fix those and try again.",

  NOT_FOUND:
    "We couldn't find that. Documents are deleted automatically after 24 hours, so if this was from yesterday it's already gone. Upload it again to start fresh.",

  RATE_LIMITED:
    "You've used up this hour's free analyses. The limit keeps the service free for everyone. Your last result is still on screen, and the limit resets within the hour.",

  FILE_TOO_LARGE:
    'That file is bigger than the 10 MB limit. Exporting the PDF at a lower quality, or splitting it into the pages that matter, usually gets it under.',

  UNSUPPORTED_TYPE:
    'We can read PDFs, Word documents, plain text, and photos. That file was something else — if it came in a zip or an email attachment, try opening it and uploading the document inside.',

  NO_TEXT_FOUND:
    "We couldn't find any readable text in that file. If it's a photo of paper, take another in brighter light with the page filling the frame and no shadow across it.",

  ALL_PROVIDERS_FAILED:
    'All of our AI services are unreachable right now. Nothing was lost and your document is safe. Try again in a minute — we automatically use whichever service comes back first.',

  PROVIDER_DEGRADED:
    'Our usual AI service is slow right now, so we used a backup instead. The analysis is complete and every finding still points at your document — the source is labelled on each one.',

  STORAGE_FAILED:
    "We couldn't save a copy of your file, so your analysis ran from memory instead. The results below are complete, but you won't be able to reopen this document later.",

  DATABASE_ERROR:
    'We had trouble reaching our database. This is on our side, not yours. Please try again in a moment.',

  INTERNAL:
    'Something went wrong on our side. Nothing you did caused it. Try again, and if it keeps happening the reference code below will help us find what broke.',
};
