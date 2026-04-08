import { z } from 'zod';

import type {
  CodeCheckResult,
  EvaluationResult,
  EvaluationRubric,
  EvaluationRun,
  JsonObject,
  JsonValue,
  PromptVersion,
  Scenario,
  ScenarioBundle,
  WorkspaceApi,
  WorkspaceBackup,
  WorkspaceStoreData,
} from '@/features/workspace/workspaceTypes';

const STORAGE_KEY = 'prompt-evaluator:data:v1';

const SCHEMA_VERSION = 1;

const jsonValueSchema: z.ZodType<JsonValue> = z.lazy(() =>
  z.union([z.string(), z.number(), z.boolean(), z.null(), z.array(jsonValueSchema), z.record(z.string(), jsonValueSchema)]),
);

const jsonObjectSchema = z.record(z.string(), jsonValueSchema) as z.ZodType<JsonObject>;

const evaluationRubricSchema = z.object({
  criteria: z.string(),
  requireJson: z.boolean(),
  requiredJsonFields: z.array(z.string()),
  mustContain: z.array(z.string()),
  passScore: z.number(),
}) satisfies z.ZodType<EvaluationRubric>;

const scenarioSchema = z.object({
  id: z.string(),
  title: z.string(),
  description: z.string(),
  recordCount: z.number().int().nonnegative(),
  recordSchemaText: z.string(),
  generationConstraints: z.string(),
  testRecords: z.array(jsonObjectSchema),
  rubric: evaluationRubricSchema,
  createdAt: z.string(),
  updatedAt: z.string(),
}) satisfies z.ZodType<Scenario>;

const promptVersionSchema = z.object({
  id: z.string(),
  scenarioId: z.string(),
  versionNumber: z.number().int().positive(),
  title: z.string(),
  promptText: z.string(),
  notes: z.string(),
  parentVersionId: z.string().optional(),
  createdAt: z.string(),
}) satisfies z.ZodType<PromptVersion>;

const codeCheckResultSchema = z.object({
  name: z.string(),
  passed: z.boolean(),
  message: z.string(),
}) satisfies z.ZodType<CodeCheckResult>;

const evaluationResultSchema = z.object({
  id: z.string(),
  recordIndex: z.number().int().nonnegative(),
  input: jsonObjectSchema,
  renderedPrompt: z.string(),
  output: z.string(),
  score: z.number(),
  passed: z.boolean(),
  reasoning: z.string(),
  codeChecks: z.array(codeCheckResultSchema),
  error: z.string().optional(),
}) satisfies z.ZodType<EvaluationResult>;

const evaluationRunSchema = z.object({
  id: z.string(),
  scenarioId: z.string(),
  promptVersionId: z.string(),
  model: z.string(),
  createdAt: z.string(),
  testRecordsSnapshot: z.array(jsonObjectSchema),
  rubricSnapshot: evaluationRubricSchema,
  results: z.array(evaluationResultSchema),
  averageScore: z.number(),
  passRate: z.number(),
}) satisfies z.ZodType<EvaluationRun>;

const storeSchema = z.object({
  schemaVersion: z.literal(SCHEMA_VERSION),
  scenarios: z.array(scenarioSchema),
  promptVersions: z.array(promptVersionSchema),
  evaluationRuns: z.array(evaluationRunSchema),
}) satisfies z.ZodType<WorkspaceStoreData>;

const workspaceBackupSchema = z.object({
  kind: z.literal('workspace-backup'),
  exportedAt: z.string(),
  store: storeSchema,
}) satisfies z.ZodType<WorkspaceBackup>;

const scenarioBundleSchema = z.object({
  kind: z.literal('scenario-bundle'),
  exportedAt: z.string(),
  scenario: scenarioSchema,
  promptVersions: z.array(promptVersionSchema),
  evaluationRuns: z.array(evaluationRunSchema),
}) satisfies z.ZodType<ScenarioBundle>;

const emptyStore = (): WorkspaceStoreData => ({
  schemaVersion: SCHEMA_VERSION,
  scenarios: [],
  promptVersions: [],
  evaluationRuns: [],
});

const now = (): string => new Date().toISOString();

const createId = (prefix: string): string => `${prefix}_${crypto.randomUUID()}`;

const formatValidationError = (error: z.ZodError): string =>
  error.issues
    .map((issue) => {
      const path = issue.path.length > 0 ? issue.path.join('.') : 'root';
      return `${path}: ${issue.message}`;
    })
    .join('; ');

