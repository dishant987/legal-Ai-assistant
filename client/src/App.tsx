import { ERROR_CODES } from '@api/errors.js';

/**
 * Placeholder shell. The real layout — document pane, findings list, verdict
 * columns — lands in Step 8; the theme and component library in Step 7.
 *
 * It renders the shared error vocabulary purely to prove the `@shared` alias:
 * these strings come from the same file the server validates against, so a
 * drift between client and API is a compile error rather than a runtime bug.
 */
export default function App(): React.JSX.Element {
  return (
    <main>
      <h1>Legal AI Assistant</h1>
      <p>
        Every finding points at the exact words that caused it. Scaffold only — the document view arrives in
        Step 8.
      </p>
      <p>Sharing {ERROR_CODES.length} error codes with the API, from a single source of truth.</p>
    </main>
  );
}
