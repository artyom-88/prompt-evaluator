import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { usePromptEvaluator } from '@/app/PromptEvaluatorProvider';
import { Button } from '@/common/components/ui/Button';
import { Card, CardContent, CardHeader } from '@/common/components/ui/Card';
import { Field, Input, Label, Textarea } from '@/common/components/ui/Form';
import { createAnthropicTextClient } from '@/features/anthropic/anthropicClient';
import { asStringList } from '@/features/evaluations/evaluationEngine';
import { generateTestRecords } from '@/features/test-data/testDataGeneration';
import type { EvaluationRubric, JsonObject } from '@/features/workspace/workspaceStore';

const defaultSchema = JSON.stringify(
  {
    type: 'object',
    properties: {
      content: { type: 'string' },
      expected_topics: { type: 'array', items: { type: 'string' } },
    },
    required: ['content'],
    additionalProperties: true,
  },
  null,
  2,
);

const defaultPrompt = `<task>
Identify the key topics in this content and return only a JSON array of strings.
</task>

<content>
{data.content}
</content>`;

function parseRecords(recordsJson: string): JsonObject[] {
  const parsed = JSON.parse(recordsJson);
  if (!Array.isArray(parsed)) {
    throw new Error('Test records must be a JSON array.');
  }

  return parsed as JsonObject[];
}

