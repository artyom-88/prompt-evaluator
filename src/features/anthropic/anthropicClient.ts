import Anthropic from '@anthropic-ai/sdk';
import type { ContentBlock, MessageParam, ToolUseBlock } from '@anthropic-ai/sdk/resources/messages/messages';

import type { AnthropicClientConfig, AnthropicRuntimeEnv, AnthropicTextClient } from '@/features/anthropic/anthropicTypes';

export const DEFAULT_ANTHROPIC_MODEL = 'claude-haiku-4-5';

export const DEFAULT_TEST_DATA_MAX_VALIDATION_ATTEMPTS = 2;

const fallbackEnv: AnthropicRuntimeEnv = {
  anthropicApiKey: import.meta.env.VITE_ANTHROPIC_API_KEY ?? '',
  anthropicModel: import.meta.env.VITE_ANTHROPIC_MODEL ?? DEFAULT_ANTHROPIC_MODEL,
  testDataMaxValidationAttempts:
    import.meta.env.VITE_ANTHROPIC_TEST_DATA_MAX_VALIDATION_ATTEMPTS ?? `${DEFAULT_TEST_DATA_MAX_VALIDATION_ATTEMPTS}`,
  isDev: import.meta.env.DEV,
};

const runtimeEnv = (): AnthropicRuntimeEnv => fallbackEnv;

export const parseTestDataMaxValidationAttempts = (value: string | number | undefined): number => {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : DEFAULT_TEST_DATA_MAX_VALIDATION_ATTEMPTS;
};

export const resolveAnthropicClientConfig = (env: AnthropicRuntimeEnv = runtimeEnv()): AnthropicClientConfig => {
  const model = env.anthropicModel.trim() || DEFAULT_ANTHROPIC_MODEL;
  const apiKey = env.isDev ? env.anthropicApiKey.trim() : '';

  return {
    apiKey,
    model,
    dangerouslyAllowBrowser: env.isDev,
    enabled: env.isDev && apiKey.length > 0,
    testDataMaxValidationAttempts: parseTestDataMaxValidationAttempts(env.testDataMaxValidationAttempts),
  };
};

export const toAnthropicClientError = (error: unknown): Error => {
  if (error instanceof Error && 'status' in error && error.status === 401) {
    return new Error(
      'Anthropic API authentication failed (401 Unauthorized). Check VITE_ANTHROPIC_API_KEY in your local .env and restart pnpm dev after changing env values.',
    );
  }

  if (error instanceof Error) {
    return error;
  }

  return new Error('Anthropic request failed.');
};

const collectText = (content: ContentBlock[]): string =>
  content
    .filter((block) => block.type === 'text')
    .map((block) => block.text)
    .join('\n')
    .trim();

const isToolUseBlock = (block: ContentBlock): block is ToolUseBlock => block.type === 'tool_use';

export const createAnthropicTextClient = (env: AnthropicRuntimeEnv = runtimeEnv()): AnthropicTextClient => {
  const config = resolveAnthropicClientConfig(env);

  if (!config.enabled) {
    throw new Error(
      config.dangerouslyAllowBrowser
        ? 'Missing Anthropic API key. Set VITE_ANTHROPIC_API_KEY in .env for local development.'
        : 'Anthropic browser calls are disabled outside the Vite dev server.',
    );
  }

  const client = new Anthropic({
    apiKey: config.apiKey,
    dangerouslyAllowBrowser: config.dangerouslyAllowBrowser,
  });

  return {
    model: config.model,
    testDataMaxValidationAttempts: config.testDataMaxValidationAttempts,
    async complete({ system, prompt, maxTokens = 1200, signal }) {
      const response = await client.messages
        .create(
          {
            model: config.model,
            max_tokens: maxTokens,
            system,
            messages: [{ role: 'user', content: prompt }],
          },
          { signal },
        )
        .catch((error: unknown) => {
          throw toAnthropicClientError(error);
        });

      return collectText(response.content);
    },
    async completeWithTools({ system, prompt, maxTokens = 1200, maxToolCalls = 2, signal, tools }) {
      const messages: MessageParam[] = [{ role: 'user', content: prompt }];
      let toolCallCount = 0;

      for (;;) {
        if (signal?.aborted) {
          throw signal.reason ?? new DOMException('The request was aborted.', 'AbortError');
        }

        const response = await client.messages
          .create(
            {
              model: config.model,
              max_tokens: maxTokens,
              system,
              messages,
              tool_choice: { type: 'auto', disable_parallel_tool_use: true },
              tools: tools.map((tool) => ({
                name: tool.name,
                description: tool.description,
                input_schema: tool.inputSchema,
              })),
            },
            { signal },
          )
          .catch((error: unknown) => {
            throw toAnthropicClientError(error);
          });

        const toolUses = response.content.filter(isToolUseBlock);

        if (toolUses.length === 0) {
          return collectText(response.content);
        }

        messages.push({ role: 'assistant', content: response.content });

        const toolResults = toolUses.map((toolUse) => {
          toolCallCount += 1;

          if (toolCallCount > maxToolCalls) {
            return {
              type: 'tool_result' as const,
              tool_use_id: toolUse.id,
              is_error: true,
              content: `The maximum validation tool call count of ${maxToolCalls} was exceeded.`,
            };
          }

          const tool = tools.find((candidate) => candidate.name === toolUse.name);
          if (!tool) {
            return {
              type: 'tool_result' as const,
              tool_use_id: toolUse.id,
              is_error: true,
              content: `Unknown tool: ${toolUse.name}`,
            };
          }

          return {
            type: 'tool_result' as const,
            tool_use_id: toolUse.id,
            content: tool.run(toolUse.input),
          };
        });

        if (toolCallCount > maxToolCalls) {
          throw new Error(`Claude exceeded the maximum validation tool call count of ${maxToolCalls}.`);
        }

        messages.push({ role: 'user', content: toolResults });
      }
    },
  };
};
