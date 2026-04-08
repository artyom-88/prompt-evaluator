import type { Tool } from '@anthropic-ai/sdk/resources/messages/messages';

export interface AnthropicRuntimeEnv {
  anthropicApiKey: string;
  anthropicModel: string;
  testDataMaxValidationAttempts: string;
  isDev: boolean;
}

export interface AnthropicClientConfig {
  apiKey: string;
  model: string;
  dangerouslyAllowBrowser: boolean;
  enabled: boolean;
  testDataMaxValidationAttempts: number;
}

export interface AnthropicClientTool {
  name: string;
  description: string;
  inputSchema: Tool.InputSchema;
  run(input: unknown): string;
}

export interface AnthropicTextClient {
  model: string;
  testDataMaxValidationAttempts: number;
  complete(input: { system?: string; prompt: string; maxTokens?: number; signal?: AbortSignal }): Promise<string>;
  completeWithTools(input: {
    system?: string;
    prompt: string;
    maxTokens?: number;
    maxToolCalls?: number;
    signal?: AbortSignal;
    tools: AnthropicClientTool[];
  }): Promise<string>;
}