export function ScenarioWizardPage() {
  const navigate = useNavigate();
  const { api, refresh } = usePromptEvaluator();
  const [step, setStep] = useState(0);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [recordCount, setRecordCount] = useState(4);
  const [recordSchemaText, setRecordSchemaText] = useState(defaultSchema);
  const [generationConstraints, setGenerationConstraints] = useState('');
  const [criteria, setCriteria] = useState(
    'Correctly follows the requested output format.\nSatisfies the scenario-specific task.',
  );
  const [requireJson, setRequireJson] = useState(true);
  const [requiredJsonFields, setRequiredJsonFields] = useState('');
  const [mustContain, setMustContain] = useState('');
  const [passScore, setPassScore] = useState(7);
  const [recordsJson, setRecordsJson] = useState('[]');
  const [promptTitle, setPromptTitle] = useState('Initial prompt');
  const [promptText, setPromptText] = useState(defaultPrompt);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState('');

  const rubric: EvaluationRubric = {
    criteria,
    requireJson,
    requiredJsonFields: asStringList(requiredJsonFields),
    mustContain: asStringList(mustContain),
    passScore,
  };

  async function handleGenerateRecords() {
    setError('');
    setIsGenerating(true);
    try {
      JSON.parse(recordSchemaText);
      const client = createAnthropicTextClient();
      const records = await generateTestRecords({
        client,
        scenarioDescription: description,
        recordSchemaText,
        recordCount,
        generationConstraints,
      });
      setRecordsJson(JSON.stringify(records, null, 2));
      setStep(3);
    } catch (generateError) {
      setError(generateError instanceof Error ? generateError.message : 'Failed to generate test records.');
    } finally {
      setIsGenerating(false);
    }
  }

  async function handleCreateScenario() {
    setError('');
    try {
      const testRecords = parseRecords(recordsJson);
      const { scenario } = await api.createScenario({
        title: title.trim() || 'Untitled scenario',
        description,
        recordCount,
        recordSchemaText,
        generationConstraints,
        testRecords,
        rubric,
        initialPromptTitle: promptTitle.trim() || 'Initial prompt',
        initialPromptText: promptText,
      });
      refresh();
      navigate(`/scenarios/${scenario.id}/prompts`);
    } catch (createError) {
      setError(createError instanceof Error ? createError.message : 'Failed to create scenario.');
    }
  }

  return (
    <div className='space-y-6'>
      <div>
        <h1 className='text-3xl font-bold tracking-tight'>Create scenario</h1>
        <p className='mt-2 text-stone-600'>
          Step {step + 1} of 5: define the scenario, data, rubric, records, and initial prompt.
        </p>
      </div>

      {error ? <div className='rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800'>{error}</div> : null}

      <Card>
        <CardHeader>
          <div className='flex flex-wrap gap-2 text-xs font-medium text-stone-600'>
            {['Scenario', 'Data schema', 'Rubric', 'Records', 'Prompt'].map((label, index) => (
              <button
                key={label}
                className={`rounded-full px-3 py-1 ${index === step ? 'bg-stone-900 text-white' : 'bg-stone-100'}`}
                type='button'
                onClick={() => setStep(index)}
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
                <Input id='scenario-title' value={title} onChange={(event) => setTitle(event.target.value)} />
              </Field>
              <Field>
                <Label htmlFor='scenario-description'>Scenario description</Label>
                <Textarea
                  id='scenario-description'
                  rows={8}
                  value={description}
                  onChange={(event) => setDescription(event.target.value)}
                  placeholder='Describe what the prompt should solve and which outputs count as good or bad.'
                />
              </Field>
            </>
          ) : null}

          {step === 1 ? (
            <>
              <Field>
                <Label htmlFor='record-count'>Number of test records</Label>
                <Input
                  id='record-count'
                  min={1}
                  type='number'
                  value={recordCount}
                  onChange={(event) => setRecordCount(Number(event.target.value))}
                />
              </Field>
              <Field>
                <Label htmlFor='record-schema'>Record JSON Schema</Label>
                <Textarea
                  id='record-schema'
                  rows={14}
                  value={recordSchemaText}
                  onChange={(event) => setRecordSchemaText(event.target.value)}
                />
              </Field>
              <Field>
                <Label htmlFor='generation-constraints'>Generation constraints</Label>
                <Textarea
                  id='generation-constraints'
                  rows={4}
                  value={generationConstraints}
                  onChange={(event) => setGenerationConstraints(event.target.value)}
                  placeholder='Optional: include edge cases, difficulty mix, or domain-specific constraints.'
                />
              </Field>
            </>
          ) : null}

          {step === 2 ? (
            <>
              <Field>
                <Label htmlFor='criteria'>Evaluation criteria</Label>
                <Textarea id='criteria' rows={8} value={criteria} onChange={(event) => setCriteria(event.target.value)} />
              </Field>
              <div className='grid gap-4 md:grid-cols-3'>
                <Field>
                  <Label htmlFor='pass-score'>Pass score</Label>
                  <Input
                    id='pass-score'
                    min={0}
                    max={10}
                    type='number'
                    value={passScore}
                    onChange={(event) => setPassScore(Number(event.target.value))}
                  />
                </Field>
                <Field className='pt-7'>
                  <label className='flex items-center gap-2 text-sm'>
                    <input checked={requireJson} type='checkbox' onChange={(event) => setRequireJson(event.target.checked)} />
                    Require valid JSON output
                  </label>
                </Field>
              </div>
              <Field>
                <Label htmlFor='required-json-fields'>Required JSON fields, comma-separated</Label>
                <Input
                  id='required-json-fields'
                  value={requiredJsonFields}
                  onChange={(event) => setRequiredJsonFields(event.target.value)}
                />
              </Field>
              <Field>
                <Label htmlFor='must-contain'>Required text fragments, comma-separated</Label>
                <Input id='must-contain' value={mustContain} onChange={(event) => setMustContain(event.target.value)} />
              </Field>
            </>
          ) : null}

          {step === 3 ? (
            <>
              <div className='flex items-center justify-between gap-4'>
                <p className='text-sm text-stone-600'>Generate records with Claude, or paste/edit JSON manually.</p>
                <Button disabled={isGenerating || !description.trim()} type='button' onClick={handleGenerateRecords}>
                  {isGenerating ? 'Generating...' : 'Generate records'}
                </Button>
              </div>
              <Field>
                <Label htmlFor='records-json'>Test records JSON</Label>
                <Textarea
                  id='records-json'
                  rows={16}
                  value={recordsJson}
                  onChange={(event) => setRecordsJson(event.target.value)}
                />
              </Field>
            </>
          ) : null}

          {step === 4 ? (
            <>
              <Field>
                <Label htmlFor='prompt-title'>Prompt title</Label>
                <Input id='prompt-title' value={promptTitle} onChange={(event) => setPromptTitle(event.target.value)} />
              </Field>
              <Field>
                <Label htmlFor='prompt-text'>Prompt text</Label>
                <Textarea id='prompt-text' rows={18} value={promptText} onChange={(event) => setPromptText(event.target.value)} />
                <p className='text-xs text-stone-500'>
                  Use XML tags for structure and references like {'{data.content}'} for test-record fields.
                </p>
              </Field>
            </>
          ) : null}

          <div className='flex justify-between border-t border-stone-100 pt-4'>
            <Button
              disabled={step === 0}
              type='button'
              variant='secondary'
              onClick={() => setStep((current) => Math.max(0, current - 1))}
            >
              Back
            </Button>
            {step < 4 ? (
              <Button type='button' onClick={() => setStep((current) => Math.min(4, current + 1))}>
                Continue
              </Button>
            ) : (
              <Button type='button' onClick={handleCreateScenario}>
                Create scenario
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
