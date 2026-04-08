import type { ReactElement } from 'react';
import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';

import { Button } from '@/common/components/ui/Button';
import { Card, CardContent, CardHeader } from '@/common/components/ui/Card';
import { Field, Input, Label, Textarea } from '@/common/components/ui/Form';
import { createAnthropicTextClient } from '@/features/anthropic/anthropicClient';
import { evaluatePromptVersion } from '@/features/evaluations/evaluationEngine';
import { findDataReferences } from '@/features/prompts/promptTemplate';
import { ReportTable } from '@/features/reports/ReportTable';
import { workspaceApi } from '@/features/workspace/workspaceApi';
import type { EvaluationRun, PromptVersion, Scenario } from '@/features/workspace/workspaceTypes';

export const PromptDetailPage = (): ReactElement => {
  const { scenarioId = '', promptVersionId = '' } = useParams();
  const navigate = useNavigate();
  const [scenario, setScenario] = useState<Scenario>();
  const [promptVersion, setPromptVersion] = useState<PromptVersion>();
  const [runs, setRuns] = useState<EvaluationRun[]>([]);
  const [title, setTitle] = useState('');
  const [promptText, setPromptText] = useState('');
  const [notes, setNotes] = useState('');
  const [isRunning, setIsRunning] = useState(false);
  const [activeController, setActiveController] = useState<AbortController | null>(null);
  const [progress, setProgress] = useState<{ completed: number; total: number; currentRecordIndex?: number } | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    void Promise.all([
      workspaceApi.getScenario(scenarioId),
      workspaceApi.getPromptVersion(promptVersionId),
      workspaceApi.listEvaluationRunsForPrompt(promptVersionId),
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
  }, [promptVersionId, scenarioId]);

  const handleRunEvaluation = async (): Promise<void> => {
    if (!scenario || !promptVersion) {
      return;
    }

    setError('');
    setIsRunning(true);
    const controller = new AbortController();
    setActiveController(controller);
    setProgress({ completed: 0, total: scenario.testRecords.length });

    try {
      const client = createAnthropicTextClient();
      const run = await evaluatePromptVersion({
        client,
        scenario,
        promptVersion,
        signal: controller.signal,
        onProgress: setProgress,
      });
      await workspaceApi.createEvaluationRun(run);
      setRuns((currentRuns) => [run, ...currentRuns]);
    } catch (runError) {
      setError(
        runError instanceof DOMException && runError.name === 'AbortError'
          ? 'Evaluation canceled.'
          : runError instanceof Error
            ? runError.message
            : 'Failed to run evaluation.',
      );
    } finally {
      setIsRunning(false);
      setActiveController(null);
      setProgress(null);
    }
  };

  const handleCancelEvaluation = (): void => {
    activeController?.abort(new DOMException('Evaluation canceled by the user.', 'AbortError'));
  };

  const handleCreateVersion = async (): Promise<void> => {
    if (!scenario || !promptVersion) {
      return;
    }

    setError('');
    try {
      const nextVersion = await workspaceApi.createPromptVersion({
        scenarioId: scenario.id,
        title: title.trim() || promptVersion.title,
        promptText,
        notes,
        parentVersionId: promptVersion.id,
      });
      navigate(`/scenarios/${scenario.id}/prompts/${nextVersion.id}`);
    } catch (createError) {
      setError(createError instanceof Error ? createError.message : 'Failed to create prompt version.');
    }
  };

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
        <div className='flex gap-3'>
          {isRunning ? (
            <Button type='button' variant='secondary' onClick={handleCancelEvaluation}>
              Cancel
            </Button>
          ) : null}
          <Button disabled={isRunning} type='button' onClick={handleRunEvaluation}>
            {isRunning ? 'Running...' : 'Run evaluation'}
          </Button>
        </div>
      </div>

      {error ? <div className='rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800'>{error}</div> : null}

      {isRunning && progress ? (
        <Card>
          <CardContent className='space-y-3'>
            <div className='flex items-center justify-between gap-4'>
              <p className='text-sm font-medium text-stone-900'>Evaluation in progress</p>
              <p className='text-sm text-stone-600'>
                {progress.completed} / {progress.total} completed
              </p>
            </div>
            <div className='h-2 overflow-hidden rounded-full bg-stone-200'>
              <div
                className='h-full rounded-full bg-stone-900 transition-all'
                style={{ width: `${(progress.completed / Math.max(1, progress.total)) * 100}%` }}
              />
            </div>
            <p className='text-sm text-stone-600'>
              {progress.completed >= progress.total
                ? 'Finalizing evaluation report...'
                : `Running test case ${(progress.currentRecordIndex ?? progress.completed) + 1} of ${progress.total}.`}
            </p>
          </CardContent>
        </Card>
      ) : null}

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
          <Button disabled={isRunning} type='button' variant='secondary' onClick={handleCreateVersion}>
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
};
