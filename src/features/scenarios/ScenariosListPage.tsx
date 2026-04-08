import type { ChangeEvent, ReactElement } from 'react';
import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';

import { Badge } from '@/common/components/ui/Badge';
import { Button } from '@/common/components/ui/Button';
import { Card, CardContent, CardHeader } from '@/common/components/ui/Card';
import { workspaceApi } from '@/features/workspace/workspaceApi';
import type { Scenario } from '@/features/workspace/workspaceTypes';

const downloadJson = (filename: string, payload: unknown): void => {
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');

  anchor.href = url;
  anchor.download = filename;
  anchor.click();

  URL.revokeObjectURL(url);
};

const slugify = (value: string): string =>
  value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

export const ScenariosListPage = (): ReactElement => {
  const navigate = useNavigate();
  const [scenarios, setScenarios] = useState<Scenario[]>([]);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const scenarioImportRef = useRef<HTMLInputElement>(null);
  const workspaceImportRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    void workspaceApi.listScenarios().then(setScenarios);
  }, []);

  const readJsonFile = async (file: File): Promise<unknown> => JSON.parse(await file.text());

  const handleExportWorkspace = async (): Promise<void> => {
    setError('');
    const payload = await workspaceApi.exportWorkspace();
    downloadJson(`prompt-evaluator-workspace-${new Date().toISOString().slice(0, 10)}.json`, payload);
    setNotice('Workspace backup exported.');
  };

  const handleExportScenario = async (scenario: Scenario): Promise<void> => {
    setError('');
    const payload = await workspaceApi.exportScenarioBundle(scenario.id);
    downloadJson(`${slugify(scenario.title) || 'scenario'}-bundle.json`, payload);
    setNotice(`Scenario "${scenario.title}" exported.`);
  };

  const handleScenarioImport = async (event: ChangeEvent<HTMLInputElement>): Promise<void> => {
    const file = event.target.files?.[0];
    event.target.value = '';

    if (!file) {
      return;
    }

    setError('');
    setNotice('');
    try {
      const importedScenario = await workspaceApi.importScenarioBundle(await readJsonFile(file));
      setScenarios(await workspaceApi.listScenarios());
      setNotice(`Scenario "${importedScenario.title}" imported.`);
      navigate(`/scenarios/${importedScenario.id}/prompts`);
    } catch (importError) {
      setError(importError instanceof Error ? importError.message : 'Failed to import the scenario bundle.');
    }
  };

  const handleWorkspaceImport = async (event: ChangeEvent<HTMLInputElement>): Promise<void> => {
    const file = event.target.files?.[0];
    event.target.value = '';

    if (!file) {
      return;
    }

    setError('');
    setNotice('');

    try {
      const payload = await readJsonFile(file);
      const confirmed = window.confirm(
        'Importing a workspace backup will replace all existing local scenarios, prompts, and reports. Continue?',
      );

      if (!confirmed) {
        return;
      }

      await workspaceApi.importWorkspace(payload);
      setScenarios(await workspaceApi.listScenarios());
      setNotice('Workspace backup imported.');
    } catch (importError) {
      setError(importError instanceof Error ? importError.message : 'Failed to import the workspace backup.');
    }
  };

  return (
    <div className='space-y-6'>
      <div className='flex items-start justify-between gap-4'>
        <div>
          <h1 className='text-3xl font-bold tracking-tight'>Scenarios</h1>
          <p className='mt-2 text-stone-600'>Create evaluation scenarios, generate test data, and compare prompt versions.</p>
        </div>
        <div className='flex flex-wrap justify-end gap-3'>
          <input ref={scenarioImportRef} hidden accept='application/json,.json' type='file' onChange={handleScenarioImport} />
          <input ref={workspaceImportRef} hidden accept='application/json,.json' type='file' onChange={handleWorkspaceImport} />
          <Button type='button' variant='secondary' onClick={() => scenarioImportRef.current?.click()}>
            Import scenario
          </Button>
          <Button type='button' variant='secondary' onClick={() => workspaceImportRef.current?.click()}>
            Import workspace
          </Button>
          <Button type='button' variant='secondary' onClick={handleExportWorkspace}>
            Export workspace
          </Button>
          <Link
            className='rounded-md bg-stone-950 px-4 py-2 text-sm font-medium text-white hover:bg-stone-800'
            to='/scenarios/new'
          >
            New scenario
          </Link>
        </div>
      </div>

      {notice ? (
        <div className='rounded-md border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800'>{notice}</div>
      ) : null}
      {error ? <div className='rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800'>{error}</div> : null}

      {scenarios.length === 0 ? (
        <Card>
          <CardContent className='py-10 text-center'>
            <h2 className='text-xl font-semibold'>No scenarios yet</h2>
            <p className='mx-auto mt-2 max-w-2xl text-stone-600'>
              Start with the guided wizard. It will capture the scenario, JSON Schema, test data, evaluation rubric, and initial
              prompt.
            </p>
            <Link
              className='mt-6 inline-flex rounded-md bg-stone-950 px-4 py-2 text-sm font-medium text-white hover:bg-stone-800'
              to='/scenarios/new'
            >
              Create first scenario
            </Link>
          </CardContent>
        </Card>
      ) : (
        <div className='grid gap-4 md:grid-cols-2'>
          {scenarios.map((scenario) => (
            <Card key={scenario.id}>
              <CardHeader>
                <div className='flex items-start justify-between gap-4'>
                  <div>
                    <h2 className='font-semibold'>{scenario.title}</h2>
                    <p className='mt-1 line-clamp-2 text-sm text-stone-600'>{scenario.description}</p>
                  </div>
                  <Badge>{scenario.testRecords.length} records</Badge>
                </div>
              </CardHeader>
              <CardContent className='flex gap-3'>
                <Link className='text-sm font-medium text-stone-950 underline' to={`/scenarios/${scenario.id}/prompts`}>
                  Prompt versions
                </Link>
                <Link className='text-sm font-medium text-stone-950 underline' to={`/scenarios/${scenario.id}/compare`}>
                  Compare
                </Link>
                <button
                  className='text-sm font-medium text-stone-950 underline'
                  type='button'
                  onClick={() => handleExportScenario(scenario)}
                >
                  Export
                </button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};