const validateStoreRelations = (store: WorkspaceStoreData): void => {
  const scenarioIds = new Set(store.scenarios.map((scenario) => scenario.id));
  const promptVersionIds = new Set(store.promptVersions.map((version) => version.id));

  for (const version of store.promptVersions) {
    if (!scenarioIds.has(version.scenarioId)) {
      throw new Error(`Invalid workspace data: prompt version ${version.id} references missing scenario ${version.scenarioId}.`);
    }
  }

  for (const run of store.evaluationRuns) {
    if (!scenarioIds.has(run.scenarioId)) {
      throw new Error(`Invalid workspace data: evaluation run ${run.id} references missing scenario ${run.scenarioId}.`);
    }

    if (!promptVersionIds.has(run.promptVersionId)) {
      throw new Error(
        `Invalid workspace data: evaluation run ${run.id} references missing prompt version ${run.promptVersionId}.`,
      );
    }
  }
};

const readStore = (): WorkspaceStoreData => {
  if (typeof localStorage === 'undefined') {
    return emptyStore();
  }

  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) {
    return emptyStore();
  }

  try {
    const parsed = JSON.parse(raw);
    const result = storeSchema.safeParse(parsed);
    if (!result.success) {
      return emptyStore();
    }

    validateStoreRelations(result.data);
    return result.data;
  } catch {
    return emptyStore();
  }
};

const writeStore = (store: WorkspaceStoreData): void => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
};

interface CreatedAtRecord {
  createdAt: string;
}

