import { describe, expect, it } from 'vitest';

import { runCodeChecks } from '@/features/evaluations/evaluationEngine';

describe('code checks', () => {
  it('checks JSON validity, required fields, and required text', () => {
    expect(
      runCodeChecks('{"topics":["a"],"summary":"done"}', {
        criteria: 'Return topics',
        requireJson: true,
        requiredJsonFields: ['topics', 'summary'],
        mustContain: ['done'],
        passScore: 7,
      }),
    ).toEqual([
      expect.objectContaining({ name: 'Valid JSON', passed: true }),
      expect.objectContaining({ name: 'Required field: topics', passed: true }),
      expect.objectContaining({ name: 'Required field: summary', passed: true }),
      expect.objectContaining({ name: 'Contains: done', passed: true }),
    ]);
  });

  it('reports invalid JSON and missing fields', () => {
    expect(
      runCodeChecks('not json', {
        criteria: 'Return JSON',
        requireJson: true,
        requiredJsonFields: ['topics'],
        mustContain: [],
        passScore: 7,
      }),
    ).toEqual([
      expect.objectContaining({ name: 'Valid JSON', passed: false }),
      expect.objectContaining({ name: 'Required field: topics', passed: false }),
    ]);
  });
});
