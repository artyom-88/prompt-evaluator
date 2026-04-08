import { z } from 'zod';

import type {
  CodeCheckResult,
  EvaluationResult,
  EvaluationRun,
  JsonObject,
  JsonValue,
  PromptVersion,
  Scenario,
  ScenarioBundle,
  ScenarioDraft,
  ScenarioFieldDefinition,
  WorkspaceApi,
  WorkspaceBackup,
  WorkspaceStoreData,
} from '@/features/workspace/workspaceTypes';

const STORAGE_KEY = 'prompt-evaluator:data:v1';

const SCHEMA_VERSION = 2;

const jsonValueSchema: z.ZodType<JsonValue> = z.lazy(() =>
  z.union([z.string(), z.number(), z.boolean(), z.null(), z.array(jsonValueSchema), z.record(z.string(), jsonValueSchema)]),
);

const jsonObjectSchema = z.record(z.string(), jsonValueSchema) as z.ZodType<JsonObject>;

const scenarioFieldDefinitionSchema = z.object({
  id: z.string(),
  name: z.string().min(1),
  type: z.enum(['string', 'number', 'integer', 'boolean']),
  description: z.string().min(1),
}) satisfies z.ZodType<ScenarioFieldDefinition>;

const scenarioSchema = z.object({
  id: z.string(),
  title: z.string(),
  description: z.string(),
  recordCount: z.number().int().nonnegative(),
  fieldDefinitions: z.array(scenarioFieldDefinitionSchema),
  recordSchemaText: z.string(),
  generationConstraints: z.string(),
  testRecords: z.array(jsonObjectSchema),
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
  expectedResult: z.string(),
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
  evaluatorVersion: z.string(),
  createdAt: z.string(),
  testRecordsSnapshot: z.array(jsonObjectSchema),
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
  const promptVersionIds = new Set(store.promptVersions.map((promptVersion) => promptVersion.id));

  for (const promptVersion of store.promptVersions) {
    if (!scenarioIds.has(promptVersion.scenarioId)) {
      throw new Error(
        `Invalid workspace data: prompt version ${promptVersion.id} references missing scenario ${promptVersion.scenarioId}.`,
      );
    }
  }

  for (const evaluationRun of store.evaluationRuns) {
    if (!scenarioIds.has(evaluationRun.scenarioId)) {
      throw new Error(
        `Invalid workspace data: evaluation run ${evaluationRun.id} references missing scenario ${evaluationRun.scenarioId}.`,
      );
    }

    if (!promptVersionIds.has(evaluationRun.promptVersionId)) {
      throw new Error(
        `Invalid workspace data: evaluation run ${evaluationRun.id} references missing prompt version ${evaluationRun.promptVersionId}.`,
      );
    }
  }
};

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

  const promptVersionIds = new Set(result.data.promptVersions.map((promptVersion) => promptVersion.id));

  for (const promptVersion of result.data.promptVersions) {
    if (promptVersion.scenarioId !== result.data.scenario.id) {
      throw new Error(`Invalid scenario bundle: prompt version ${promptVersion.id} references a different scenario.`);
    }
  }

  for (const evaluationRun of result.data.evaluationRuns) {
    if (evaluationRun.scenarioId !== result.data.scenario.id) {
      throw new Error(`Invalid scenario bundle: evaluation run ${evaluationRun.id} references a different scenario.`);
    }

    if (!promptVersionIds.has(evaluationRun.promptVersionId)) {
      throw new Error(`Invalid scenario bundle: evaluation run ${evaluationRun.id} references a missing prompt version.`);
    }
  }

  return result.data;
};

interface CreatedAtRecord {
  createdAt: string;
}

export const emptyWorkspaceStore = (): WorkspaceStoreData => ({
  schemaVersion: SCHEMA_VERSION,
  scenarios: [],
  promptVersions: [],
  evaluationRuns: [],
});

