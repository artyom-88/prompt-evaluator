import { describe, expect, it } from 'vitest';

import { findDataReferences, interpolatePrompt } from '@/features/prompts/promptTemplate';

describe('prompt interpolation', () => {
  it('replaces scalar and nested data references', () => {
    expect(
      interpolatePrompt('Summarize {data.content} for {data.user.name}.', {
        content: 'hello',
        user: { name: 'Ada' },
      }),
    ).toBe('Summarize hello for Ada.');
  });

  it('serializes non-string values and returns empty text for missing references', () => {
    expect(
      interpolatePrompt('Tags: {data.tags}; Missing: {data.none}', {
        tags: ['a', 'b'],
      }),
    ).toBe('Tags: ["a","b"]; Missing: ');
  });

  it('finds data references', () => {
    expect(findDataReferences('{data.content} {data.user.name}')).toEqual(['content', 'user.name']);
  });
});
