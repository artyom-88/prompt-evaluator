import { beforeEach, describe, expect, it } from 'vitest';

import { createLocalStorageWorkspaceApi, workspaceStoreTestUtils } from '@/features/workspace/workspaceStore';

const scenarioDraft = {
  title: 'Topic extraction',
  description: 'Extract topics from content.',
  recordCount: 1,
  recordSchemaText: '{"type":"object"}',
  generationConstraints: '',
  testRecords: [{ content: 'hello' }],
  rubric: {
    criteria: 'Return topics.',
    requireJson: true,
    requiredJsonFields: [],
    mustContain: [],
    passScore: 7,
  },
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
});
