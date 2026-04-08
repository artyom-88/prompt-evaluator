import Anthropic from '@anthropic-ai/sdk';
import type { ContentBlock, MessageParam, ToolUseBlock } from '@anthropic-ai/sdk/resources/messages/messages';

import type { AnthropicClientConfig, AnthropicRuntimeEnv, AnthropicTextClient } from '@/features/anthropic/anthropicTypes';

export const DEFAULT_ANTHROPIC_MODEL = 'claude-haiku-4-5';

export const DEFAULT_TEST_DATA_MAX_VALIDATION_ATTEMPTS = 2;

const fallbackEnv: AnthropicRuntimeEnv = {
  anthropicApiKey: '',
  anthropicModel: DEFAULT_ANTHROPIC_MODEL,
  testDataMaxValidationAttempts: `${DEFAULT_TEST_DATA_MAX_VALIDATION_ATTEMPTS}`,
  isDev: import.meta.env.DEV,
};

const runtimeEnv = (): AnthropicRuntimeEnv => (typeof __APP_ENV__ !== 'undefined' && __APP_ENV__ ? __APP_ENV__ : fallbackEnv);

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
        ? 'Missing Anthropic API key. Set ANTHROPIC_API_KEY in .env for local development.'
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
      const response = await client.messages.create(
        {
          model: config.model,
          max_tokens: maxTokens,
          system,
          messages: [{ role: 'user', content: prompt }],
        },
        { signal },
      );

      return collectText(response.content);
    },
    async completeWithTools({ system, prompt, maxTokens = 1200, maxToolCalls = 2, signal, tools }) {
      const messages: MessageParam[] = [{ role: 'user', content: prompt }];
      let toolCallCount = 0;

      for (;;) {
        if (signal?.aborted) {
          throw signal.reason ?? new DOMException('The request was aborted.', 'AbortError');
        }

        const response = await client.messages.create(
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
        );
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
