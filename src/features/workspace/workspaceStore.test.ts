import { beforeEach, describe, expect, it } from 'vitest';

import { EXPECTED_RESULT_FIELD_NAME } from '@/features/test-data/testDataSchema';
import { createLocalStorageWorkspaceApi, workspaceStoreTestUtils } from '@/features/workspace/workspaceStore';
import type { EvaluationRun, ScenarioDraft } from '@/features/workspace/workspaceTypes';

const scenarioDraft: ScenarioDraft = {
  title: 'Topic extraction',
  description: 'Extract topics from content.',
  recordCount: 1,
  fieldDefinitions: [{ id: 'field_1', name: 'content', type: 'string', description: 'Source content' }],
  recordSchemaText: '{"type":"object"}',
  generationConstraints: '',
  testRecords: [{ content: 'hello', [EXPECTED_RESULT_FIELD_NAME]: 'topic a' }],
  initialPromptTitle: 'Initial',
  initialPromptText: 'Return topics for {data.content}',
};

describe('workspace localStorage API', () => {
  beforeEach(() => {
    workspaceStoreTestUtils.reset();
  });

  it('creates a scenario with an immutable initial prompt version', async () => {
    const api = createLocalStorageWorkspaceApi();
    const { scenario, initialPromptVersion } = await api.createScenario(scenarioDraft);

    expect((await api.listScenarios())[0]).toMatchObject({
      id: scenario.id,
      title: 'Topic extraction',
    });
    expect(await api.listPromptVersions(scenario.id)).toEqual([
      expect.objectContaining({
        id: initialPromptVersion.id,
        versionNumber: 1,
        promptText: scenarioDraft.initialPromptText,
      }),
    ]);
  });

  it('creates a new prompt version instead of mutating the previous one', async () => {
    const api = createLocalStorageWorkspaceApi();
    const { scenario, initialPromptVersion } = await api.createScenario(scenarioDraft);
    const secondVersion = await api.createPromptVersion({
      scenarioId: scenario.id,
      title: 'Edited',
      promptText: 'Edited prompt',
      notes: 'Changed wording',
      parentVersionId: initialPromptVersion.id,
    });

    const versions = await api.listPromptVersions(scenario.id);

    expect(versions).toHaveLength(2);
    expect(secondVersion.versionNumber).toBe(2);
    expect(await api.getPromptVersion(initialPromptVersion.id)).toMatchObject({
      promptText: scenarioDraft.initialPromptText,
    });
  });

  it('falls back to an empty store when localStorage data is malformed or inconsistent', async () => {
    const api = createLocalStorageWorkspaceApi();

    workspaceStoreTestUtils.setRaw('not-json');
    await expect(api.listScenarios()).resolves.toEqual([]);

    workspaceStoreTestUtils.setRaw(
      JSON.stringify({
        schemaVersion: 1,
        scenarios: [],
        promptVersions: [
          { id: 'prompt_1', scenarioId: 'missing', versionNumber: 1, title: 'Bad', promptText: '', notes: '', createdAt: 'now' },
        ],
        evaluationRuns: [],
      }),
    );
    await expect(api.listScenarios()).resolves.toEqual([]);
  });

  it('exports and imports a scenario bundle with fresh IDs', async () => {
    const api = createLocalStorageWorkspaceApi();
    const { scenario, initialPromptVersion } = await api.createScenario(scenarioDraft);
    const secondVersion = await api.createPromptVersion({
      scenarioId: scenario.id,
      title: 'Edited',
      promptText: 'Edited prompt',
      notes: 'Changed wording',
      parentVersionId: initialPromptVersion.id,
    });
    const run: EvaluationRun = {
      id: 'run_original',
      scenarioId: scenario.id,
      promptVersionId: secondVersion.id,
      model: 'claude-haiku-4-5',
      evaluatorVersion: 'builtin-v1',
      createdAt: '2026-04-07T00:00:00.000Z',
      testRecordsSnapshot: scenario.testRecords,
      averageScore: 8,
      passRate: 100,
      results: [
        {
          id: 'result_1',
          recordIndex: 0,
          input: scenario.testRecords[0],
          expectedResult: 'topic a',
          renderedPrompt: 'Rendered prompt',
          output: '["topic"]',
          score: 8,
          passed: true,
          reasoning: 'Looks good.',
          codeChecks: [],
        },
      ],
    };

    await api.createEvaluationRun(run);

    const bundle = await api.exportScenarioBundle(scenario.id);
    const importedScenario = await api.importScenarioBundle(bundle);
    const importedVersions = await api.listPromptVersions(importedScenario.id);
    const importedRuns = await api.listEvaluationRuns(importedScenario.id);

    expect(importedScenario.id).not.toBe(scenario.id);
    expect(importedVersions).toHaveLength(2);
    expect(importedVersions.map((version) => version.versionNumber)).toEqual([2, 1]);
    expect(importedVersions.every((version) => version.id !== initialPromptVersion.id && version.id !== secondVersion.id)).toBe(
      true,
    );
    expect(importedRuns).toHaveLength(1);
    expect(importedRuns[0].id).not.toBe(run.id);
    expect(importedRuns[0].scenarioId).toBe(importedScenario.id);
    expect(importedRuns[0].promptVersionId).toBe(importedVersions[0].id);
  });

  it('exports and imports a workspace backup by replacing all local data', async () => {
    const api = createLocalStorageWorkspaceApi();
    const { scenario } = await api.createScenario(scenarioDraft);
    const backup = await api.exportWorkspace();

    workspaceStoreTestUtils.reset();

    const nextApi = createLocalStorageWorkspaceApi();
    await nextApi.importWorkspace(backup);

    expect(await nextApi.listScenarios()).toEqual([expect.objectContaining({ id: scenario.id, title: scenario.title })]);
  });
});
