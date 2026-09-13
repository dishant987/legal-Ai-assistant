/// <reference types="vite/client" />

/**
 * Typed client environment.
 *
 * Only `VITE_`-prefixed values exist here — Vite refuses to expose anything
 * else to the browser, which is what keeps server secrets out of the bundle.
 */
interface ImportMetaEnv {
  readonly VITE_API_URL: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
