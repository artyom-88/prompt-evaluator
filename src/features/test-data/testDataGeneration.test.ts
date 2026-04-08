import { describe, expect, it, vi } from 'vitest';

import type { AnthropicTextClient } from '@/features/anthropic/anthropicTypes';
import { generateTestRecords, validateTestData } from '@/features/test-data/testDataGeneration';

describe('test data validation', () => {
  const recordSchemaText = JSON.stringify({
    type: 'object',
    properties: {
      content: { type: 'string' },
    },
    required: ['content'],
    additionalProperties: false,
  });

  it('validates generated records against schema and record count', () => {
    expect(
      validateTestData({
        candidate: [{ content: 'valid' }],
        recordSchemaText,
        expectedRecordCount: 1,
      }),
    ).toEqual({
      valid: true,
      recordCount: 1,
      errors: [],
    });
  });

  it('returns actionable validation errors for malformed records', () => {
    const result = validateTestData({
      candidate: [{ title: 'missing content' }],
      recordSchemaText,
      expectedRecordCount: 2,
    });

    expect(result.valid).toBe(false);
    expect(result.errors.join(' ')).toContain('Expected 2 records but received 1.');
    expect(result.errors.join(' ')).toContain("must have required property 'content'");
  });

  it('lets Claude call the validation tool before returning final records', async () => {
    const client: AnthropicTextClient = {
      model: 'test-model',
      testDataMaxValidationAttempts: 2,
      complete: vi.fn(),
      completeWithTools: vi.fn(async ({ tools }) => {
        const toolResult = JSON.parse(tools[0].run({ records: [{ content: 'valid' }] }));
        expect(toolResult.valid).toBe(true);
        return JSON.stringify([{ content: 'valid' }]);
      }),
    };

    await expect(
      generateTestRecords({
        client,
        scenarioDescription: 'Generate content records.',
        recordSchemaText,
        recordCount: 1,
        generationConstraints: '',
      }),
    ).resolves.toEqual([{ content: 'valid' }]);
  });

  it('fails when validation does not succeed within the configured attempts', async () => {
    const client: AnthropicTextClient = {
      model: 'test-model',
      testDataMaxValidationAttempts: 2,
      complete: vi.fn(),
      completeWithTools: vi.fn(async ({ tools }) => {
        tools[0].run({ records: [{ title: 'invalid' }] });
        tools[0].run({ records: [{ title: 'still invalid' }] });
        return JSON.stringify([{ content: 'unreachable' }]);
      }),
    };

    await expect(
      generateTestRecords({
        client,
        scenarioDescription: 'Generate content records.',
        recordSchemaText,
        recordCount: 1,
        generationConstraints: '',
      }),
    ).rejects.toThrow('Generated test data failed validation after 2 attempts');
  });
});
