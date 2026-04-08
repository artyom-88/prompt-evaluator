import type { JsonObject, ScenarioFieldDefinition, ScenarioFieldType } from '@/features/workspace/workspaceTypes';

export const EXPECTED_RESULT_FIELD_NAME = 'expected_result';

export const EXPECTED_RESULT_FIELD_DESCRIPTION =
  'Expected answer for this test case. Generate the exact result the prompt should ideally return for the given input.';

export const RESERVED_FIELD_NAMES = [EXPECTED_RESULT_FIELD_NAME] as const;

const jsonSchemaTypeMap: Record<ScenarioFieldType, string> = {
  string: 'string',
  number: 'number',
  integer: 'integer',
  boolean: 'boolean',
};

export const createEmptyFieldDefinition = (): ScenarioFieldDefinition => ({
  id: crypto.randomUUID(),
  name: '',
  type: 'string',
  description: '',
});

export const isReservedFieldName = (name: string): boolean =>
  RESERVED_FIELD_NAMES.includes(name.trim() as (typeof RESERVED_FIELD_NAMES)[number]);

export const normalizeFieldName = (name: string): string => name.trim();

export const validateFieldDefinitions = (fieldDefinitions: ScenarioFieldDefinition[]): string[] => {
  if (fieldDefinitions.length === 0) {
    return ['Add at least one input field.'];
  }

  const errors: string[] = [];
  const seenNames = new Set<string>();

  for (const [index, fieldDefinition] of fieldDefinitions.entries()) {
    const name = normalizeFieldName(fieldDefinition.name);
    const prefix = `Field ${index + 1}`;

    if (!name) {
      errors.push(`${prefix} name is required.`);
    } else {
      if (isReservedFieldName(name)) {
        errors.push(`${prefix} uses reserved name "${name}".`);
      }

      if (seenNames.has(name)) {
        errors.push(`${prefix} duplicates field name "${name}".`);
      }

      seenNames.add(name);
    }

    if (!fieldDefinition.description.trim()) {
      errors.push(`${prefix} description is required.`);
    }
  }

  return errors;
};

export const getPreviewFieldDefinitions = (fieldDefinitions: ScenarioFieldDefinition[]): ScenarioFieldDefinition[] => {
  const seenNames = new Set<string>();

  return fieldDefinitions.filter((fieldDefinition) => {
    const name = normalizeFieldName(fieldDefinition.name);

    if (!name || !fieldDefinition.description.trim() || isReservedFieldName(name) || seenNames.has(name)) {
      return false;
    }

    seenNames.add(name);

    return true;
  });
};

export const buildRecordJsonSchema = (fieldDefinitions: ScenarioFieldDefinition[]): JsonObject => {
  const properties: Record<string, JsonObject> = {
    [EXPECTED_RESULT_FIELD_NAME]: {
      type: 'string',
      description: EXPECTED_RESULT_FIELD_DESCRIPTION,
    },
  };
  const required = [EXPECTED_RESULT_FIELD_NAME];

  for (const fieldDefinition of fieldDefinitions) {
    const name = normalizeFieldName(fieldDefinition.name);

    properties[name] = {
      type: jsonSchemaTypeMap[fieldDefinition.type],
      description: fieldDefinition.description.trim(),
    };
    required.push(name);
  }

  return {
    type: 'object',
    properties,
    required,
    additionalProperties: false,
  };
};

export const stringifyRecordJsonSchema = (fieldDefinitions: ScenarioFieldDefinition[]): string =>
  JSON.stringify(buildRecordJsonSchema(fieldDefinitions), null, 2);

export const getPromptReferenceFieldNames = (fieldDefinitions: ScenarioFieldDefinition[]): string[] =>
  fieldDefinitions.map((fieldDefinition) => normalizeFieldName(fieldDefinition.name)).filter(Boolean);
