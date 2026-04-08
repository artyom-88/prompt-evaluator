import type { ChangeEvent, ReactElement } from 'react';
import { memo, useCallback, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { Button } from '@/common/components/Button';
import { Card, CardContent, CardHeader } from '@/common/components/Card';
import { Field, Input, Label, Textarea } from '@/common/components/Form';
import { createAnthropicTextClient } from '@/features/anthropic/anthropicClient';
import { hasDataReference } from '@/features/prompts/promptTemplate';
import { generateTestRecords, validateTestData } from '@/features/test-data/testDataGeneration';
import {
  createEmptyFieldDefinition,
  EXPECTED_RESULT_FIELD_DESCRIPTION,
  EXPECTED_RESULT_FIELD_NAME,
  getPreviewFieldDefinitions,
  getPromptReferenceFieldNames,
  stringifyRecordJsonSchema,
  validateFieldDefinitions,
} from '@/features/test-data/testDataSchema';
import { useCreateScenario } from '@/features/workspace/workspaceState';
import type { JsonObject, ScenarioFieldDefinition } from '@/features/workspace/workspaceTypes';

const defaultPrompt = `<task>
Solve the scenario using the provided input fields.
Return only the final answer.
</task>`;

const stepLabels = ['Scenario', 'Fields', 'Records', 'Prompt'] as const;

const parseRecordsJson = (recordsJson: string): unknown => JSON.parse(recordsJson);

const readJsonFile = async (file: File): Promise<unknown> => JSON.parse(await file.text());

const getScenarioStepErrors = (title: string, description: string): string[] => {
  const errors: string[] = [];

  if (!title.trim()) {
    errors.push('Scenario title is required.');
  }

  if (!description.trim()) {
    errors.push('Scenario description is required.');
  }

  return errors;
};

const getFieldsStepErrors = (fieldDefinitions: ScenarioFieldDefinition[], recordCount: number): string[] => {
  const errors = validateFieldDefinitions(fieldDefinitions);

  if (!Number.isInteger(recordCount) || recordCount <= 0) {
    errors.push('Number of test records must be greater than 0.');
  }

  return errors;
};

const getRecordsStepErrors = (recordsJson: string, recordSchemaText: string, recordCount: number): string[] => {
  if (!recordSchemaText) {
    return ['Complete the Fields step first.'];
  }

  try {
    const parsed = parseRecordsJson(recordsJson);
    const validation = validateTestData({
      candidate: parsed,
      recordSchemaText,
      expectedRecordCount: recordCount,
    });

    return validation.errors;
  } catch (error) {
    return [error instanceof Error ? error.message : 'Test records must be valid JSON.'];
  }
};

const getPromptStepErrors = (promptText: string): string[] => {
  const errors: string[] = [];

  if (!promptText.trim()) {
    errors.push('Prompt text is required.');
  }

  if (hasDataReference(promptText, EXPECTED_RESULT_FIELD_NAME)) {
    errors.push(`Prompt cannot reference {data.${EXPECTED_RESULT_FIELD_NAME}}.`);
  }

  return errors;
};

interface FieldDefinitionEditorProps {
  fieldDefinition: ScenarioFieldDefinition;
  onDelete: (fieldId: string) => void;
  onDescriptionBlur: (fieldId: string) => void;
  onDescriptionChange: (fieldId: string, value: string) => void;
  onNameBlur: (fieldId: string) => void;
  onNameChange: (fieldId: string, value: string) => void;
  onTypeChange: (fieldId: string, value: ScenarioFieldDefinition['type']) => void;
}

const FieldDefinitionEditor = memo(
  ({
    fieldDefinition,
    onDelete,
    onDescriptionBlur,
    onDescriptionChange,
    onNameBlur,
    onNameChange,
    onTypeChange,
  }: FieldDefinitionEditorProps): ReactElement => {
    const handleNameBlur = useCallback((): void => {
      onNameBlur(fieldDefinition.id);
    }, [fieldDefinition.id, onNameBlur]);

    const handleNameChange = useCallback(
      (event: ChangeEvent<HTMLInputElement>): void => {
        onNameChange(fieldDefinition.id, event.target.value);
      },
      [fieldDefinition.id, onNameChange],
    );

    const handleTypeChange = useCallback(
      (event: ChangeEvent<HTMLSelectElement>): void => {
        onTypeChange(fieldDefinition.id, event.target.value as ScenarioFieldDefinition['type']);
      },
      [fieldDefinition.id, onTypeChange],
    );

    const handleDescriptionBlur = useCallback((): void => {
      onDescriptionBlur(fieldDefinition.id);
    }, [fieldDefinition.id, onDescriptionBlur]);

    const handleDescriptionChange = useCallback(
      (event: ChangeEvent<HTMLInputElement>): void => {
        onDescriptionChange(fieldDefinition.id, event.target.value);
      },
      [fieldDefinition.id, onDescriptionChange],
    );

    const handleDelete = useCallback((): void => {
      onDelete(fieldDefinition.id);
    }, [fieldDefinition.id, onDelete]);

    return (
      <div className='grid gap-4 rounded-lg border border-stone-200 p-4 md:grid-cols-[1.2fr_180px_1.4fr_auto]'>
        <Field>
          <Label htmlFor={`field-name-${fieldDefinition.id}`}>Name</Label>
          <Input
            id={`field-name-${fieldDefinition.id}`}
            value={fieldDefinition.name}
            onBlur={handleNameBlur}
            onChange={handleNameChange}
          />
        </Field>
        <Field>
          <Label htmlFor={`field-type-${fieldDefinition.id}`}>Type</Label>
          <select
            id={`field-type-${fieldDefinition.id}`}
            className='w-full rounded-md border border-stone-300 bg-white px-3 py-2 text-sm'
            value={fieldDefinition.type}
            onChange={handleTypeChange}
          >
            <option value='string'>string</option>
            <option value='number'>number</option>
            <option value='integer'>integer</option>
            <option value='boolean'>boolean</option>
          </select>
        </Field>
        <Field>
          <Label htmlFor={`field-description-${fieldDefinition.id}`}>Description</Label>
          <Input
            id={`field-description-${fieldDefinition.id}`}
            value={fieldDefinition.description}
            onBlur={handleDescriptionBlur}
            onChange={handleDescriptionChange}
          />
        </Field>
        <div className='flex items-end'>
          <Button type='button' variant='secondary' onClick={handleDelete}>
            Delete
          </Button>
        </div>
      </div>
    );
  },
);

FieldDefinitionEditor.displayName = 'FieldDefinitionEditor';

export const ScenarioWizardPage = (): ReactElement => {
  const navigate = useNavigate();
  const createScenario = useCreateScenario();
  const recordsImportRef = useRef<HTMLInputElement>(null);
  const [step, setStep] = useState(0);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [recordCount, setRecordCount] = useState(3);
  const [fieldDefinitions, setFieldDefinitions] = useState<ScenarioFieldDefinition[]>([]);
  const [generationConstraints, setGenerationConstraints] = useState('');
  const [committedRecordSchemaText, setCommittedRecordSchemaText] = useState('');
  const [recordsJson, setRecordsJson] = useState('[]');
  const [promptTitle, setPromptTitle] = useState('Initial prompt');
  const [promptText, setPromptText] = useState(defaultPrompt);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState('');

  const previewRecordSchemaText = useMemo(
    () => stringifyRecordJsonSchema(getPreviewFieldDefinitions(fieldDefinitions)),
    [fieldDefinitions],
  );
  const scenarioStepErrors = useMemo(() => getScenarioStepErrors(title, description), [description, title]);
  const fieldsStepErrors = useMemo(() => getFieldsStepErrors(fieldDefinitions, recordCount), [fieldDefinitions, recordCount]);
  const activeRecordSchemaText = committedRecordSchemaText || previewRecordSchemaText;
  const recordsStepErrors = useMemo(
    () => getRecordsStepErrors(recordsJson, activeRecordSchemaText, recordCount),
    [activeRecordSchemaText, recordCount, recordsJson],
  );
  const promptStepErrors = useMemo(() => getPromptStepErrors(promptText), [promptText]);
  const availablePromptReferences = useMemo(() => getPromptReferenceFieldNames(fieldDefinitions), [fieldDefinitions]);

  const stepErrors = useMemo(
    () => [scenarioStepErrors, fieldsStepErrors, recordsStepErrors, promptStepErrors],
    [fieldsStepErrors, promptStepErrors, recordsStepErrors, scenarioStepErrors],
  );
  const currentStepErrors = stepErrors[step];

  const canVisitStep = useCallback(
    (targetStep: number): boolean => {
      if (targetStep <= step) {
        return true;
      }

      return stepErrors.slice(0, targetStep).every((errors) => errors.length === 0);
    },
    [step, stepErrors],
  );

  const handleContinue = useCallback((): void => {
    if (stepErrors[step].length > 0) {
      return;
    }

    if (step === 1) {
      setCommittedRecordSchemaText(stringifyRecordJsonSchema(fieldDefinitions));
    }

    setStep((currentStep) => Math.min(stepLabels.length - 1, currentStep + 1));
  }, [fieldDefinitions, step, stepErrors]);

  const handleGenerateRecords = useCallback(async (): Promise<void> => {
    if (fieldsStepErrors.length > 0 || scenarioStepErrors.length > 0) {
      return;
    }

    setError('');
    setIsGenerating(true);
    try {
      const recordSchemaText = stringifyRecordJsonSchema(fieldDefinitions);
      const client = createAnthropicTextClient();
      const records = await generateTestRecords({
        client,
        scenarioDescription: description,
        fieldDefinitions,
        recordSchemaText,
        recordCount,
        generationConstraints,
      });

      setCommittedRecordSchemaText(recordSchemaText);
      setRecordsJson(JSON.stringify(records, null, 2));
    } catch (generateError) {
      setError(generateError instanceof Error ? generateError.message : 'Failed to generate test records.');
    } finally {
      setIsGenerating(false);
    }
  }, [description, fieldDefinitions, fieldsStepErrors.length, generationConstraints, recordCount, scenarioStepErrors.length]);

  const handleImportRecords = useCallback(async (event: ChangeEvent<HTMLInputElement>): Promise<void> => {
    const file = event.target.files?.[0];
    event.target.value = '';

    if (!file) {
      return;
    }

    setError('');
    try {
      const parsed = await readJsonFile(file);

      setRecordsJson(JSON.stringify(parsed, null, 2));
    } catch (importError) {
      setError(importError instanceof Error ? importError.message : 'Failed to import test records JSON.');
    }
  }, []);

  const handleCreateScenario = useCallback(async (): Promise<void> => {
    if (
      promptStepErrors.length > 0 ||
      recordsStepErrors.length > 0 ||
      fieldsStepErrors.length > 0 ||
      scenarioStepErrors.length > 0
    ) {
      return;
    }

    setError('');
    try {
      const parsedRecords = parseRecordsJson(recordsJson);
      const validation = validateTestData({
        candidate: parsedRecords,
        recordSchemaText: activeRecordSchemaText,
        expectedRecordCount: recordCount,
      });

      if (!validation.valid) {
        throw new Error(validation.errors.join(' '));
      }

      const { scenario } = createScenario({
        title: title.trim(),
        description: description.trim(),
        recordCount,
        fieldDefinitions: fieldDefinitions.map((fieldDefinition) => ({
          ...fieldDefinition,
          name: fieldDefinition.name.trim(),
          description: fieldDefinition.description.trim(),
        })),
        recordSchemaText: activeRecordSchemaText,
        generationConstraints,
        testRecords: parsedRecords as JsonObject[],
        initialPromptTitle: promptTitle.trim() || 'Initial prompt',
        initialPromptText: promptText,
      });

      navigate(`/scenarios/${scenario.id}/prompts`);
    } catch (createError) {
      setError(createError instanceof Error ? createError.message : 'Failed to create scenario.');
    }
  }, [
    activeRecordSchemaText,
    createScenario,
    fieldDefinitions,
    fieldsStepErrors.length,
    generationConstraints,
    navigate,
    promptStepErrors.length,
    promptText,
    promptTitle,
    recordCount,
    recordsJson,
    recordsStepErrors.length,
    scenarioStepErrors.length,
    title,
    description,
  ]);

  const handleStepClick = useCallback((targetStep: number): void => {
    setStep(targetStep);
  }, []);

  const handleBack = useCallback((): void => {
    setStep((currentStep) => Math.max(0, currentStep - 1));
  }, []);

  const handleScenarioTitleBlur = useCallback((): void => {
    setTitle((currentTitle) => currentTitle.trim());
  }, []);

  const handleScenarioTitleChange = useCallback((event: ChangeEvent<HTMLInputElement>): void => {
    setTitle(event.target.value);
  }, []);

  const handleScenarioDescriptionBlur = useCallback((): void => {
    setDescription((currentDescription) => currentDescription.trim());
  }, []);

  const handleScenarioDescriptionChange = useCallback((event: ChangeEvent<HTMLTextAreaElement>): void => {
    setDescription(event.target.value);
  }, []);

  const handleRecordCountChange = useCallback((event: ChangeEvent<HTMLInputElement>): void => {
    setRecordCount(Number(event.target.value));
  }, []);

  const handleAddField = useCallback((): void => {
    setFieldDefinitions((current) => [...current, createEmptyFieldDefinition()]);
  }, []);

  const handleFieldNameChange = useCallback((fieldId: string, value: string): void => {
    setFieldDefinitions((current) =>
      current.map((candidate) => (candidate.id === fieldId ? { ...candidate, name: value } : candidate)),
    );
  }, []);

  const handleFieldNameBlur = useCallback((fieldId: string): void => {
    setFieldDefinitions((current) =>
      current.map((candidate) => (candidate.id === fieldId ? { ...candidate, name: candidate.name.trim() } : candidate)),
    );
  }, []);

  const handleFieldTypeChange = useCallback((fieldId: string, value: ScenarioFieldDefinition['type']): void => {
    setFieldDefinitions((current) =>
      current.map((candidate) => (candidate.id === fieldId ? { ...candidate, type: value } : candidate)),
    );
  }, []);

  const handleFieldDescriptionChange = useCallback((fieldId: string, value: string): void => {
    setFieldDefinitions((current) =>
      current.map((candidate) => (candidate.id === fieldId ? { ...candidate, description: value } : candidate)),
    );
  }, []);

  const handleFieldDescriptionBlur = useCallback((fieldId: string): void => {
    setFieldDefinitions((current) =>
      current.map((candidate) =>
        candidate.id === fieldId ? { ...candidate, description: candidate.description.trim() } : candidate,
      ),
    );
  }, []);

  const handleDeleteField = useCallback((fieldId: string): void => {
    setFieldDefinitions((current) => current.filter((candidate) => candidate.id !== fieldId));
  }, []);

  const handleGenerationConstraintsBlur = useCallback((): void => {
    setGenerationConstraints((currentConstraints) => currentConstraints.trim());
  }, []);

  const handleGenerationConstraintsChange = useCallback((event: ChangeEvent<HTMLTextAreaElement>): void => {
    setGenerationConstraints(event.target.value);
  }, []);

  const handleOpenRecordsImport = useCallback((): void => {
    recordsImportRef.current?.click();
  }, []);

  const handleRecordsJsonChange = useCallback((event: ChangeEvent<HTMLTextAreaElement>): void => {
    setRecordsJson(event.target.value);
  }, []);

  const handlePromptTitleBlur = useCallback((): void => {
    setPromptTitle((currentPromptTitle) => currentPromptTitle.trim());
  }, []);

  const handlePromptTitleChange = useCallback((event: ChangeEvent<HTMLInputElement>): void => {
    setPromptTitle(event.target.value);
  }, []);

  const handlePromptTextChange = useCallback((event: ChangeEvent<HTMLTextAreaElement>): void => {
    setPromptText(event.target.value);
  }, []);

  return (
    <div className='space-y-6'>
      <div>
        <h1 className='text-3xl font-bold tracking-tight'>Create scenario</h1>
        <p className='mt-2 text-stone-600'>Step {step + 1} of 4: define the scenario, fields, records, and initial prompt.</p>
      </div>

      {error ? <div className='rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800'>{error}</div> : null}

      <Card>
        <CardHeader>
          <div className='flex flex-wrap gap-2 text-xs font-medium text-stone-600'>
            {stepLabels.map((label, index) => (
              <button
                key={label}
                className={`rounded-full px-3 py-1 ${index === step ? 'bg-stone-900 text-white' : 'bg-stone-100'} ${
                  canVisitStep(index) ? '' : 'cursor-not-allowed opacity-50'
                }`}
                disabled={!canVisitStep(index)}
                type='button'
                onClick={() => handleStepClick(index)}
              >
                {index + 1}. {label}
              </button>
            ))}
          </div>
        </CardHeader>
        <CardContent className='space-y-5'>
          {step === 0 ? (
            <>
              <Field>
                <Label htmlFor='scenario-title'>Scenario title</Label>
                <Input id='scenario-title' value={title} onBlur={handleScenarioTitleBlur} onChange={handleScenarioTitleChange} />
                <p className='text-xs text-stone-500'>Required. Used to identify the scenario in lists and reports.</p>
              </Field>
              <Field>
                <Label htmlFor='scenario-description'>Scenario description</Label>
                <Textarea
                  id='scenario-description'
                  rows={8}
                  value={description}
                  onBlur={handleScenarioDescriptionBlur}
                  onChange={handleScenarioDescriptionChange}
                  placeholder='Describe what the prompt should solve and what a correct result looks like.'
                />
                <p className='text-xs text-stone-500'>Required. This drives test-data generation and evaluation.</p>
              </Field>
            </>
          ) : null}

          {step === 1 ? (
            <>
              <Field>
                <Label htmlFor='record-count'>Number of test records</Label>
                <Input id='record-count' min={1} type='number' value={recordCount} onChange={handleRecordCountChange} />
              </Field>
              <div className='space-y-4'>
                <div className='flex items-center justify-between gap-4'>
                  <div>
                    <h2 className='font-semibold'>Input fields</h2>
                    <p className='text-sm text-stone-600'>
                      Add the user-visible record fields. The app also adds a required internal field named "
                      {EXPECTED_RESULT_FIELD_NAME}
                      ".
                    </p>
                  </div>
                  <Button type='button' variant='secondary' onClick={handleAddField}>
                    Add field
                  </Button>
                </div>

                {fieldDefinitions.length === 0 ? (
                  <div className='rounded-md border border-dashed border-stone-300 px-4 py-6 text-sm text-stone-600'>
                    No fields added yet.
                  </div>
                ) : (
                  <div className='space-y-4'>
                    {fieldDefinitions.map((fieldDefinition) => (
                      <FieldDefinitionEditor
                        key={fieldDefinition.id}
                        fieldDefinition={fieldDefinition}
                        onDelete={handleDeleteField}
                        onDescriptionBlur={handleFieldDescriptionBlur}
                        onDescriptionChange={handleFieldDescriptionChange}
                        onNameBlur={handleFieldNameBlur}
                        onNameChange={handleFieldNameChange}
                        onTypeChange={handleFieldTypeChange}
                      />
                    ))}
                  </div>
                )}
              </div>

              <Field>
                <Label htmlFor='generation-constraints'>Generation constraints</Label>
                <Textarea
                  id='generation-constraints'
                  rows={4}
                  value={generationConstraints}
                  onBlur={handleGenerationConstraintsBlur}
                  onChange={handleGenerationConstraintsChange}
                  placeholder='Optional: include edge cases, difficulty mix, or domain-specific constraints.'
                />
              </Field>

              <Field>
                <Label htmlFor='schema-preview'>Generated JSON Schema</Label>
                <div
                  id='schema-preview'
                  className='max-h-96 overflow-auto rounded-md border border-stone-300 bg-stone-50 px-3 py-2 font-mono text-xs text-stone-900'
                >
                  <pre className='whitespace-pre-wrap break-words'>{previewRecordSchemaText}</pre>
                </div>
                <p className='text-xs text-stone-500'>
                  The app automatically adds "{EXPECTED_RESULT_FIELD_NAME}" as a required string field:{' '}
                  {EXPECTED_RESULT_FIELD_DESCRIPTION}
                </p>
                <p className='text-xs text-stone-500'>
                  The preview always includes the app-owned base schema. Incomplete or invalid custom fields are omitted until
                  fixed.
                </p>
              </Field>
            </>
          ) : null}

          {step === 2 ? (
            <>
              <div className='flex items-center justify-between gap-4'>
                <p className='text-sm text-stone-600'>
                  Generate records with Claude, import a JSON file, or paste/edit JSON manually.
                </p>
                <div className='flex gap-3'>
                  <input
                    ref={recordsImportRef}
                    hidden
                    accept='application/json,.json'
                    type='file'
                    onChange={handleImportRecords}
                  />
                  <Button type='button' variant='secondary' onClick={handleOpenRecordsImport}>
                    Import JSON
                  </Button>
                  <Button
                    disabled={isGenerating || scenarioStepErrors.length > 0 || fieldsStepErrors.length > 0}
                    type='button'
                    onClick={handleGenerateRecords}
                  >
                    {isGenerating ? 'Generating...' : 'Generate records'}
                  </Button>
                </div>
              </div>
              <Field>
                <Label htmlFor='records-json'>Test records JSON</Label>
                <Textarea id='records-json' rows={18} value={recordsJson} onChange={handleRecordsJsonChange} />
              </Field>
            </>
          ) : null}

          {step === 3 ? (
            <>
              <Field>
                <Label htmlFor='prompt-title'>Prompt title (optional)</Label>
                <Input id='prompt-title' value={promptTitle} onBlur={handlePromptTitleBlur} onChange={handlePromptTitleChange} />
              </Field>
              <Field>
                <Label htmlFor='prompt-text'>Prompt text</Label>
                <Textarea id='prompt-text' rows={18} value={promptText} onChange={handlePromptTextChange} />
                <p className='text-xs text-stone-500'>
                  Available references:{' '}
                  {availablePromptReferences.length > 0
                    ? availablePromptReferences.map((reference) => `{data.${reference}}`).join(', ')
                    : 'add fields first'}
                  .
                </p>
              </Field>
            </>
          ) : null}

          {currentStepErrors.length > 0 ? (
            <div className='rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900'>
              <ul className='list-disc pl-5'>
                {currentStepErrors.map((stepError) => (
                  <li key={stepError}>{stepError}</li>
                ))}
              </ul>
            </div>
          ) : null}

          <div className='flex justify-between border-t border-stone-100 pt-4'>
            <Button disabled={step === 0} type='button' variant='secondary' onClick={handleBack}>
              Back
            </Button>
            {step < stepLabels.length - 1 ? (
              <Button disabled={currentStepErrors.length > 0} type='button' onClick={handleContinue}>
                Continue
              </Button>
            ) : (
              <Button disabled={currentStepErrors.length > 0} type='button' onClick={handleCreateScenario}>
                Create scenario
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
