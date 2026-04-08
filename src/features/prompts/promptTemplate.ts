import type { JsonObject, JsonValue } from '@/features/workspace/workspaceTypes';

const DATA_REFERENCE_PATTERN = /\{data\.([a-zA-Z0-9_.-]+)\}/g;

const resolvePath = (source: JsonValue, path: string): JsonValue | undefined =>
  path.split('.').reduce<JsonValue | undefined>((current, segment) => {
    if (current && typeof current === 'object' && !Array.isArray(current)) {
      return current[segment];
    }

    return undefined;
  }, source);

export const interpolatePrompt = (prompt: string, data: JsonObject): string =>
  prompt.replace(DATA_REFERENCE_PATTERN, (_match, path: string) => {
    const value = resolvePath(data, path);
    if (value === undefined) {
      return '';
    }

    return typeof value === 'string' ? value : JSON.stringify(value);
  });

export const findDataReferences = (prompt: string): string[] =>
  [...prompt.matchAll(DATA_REFERENCE_PATTERN)].map((match) => match[1]);

export const hasDataReference = (prompt: string, referenceName: string): boolean =>
  findDataReferences(prompt).includes(referenceName);
