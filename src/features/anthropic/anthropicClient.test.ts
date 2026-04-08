import { describe, expect, it } from 'vitest';

import {
  DEFAULT_ANTHROPIC_MODEL,
  DEFAULT_TEST_DATA_MAX_VALIDATION_ATTEMPTS,
  parseTestDataMaxValidationAttempts,
  resolveAnthropicClientConfig,
  toAnthropicClientError,
} from '@/features/anthropic/anthropicClient';

describe('resolveAnthropicClientConfig', () => {
  it('enables browser calls only in dev when an API key exists', () => {
    expect(
      resolveAnthropicClientConfig({
        anthropicApiKey: 'key',
        anthropicModel: 'claude-haiku-4-5',
        testDataMaxValidationAttempts: '3',
        isDev: true,
      }),
    ).toMatchObject({
      apiKey: 'key',
      model: 'claude-haiku-4-5',
      dangerouslyAllowBrowser: true,
      enabled: true,
      testDataMaxValidationAttempts: 3,
    });
  });

  it('fails closed outside dev', () => {
    expect(
      resolveAnthropicClientConfig({
        anthropicApiKey: 'key',
        anthropicModel: 'claude-opus-4-5',
        testDataMaxValidationAttempts: '2',
        isDev: false,
      }),
    ).toMatchObject({
      apiKey: '',
      model: 'claude-opus-4-5',
      dangerouslyAllowBrowser: false,
      enabled: false,
      testDataMaxValidationAttempts: 2,
    });
  });

  it('uses the default Haiku alias when no model is configured', () => {
    expect(
      resolveAnthropicClientConfig({
        anthropicApiKey: 'key',
        anthropicModel: '',
        testDataMaxValidationAttempts: '2',
        isDev: true,
      }).model,
    ).toBe(DEFAULT_ANTHROPIC_MODEL);
  });

  it('uses the default validation attempt count for invalid values', () => {
    expect(parseTestDataMaxValidationAttempts(undefined)).toBe(DEFAULT_TEST_DATA_MAX_VALIDATION_ATTEMPTS);
    expect(parseTestDataMaxValidationAttempts('0')).toBe(DEFAULT_TEST_DATA_MAX_VALIDATION_ATTEMPTS);
    expect(parseTestDataMaxValidationAttempts('-1')).toBe(DEFAULT_TEST_DATA_MAX_VALIDATION_ATTEMPTS);
    expect(parseTestDataMaxValidationAttempts('abc')).toBe(DEFAULT_TEST_DATA_MAX_VALIDATION_ATTEMPTS);
  });

  it('turns Anthropic 401 responses into a clearer auth error', () => {
    const error = Object.assign(new Error('unauthorized'), { status: 401 });

    expect(toAnthropicClientError(error).message).toContain('VITE_ANTHROPIC_API_KEY');
  });
});
