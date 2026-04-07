/// <reference types="vite/client" />

declare const __APP_ENV__:
  | {
      anthropicApiKey: string;
      anthropicModel: string;
      testDataMaxValidationAttempts: string;
      isDev: boolean;
    }
  | undefined;