const byNewest = <T extends CreatedAtRecord>(items: T[]): T[] =>
  [...items].sort((left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime());

const parseWorkspaceBackup = (payload: unknown): WorkspaceBackup => {
  const result = workspaceBackupSchema.safeParse(payload);
  if (!result.success) {
    throw new Error(`Invalid workspace backup: ${formatValidationError(result.error)}`);
  }

  validateStoreRelations(result.data.store);

  return result.data;
};

const parseScenarioBundle = (payload: unknown): ScenarioBundle => {
  const result = scenarioBundleSchema.safeParse(payload);
  if (!result.success) {
    throw new Error(`Invalid scenario bundle: ${formatValidationError(result.error)}`);
  }

  const promptVersionIds = new Set(result.data.promptVersions.map((version) => version.id));

  for (const version of result.data.promptVersions) {
    if (version.scenarioId !== result.data.scenario.id) {
      throw new Error(`Invalid scenario bundle: prompt version ${version.id} references a different scenario.`);
    }
  }

  for (const run of result.data.evaluationRuns) {
    if (run.scenarioId !== result.data.scenario.id) {
      throw new Error(`Invalid scenario bundle: evaluation run ${run.id} references a different scenario.`);
    }

    if (!promptVersionIds.has(run.promptVersionId)) {
      throw new Error(`Invalid scenario bundle: evaluation run ${run.id} references a missing prompt version.`);
    }
  }

  return result.data;
};

const mapScenarioBundleToStore = (
  store: WorkspaceStoreData,
  bundle: ScenarioBundle,
): {
  importedScenario: Scenario;
  store: WorkspaceStoreData;
} => {
  const importedScenarioId = createId('scenario');
  const importedAt = now();
  const promptIdMap = new Map<string, string>();
  const importedScenario: Scenario = {
    ...bundle.scenario,
    id: importedScenarioId,
    createdAt: importedAt,
    updatedAt: importedAt,
  };

  const importedPromptVersions = [...bundle.promptVersions]
    .sort((left, right) => left.versionNumber - right.versionNumber)
    .map((version) => {
      const nextId = createId('prompt');
      promptIdMap.set(version.id, nextId);

      return {
        ...version,
        id: nextId,
        scenarioId: importedScenarioId,
        parentVersionId: version.parentVersionId ? promptIdMap.get(version.parentVersionId) : undefined,
      };
    });

  const importedEvaluationRuns = bundle.evaluationRuns.map((run) => {
    const promptVersionId = promptIdMap.get(run.promptVersionId);
    if (!promptVersionId) {
      throw new Error(`Invalid scenario bundle: missing imported prompt version for run ${run.id}.`);
    }

    return {
      ...run,
      id: createId('run'),
      scenarioId: importedScenarioId,
      promptVersionId,
    };
  });

  return {
    importedScenario,
    store: {
      ...store,
      scenarios: [...store.scenarios, importedScenario],
      promptVersions: [...store.promptVersions, ...importedPromptVersions],
      evaluationRuns: [...store.evaluationRuns, ...importedEvaluationRuns],
    },
  };
};

export const createLocalStorageWorkspaceApi = (): WorkspaceApi => ({
  async listScenarios(): Promise<Scenario[]> {
    return byNewest(readStore().scenarios);
  },

  async getScenario(id): Promise<Scenario | undefined> {
    return readStore().scenarios.find((scenario) => scenario.id === id);
  },

  async createScenario(draft): Promise<{ scenario: Scenario; initialPromptVersion: PromptVersion }> {
    const store = readStore();
    const timestamp = now();
    const scenario: Scenario = {
      id: createId('scenario'),
      title: draft.title,
      description: draft.description,
      recordCount: draft.recordCount,
      recordSchemaText: draft.recordSchemaText,
      generationConstraints: draft.generationConstraints,
      testRecords: draft.testRecords,
      rubric: draft.rubric,
      createdAt: timestamp,
      updatedAt: timestamp,
    };
    const initialPromptVersion: PromptVersion = {
      id: createId('prompt'),
      scenarioId: scenario.id,
      versionNumber: 1,
      title: draft.initialPromptTitle,
      promptText: draft.initialPromptText,
      notes: 'Initial prompt version',
      createdAt: timestamp,
    };

    writeStore({
      ...store,
      scenarios: [...store.scenarios, scenario],
      promptVersions: [...store.promptVersions, initialPromptVersion],
    });

    return { scenario, initialPromptVersion };
  },

  async listPromptVersions(scenarioId): Promise<PromptVersion[]> {
    return readStore()
      .promptVersions.filter((version) => version.scenarioId === scenarioId)
      .sort((left, right) => right.versionNumber - left.versionNumber);
  },

  async getPromptVersion(id): Promise<PromptVersion | undefined> {
    return readStore().promptVersions.find((version) => version.id === id);
  },

  async createPromptVersion(draft): Promise<PromptVersion> {
    const store = readStore();
    const existingVersions = store.promptVersions.filter((version) => version.scenarioId === draft.scenarioId);
    const nextVersionNumber = Math.max(0, ...existingVersions.map((version) => version.versionNumber)) + 1;
    const promptVersion: PromptVersion = {
      id: createId('prompt'),
      scenarioId: draft.scenarioId,
      versionNumber: nextVersionNumber,
      title: draft.title,
      promptText: draft.promptText,
      notes: draft.notes,
      parentVersionId: draft.parentVersionId,
      createdAt: now(),
    };

    writeStore({
      ...store,
      promptVersions: [...store.promptVersions, promptVersion],
    });

    return promptVersion;
  },

  async listEvaluationRuns(scenarioId): Promise<EvaluationRun[]> {
    return byNewest(readStore().evaluationRuns.filter((run) => run.scenarioId === scenarioId));
  },

  async listEvaluationRunsForPrompt(promptVersionId): Promise<EvaluationRun[]> {
    return byNewest(readStore().evaluationRuns.filter((run) => run.promptVersionId === promptVersionId));
  },

  async createEvaluationRun(run): Promise<EvaluationRun> {
    const parsedRun = evaluationRunSchema.safeParse(run);
    if (!parsedRun.success) {
      throw new Error(`Invalid evaluation run: ${formatValidationError(parsedRun.error)}`);
    }

    const store = readStore();
    writeStore({
      ...store,
      evaluationRuns: [...store.evaluationRuns, parsedRun.data],
    });
    return parsedRun.data;
  },

  async exportWorkspace(): Promise<WorkspaceBackup> {
    return {
      kind: 'workspace-backup',
      exportedAt: now(),
      store: readStore(),
    };
  },

  async importWorkspace(payload): Promise<void> {
    const parsedBackup = parseWorkspaceBackup(payload);
    writeStore(parsedBackup.store);
  },

  async exportScenarioBundle(scenarioId): Promise<ScenarioBundle> {
    const store = readStore();
    const scenario = store.scenarios.find((candidate) => candidate.id === scenarioId);
    if (!scenario) {
      throw new Error('Scenario not found.');
    }

    const promptVersions = store.promptVersions
      .filter((version) => version.scenarioId === scenarioId)
      .sort((left, right) => left.versionNumber - right.versionNumber);
    const promptVersionIds = new Set(promptVersions.map((version) => version.id));
    const evaluationRuns = store.evaluationRuns.filter((run) => promptVersionIds.has(run.promptVersionId));

    return {
      kind: 'scenario-bundle',
      exportedAt: now(),
      scenario,
      promptVersions,
      evaluationRuns,
    };
  },

  async importScenarioBundle(payload): Promise<Scenario> {
    const store = readStore();
    const parsedBundle = parseScenarioBundle(payload);
    const { importedScenario, store: nextStore } = mapScenarioBundleToStore(store, parsedBundle);
    writeStore(nextStore);
    return importedScenario;
  },
});

export const workspaceStoreTestUtils = {
  reset(): void {
    localStorage.removeItem(STORAGE_KEY);
  },
  setRaw(raw: string): void {
    localStorage.setItem(STORAGE_KEY, raw);
  },
  readRaw(): string | null {
    return localStorage.getItem(STORAGE_KEY);
  },
  storageKey: STORAGE_KEY,
};
