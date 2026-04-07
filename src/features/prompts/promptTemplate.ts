import type { JsonObject, JsonValue } from '@/features/workspace/workspaceStore';

const DATA_REFERENCE_PATTERN = /\{data\.([a-zA-Z0-9_.-]+)\}/g;

function resolvePath(source: JsonValue, path: string): JsonValue | undefined {
  return path.split('.').reduce<JsonValue | undefined>((current, segment) => {
    if (current && typeof current === 'object' && !Array.isArray(current)) {
      return current[segment];
    }

    return undefined;
  }, source);
}

export function interpolatePrompt(prompt: string, data: JsonObject) {
  return prompt.replace(DATA_REFERENCE_PATTERN, (_match, path: string) => {
    const value = resolvePath(data, path);
    if (value === undefined) {
      return '';
    }

    return typeof value === 'string' ? value : JSON.stringify(value);
  });
}

export function findDataReferences(prompt: string) {
  return [...prompt.matchAll(DATA_REFERENCE_PATTERN)].map((match) => match[1]);
}
