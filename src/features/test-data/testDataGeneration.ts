import Ajv from 'ajv';

import type { AnthropicClientTool, AnthropicTextClient } from '@/features/anthropic/anthropicClient';
import type { JsonObject } from '@/features/workspace/workspaceStore';

const ajv = new Ajv({ allErrors: true, strict: false });

export interface TestDataValidationResult {
  valid: boolean;
  recordCount: number;
  errors: string[];
}

export function extractJson(text: string): unknown {
  const trimmed = text.trim();

  try {
    return JSON.parse(trimmed);
  } catch {
    const fencedMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
    if (fencedMatch) {
      return JSON.parse(fencedMatch[1]);
    }

    const firstArray = trimmed.indexOf('[');
    const lastArray = trimmed.lastIndexOf(']');
    if (firstArray >= 0 && lastArray > firstArray) {
      return JSON.parse(trimmed.slice(firstArray, lastArray + 1));
    }

    const firstObject = trimmed.indexOf('{');
    const lastObject = trimmed.lastIndexOf('}');
    if (firstObject >= 0 && lastObject > firstObject) {
      return JSON.parse(trimmed.slice(firstObject, lastObject + 1));
    }

    throw new Error('Response did not contain valid JSON.');
  }
}

function isJsonObject(value: unknown): value is JsonObject {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

export function validateTestData(input: {
  candidate: unknown;
  recordSchemaText: string;
  expectedRecordCount: number;
}): TestDataValidationResult {
  const errors: string[] = [];
  const schema = JSON.parse(input.recordSchemaText);
  const validate = ajv.compile(schema);

  if (!Array.isArray(input.candidate)) {
    return {
      valid: false,
      recordCount: 0,
      errors: ['Generated test data must be a JSON array.'],
    };
  }

  if (input.candidate.length !== input.expectedRecordCount) {
    errors.push(`Expected ${input.expectedRecordCount} records but received ${input.candidate.length}.`);
  }

  for (const [index, record] of input.candidate.entries()) {
    if (!isJsonObject(record)) {
      errors.push(`Record ${index + 1} must be a JSON object.`);
      continue;
    }

    if (!validate(record)) {
      for (const error of validate.errors ?? []) {
        const path = error.instancePath || '/';
        errors.push(`Record ${index + 1} ${path}: ${error.message ?? 'does not match schema'}.`);
      }
    }
  }

  return {
    valid: errors.length === 0,
    recordCount: input.candidate.length,
    errors,
  };
}

function assertValidTestRecords(input: {
  candidate: unknown;
  recordSchemaText: string;
  expectedRecordCount: number;
}): JsonObject[] {
  const validation = validateTestData(input);

  if (!validation.valid) {
    throw new Error(`Generated test data failed validation: ${validation.errors.join(' ')}`);
  }

  return input.candidate as JsonObject[];
}

function createValidateTestDataTool(input: {
  recordSchemaText: string;
  expectedRecordCount: number;
  maxValidationAttempts: number;
}): AnthropicClientTool {
  let validationAttemptCount = 0;

  return {
    name: 'validate_test_data',
    description:
      'Validate candidate generated test records against the user-provided JSON Schema and required record count. Always call this tool before providing the final JSON array. If the result is invalid, repair the records and call the tool again.',
    inputSchema: {
      type: 'object',
      properties: {
        records: {
          type: 'array',
          description: 'The candidate generated test records to validate.',
        },
      },
      required: ['records'],
      additionalProperties: false,
    },
    run(toolInput) {
      validationAttemptCount += 1;
      const records = isJsonObject(toolInput) ? toolInput.records : undefined;
      const validation = validateTestData({
        candidate: records,
        recordSchemaText: input.recordSchemaText,
        expectedRecordCount: input.expectedRecordCount,
      });

      if (!validation.valid && validationAttemptCount >= input.maxValidationAttempts) {
        throw new Error(
          `Generated test data failed validation after ${validationAttemptCount} attempts: ${validation.errors.join(' ')}`,
        );
      }

      return JSON.stringify(validation);
    },
  };
}

export async function generateTestRecords(input: {
  client: AnthropicTextClient;
  scenarioDescription: string;
  recordSchemaText: string;
  recordCount: number;
  generationConstraints: string;
}): Promise<JsonObject[]> {
  JSON.parse(input.recordSchemaText);
  const response = await input.client.completeWithTools({
    maxTokens: 3000,
    maxToolCalls: input.client.testDataMaxValidationAttempts,
    tools: [
      createValidateTestDataTool({
        recordSchemaText: input.recordSchemaText,
        expectedRecordCount: input.recordCount,
        maxValidationAttempts: input.client.testDataMaxValidationAttempts,
      }),
    ],
    system:
      'You generate deterministic prompt-evaluation test data. You must use the provided validation tool before finalizing data. Return only the final valid JSON array and no commentary.',
    prompt: [
      'Generate test records for this prompt evaluation scenario.',
      '',
      `<scenario>${input.scenarioDescription}</scenario>`,
      `<record_count>${input.recordCount}</record_count>`,
      `<json_schema>${input.recordSchemaText}</json_schema>`,
      input.generationConstraints ? `<constraints>${input.generationConstraints}</constraints>` : '',
      '',
      'Workflow:',
      '1. Draft a JSON array with exactly the requested number of records.',
      '2. Call validate_test_data with the candidate records.',
      '3. If the validation result is invalid, repair the records and call validate_test_data again.',
      '4. After the validation result is valid, return only the final JSON array.',
    ]
      .filter(Boolean)
      .join('\n'),
  });
  const parsed = extractJson(response);
  return assertValidTestRecords({
    candidate: parsed,
    recordSchemaText: input.recordSchemaText,
    expectedRecordCount: input.recordCount,
  });
}
