/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_ANTHROPIC_API_KEY?: string;
  readonly VITE_ANTHROPIC_MODEL?: string;
  readonly VITE_ANTHROPIC_TEST_DATA_MAX_VALIDATION_ATTEMPTS?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