export const sortByNewest = <T extends CreatedAtRecord>(items: T[]): T[] =>
  [...items].sort((left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime());

export const readWorkspaceStore = (): WorkspaceStoreData => {
  if (typeof localStorage === 'undefined') {
    return emptyWorkspaceStore();
  }

  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) {
    return emptyWorkspaceStore();
  }

  try {
    const parsed = JSON.parse(raw);
    const result = storeSchema.safeParse(parsed);
    if (!result.success) {
      return emptyWorkspaceStore();
    }

    validateStoreRelations(result.data);

    return result.data;
  } catch {
    return emptyWorkspaceStore();
  }
};

export const writeWorkspaceStore = (store: WorkspaceStoreData): void => {
  if (typeof localStorage === 'undefined') {
    return;
  }

  localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
};

export const createScenarioRecord = (
  draft: ScenarioDraft,
): {
  scenario: Scenario;
  initialPromptVersion: PromptVersion;
} => {
  const timestamp = now();
  const scenario: Scenario = {
    id: createId('scenario'),
    title: draft.title,
    description: draft.description,
    recordCount: draft.recordCount,
    fieldDefinitions: draft.fieldDefinitions,
    recordSchemaText: draft.recordSchemaText,
    generationConstraints: draft.generationConstraints,
    testRecords: draft.testRecords,
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

  return { scenario, initialPromptVersion };
};

export const createScenarioInStore = (
  store: WorkspaceStoreData,
  draft: ScenarioDraft,
): {
  store: WorkspaceStoreData;
  scenario: Scenario;
  initialPromptVersion: PromptVersion;
} => {
  const { scenario, initialPromptVersion } = createScenarioRecord(draft);

  return {
    store: {
      ...store,
      scenarios: [...store.scenarios, scenario],
      promptVersions: [...store.promptVersions, initialPromptVersion],
    },
    scenario,
    initialPromptVersion,
  };
};

export const createPromptVersionInStore = (
  store: WorkspaceStoreData,
  draft: {
    scenarioId: string;
    title: string;
    promptText: string;
    notes: string;
    parentVersionId?: string;
  },
): {
  store: WorkspaceStoreData;
  promptVersion: PromptVersion;
} => {
  const existingVersions = store.promptVersions.filter((promptVersion) => promptVersion.scenarioId === draft.scenarioId);
  const nextVersionNumber = Math.max(0, ...existingVersions.map((promptVersion) => promptVersion.versionNumber)) + 1;
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

  return {
    store: {
      ...store,
      promptVersions: [...store.promptVersions, promptVersion],
    },
    promptVersion,
  };
};

export const createEvaluationRunInStore = (
  store: WorkspaceStoreData,
  evaluationRun: EvaluationRun,
): {
  store: WorkspaceStoreData;
  evaluationRun: EvaluationRun;
} => {
  const parsedRun = evaluationRunSchema.safeParse(evaluationRun);
  if (!parsedRun.success) {
    throw new Error(`Invalid evaluation run: ${formatValidationError(parsedRun.error)}`);
  }

  return {
    store: {
      ...store,
      evaluationRuns: [...store.evaluationRuns, parsedRun.data],
    },
    evaluationRun: parsedRun.data,
  };
};

export const exportWorkspaceStore = (store: WorkspaceStoreData): WorkspaceBackup => ({
  kind: 'workspace-backup',
  exportedAt: now(),
  store,
});

export const importWorkspaceStore = (payload: unknown): WorkspaceStoreData => parseWorkspaceBackup(payload).store;

export const exportScenarioBundleFromStore = (store: WorkspaceStoreData, scenarioId: string): ScenarioBundle => {
  const scenario = store.scenarios.find((candidate) => candidate.id === scenarioId);
  if (!scenario) {
    throw new Error('Scenario not found.');
  }

  const promptVersions = store.promptVersions
    .filter((promptVersion) => promptVersion.scenarioId === scenarioId)
    .sort((left, right) => left.versionNumber - right.versionNumber);
  const promptVersionIds = new Set(promptVersions.map((promptVersion) => promptVersion.id));
  const evaluationRuns = store.evaluationRuns.filter((evaluationRun) => promptVersionIds.has(evaluationRun.promptVersionId));

  return {
    kind: 'scenario-bundle',
    exportedAt: now(),
    scenario,
    promptVersions,
    evaluationRuns,
  };
};

export const importScenarioBundleIntoStore = (
  store: WorkspaceStoreData,
  payload: unknown,
): {
  store: WorkspaceStoreData;
  importedScenario: Scenario;
} => {
  const bundle = parseScenarioBundle(payload);
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
    .map((promptVersion) => {
      const nextId = createId('prompt');
      promptIdMap.set(promptVersion.id, nextId);

      return {
        ...promptVersion,
        id: nextId,
        scenarioId: importedScenarioId,
        parentVersionId: promptVersion.parentVersionId ? promptIdMap.get(promptVersion.parentVersionId) : undefined,
      };
    });
  const importedEvaluationRuns = bundle.evaluationRuns.map((evaluationRun) => {
    const promptVersionId = promptIdMap.get(evaluationRun.promptVersionId);
    if (!promptVersionId) {
      throw new Error(`Invalid scenario bundle: missing imported prompt version for run ${evaluationRun.id}.`);
    }

    return {
      ...evaluationRun,
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
    return sortByNewest(readWorkspaceStore().scenarios);
  },

  async getScenario(id): Promise<Scenario | undefined> {
    return readWorkspaceStore().scenarios.find((scenario) => scenario.id === id);
  },

  async createScenario(draft): Promise<{ scenario: Scenario; initialPromptVersion: PromptVersion }> {
    const result = createScenarioInStore(readWorkspaceStore(), draft);
    writeWorkspaceStore(result.store);

    return {
      scenario: result.scenario,
      initialPromptVersion: result.initialPromptVersion,
    };
  },

  async listPromptVersions(scenarioId): Promise<PromptVersion[]> {
    return readWorkspaceStore()
      .promptVersions.filter((promptVersion) => promptVersion.scenarioId === scenarioId)
      .sort((left, right) => right.versionNumber - left.versionNumber);
  },

  async getPromptVersion(id): Promise<PromptVersion | undefined> {
    return readWorkspaceStore().promptVersions.find((promptVersion) => promptVersion.id === id);
  },

  async createPromptVersion(draft): Promise<PromptVersion> {
    const result = createPromptVersionInStore(readWorkspaceStore(), draft);
    writeWorkspaceStore(result.store);

    return result.promptVersion;
  },

  async listEvaluationRuns(scenarioId): Promise<EvaluationRun[]> {
    return sortByNewest(readWorkspaceStore().evaluationRuns.filter((evaluationRun) => evaluationRun.scenarioId === scenarioId));
  },

  async listEvaluationRunsForPrompt(promptVersionId): Promise<EvaluationRun[]> {
    return sortByNewest(
      readWorkspaceStore().evaluationRuns.filter((evaluationRun) => evaluationRun.promptVersionId === promptVersionId),
    );
  },

  async createEvaluationRun(evaluationRun): Promise<EvaluationRun> {
    const result = createEvaluationRunInStore(readWorkspaceStore(), evaluationRun);
    writeWorkspaceStore(result.store);

    return result.evaluationRun;
  },

  async exportWorkspace(): Promise<WorkspaceBackup> {
    return exportWorkspaceStore(readWorkspaceStore());
  },

  async importWorkspace(payload): Promise<void> {
    writeWorkspaceStore(importWorkspaceStore(payload));
  },

  async exportScenarioBundle(scenarioId): Promise<ScenarioBundle> {
    return exportScenarioBundleFromStore(readWorkspaceStore(), scenarioId);
  },

  async importScenarioBundle(payload): Promise<Scenario> {
    const result = importScenarioBundleIntoStore(readWorkspaceStore(), payload);
    writeWorkspaceStore(result.store);

    return result.importedScenario;
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
