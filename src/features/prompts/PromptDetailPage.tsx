import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';

import { usePromptEvaluator } from '@/app/PromptEvaluatorProvider';
import { Button } from '@/common/components/ui/Button';
import { Card, CardContent, CardHeader } from '@/common/components/ui/Card';
import { Field, Input, Label, Textarea } from '@/common/components/ui/Form';
import { createAnthropicTextClient } from '@/features/anthropic/anthropicClient';
import { evaluatePromptVersion } from '@/features/evaluations/evaluationEngine';
import { findDataReferences } from '@/features/prompts/promptTemplate';
import { ReportTable } from '@/features/reports/ReportTable';
import type { EvaluationRun, PromptVersion, Scenario } from '@/features/workspace/workspaceStore';

export function PromptDetailPage() {
  const { scenarioId = '', promptVersionId = '' } = useParams();
  const navigate = useNavigate();
  const { api, refresh } = usePromptEvaluator();
  const [scenario, setScenario] = useState<Scenario>();
  const [promptVersion, setPromptVersion] = useState<PromptVersion>();
  const [runs, setRuns] = useState<EvaluationRun[]>([]);
  const [title, setTitle] = useState('');
  const [promptText, setPromptText] = useState('');
  const [notes, setNotes] = useState('');
  const [isRunning, setIsRunning] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    void Promise.all([
      api.getScenario(scenarioId),
      api.getPromptVersion(promptVersionId),
      api.listEvaluationRunsForPrompt(promptVersionId),
    ]).then(([nextScenario, nextPromptVersion, nextRuns]) => {
      setScenario(nextScenario);
      setPromptVersion(nextPromptVersion);
      setRuns(nextRuns);
      if (nextPromptVersion) {
        setTitle(nextPromptVersion.title);
        setPromptText(nextPromptVersion.promptText);
        setNotes(nextPromptVersion.notes);
      }
    });
  }, [api, promptVersionId, scenarioId]);

  async function handleRunEvaluation() {
    if (!scenario || !promptVersion) {
      return;
    }

    setError('');
    setIsRunning(true);
    try {
      const client = createAnthropicTextClient();
      const run = await evaluatePromptVersion({ client, scenario, promptVersion });
      await api.createEvaluationRun(run);
      setRuns([run, ...runs]);
      refresh();
    } catch (runError) {
      setError(runError instanceof Error ? runError.message : 'Failed to run evaluation.');
    } finally {
      setIsRunning(false);
    }
  }

  async function handleCreateVersion() {
    if (!scenario || !promptVersion) {
      return;
    }

    setError('');
    try {
      const nextVersion = await api.createPromptVersion({
        scenarioId: scenario.id,
        title: title.trim() || promptVersion.title,
        promptText,
        notes,
        parentVersionId: promptVersion.id,
      });
      refresh();
      navigate(`/scenarios/${scenario.id}/prompts/${nextVersion.id}`);
    } catch (createError) {
      setError(createError instanceof Error ? createError.message : 'Failed to create prompt version.');
    }
  }

  if (!scenario || !promptVersion) {
    return <p className='text-sm text-stone-600'>Prompt version not found.</p>;
  }

  const latestRun = runs[0];
  const references = findDataReferences(promptText);

  return (
    <div className='space-y-6'>
      <div className='flex items-start justify-between gap-4'>
        <div>
          <Link className='text-sm font-medium text-stone-600 underline' to={`/scenarios/${scenario.id}/prompts`}>
            Back to versions
          </Link>
          <h1 className='mt-2 text-3xl font-bold tracking-tight'>
            v{promptVersion.versionNumber}: {promptVersion.title}
          </h1>
          <p className='mt-2 text-stone-600'>{scenario.title}</p>
        </div>
        <Button disabled={isRunning} type='button' onClick={handleRunEvaluation}>
          {isRunning ? 'Running...' : 'Run evaluation'}
        </Button>
      </div>

      {error ? <div className='rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800'>{error}</div> : null}

      <Card>
        <CardHeader>
          <h2 className='font-semibold'>Prompt editor</h2>
          <p className='mt-1 text-sm text-stone-600'>Saving changes creates a new immutable version under this scenario.</p>
        </CardHeader>
        <CardContent className='space-y-4'>
          <Field>
            <Label htmlFor='version-title'>Version title</Label>
            <Input id='version-title' value={title} onChange={(event) => setTitle(event.target.value)} />
          </Field>
          <Field>
            <Label htmlFor='prompt-text'>Prompt text</Label>
            <Textarea id='prompt-text' rows={16} value={promptText} onChange={(event) => setPromptText(event.target.value)} />
            <p className='text-xs text-stone-500'>
              References detected:{' '}
              {references.length > 0 ? references.map((reference) => `{data.${reference}}`).join(', ') : 'none'}.
            </p>
          </Field>
          <Field>
            <Label htmlFor='version-notes'>Version notes</Label>
            <Input id='version-notes' value={notes} onChange={(event) => setNotes(event.target.value)} />
          </Field>
          <Button type='button' variant='secondary' onClick={handleCreateVersion}>
            Save as new version
          </Button>
        </CardContent>
      </Card>

      {latestRun ? (
        <ReportTable run={latestRun} />
      ) : (
        <Card>
          <CardContent className='py-8 text-center text-stone-600'>
            No evaluation report yet. Run an evaluation to generate one.
          </CardContent>
        </Card>
      )}
    </div>
  );
}
