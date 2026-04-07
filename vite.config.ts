/// <reference types="vitest" />
import { fileURLToPath, URL } from 'node:url';

import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig, loadEnv } from 'vite';

const DEFAULT_MODEL = 'claude-haiku-4-5';
const DEFAULT_TEST_DATA_MAX_VALIDATION_ATTEMPTS = '2';

export default defineConfig(({ command, mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const isDevServer = command === 'serve';

  return {
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        '@': fileURLToPath(new URL('./src', import.meta.url)),
      },
    },
    define: {
      __APP_ENV__: JSON.stringify({
        anthropicApiKey: isDevServer ? (env.ANTHROPIC_API_KEY ?? env.VITE_ANTHROPIC_API_KEY ?? '') : '',
        anthropicModel: env.ANTHROPIC_MODEL ?? env.VITE_ANTHROPIC_MODEL ?? DEFAULT_MODEL,
        testDataMaxValidationAttempts:
          env.ANTHROPIC_TEST_DATA_MAX_VALIDATION_ATTEMPTS ??
          env.VITE_ANTHROPIC_TEST_DATA_MAX_VALIDATION_ATTEMPTS ??
          DEFAULT_TEST_DATA_MAX_VALIDATION_ATTEMPTS,
        isDev: isDevServer,
      }),
    },
    test: {
      css: true,
      environment: 'jsdom',
      globals: true,
      setupFiles: './src/test/setup.ts',
    },
  };
});
