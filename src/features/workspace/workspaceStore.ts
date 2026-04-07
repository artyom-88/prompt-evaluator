export type JsonValue = string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue };

export type JsonObject = { [key: string]: JsonValue };

export interface EvaluationRubric {
  criteria: string;
  requireJson: boolean;
  requiredJsonFields: string[];
  mustContain: string[];
  passScore: number;
}

export interface Scenario {
  id: string;
  title: string;
  description: string;
  recordCount: number;
  recordSchemaText: string;
  generationConstraints: string;
  testRecords: JsonObject[];
  rubric: EvaluationRubric;
  createdAt: string;
  updatedAt: string;
}

export interface PromptVersion {
  id: string;
  scenarioId: string;
  versionNumber: number;
  title: string;
  promptText: string;
  notes: string;
  parentVersionId?: string;
  createdAt: string;
}

export interface CodeCheckResult {
  name: string;
  passed: boolean;
  message: string;
}

export interface EvaluationResult {
  id: string;
  recordIndex: number;
  input: JsonObject;
  renderedPrompt: string;
  output: string;
  score: number;
  passed: boolean;
  reasoning: string;
  codeChecks: CodeCheckResult[];
  error?: string;
}

export interface EvaluationRun {
  id: string;
  scenarioId: string;
  promptVersionId: string;
  model: string;
  createdAt: string;
  testRecordsSnapshot: JsonObject[];
  rubricSnapshot: EvaluationRubric;
  results: EvaluationResult[];
  averageScore: number;
  passRate: number;
}

export interface ScenarioDraft {
  title: string;
  description: string;
  recordCount: number;
  recordSchemaText: string;
  generationConstraints: string;
  testRecords: JsonObject[];
  rubric: EvaluationRubric;
  initialPromptTitle: string;
  initialPromptText: string;
}

export interface PromptVersionDraft {
  scenarioId: string;
  title: string;
  promptText: string;
  notes: string;
  parentVersionId?: string;
}

export interface WorkspaceApi {
  listScenarios(): Promise<Scenario[]>;
  getScenario(id: string): Promise<Scenario | undefined>;
  createScenario(draft: ScenarioDraft): Promise<{
    scenario: Scenario;
    initialPromptVersion: PromptVersion;
  }>;
  listPromptVersions(scenarioId: string): Promise<PromptVersion[]>;
  getPromptVersion(id: string): Promise<PromptVersion | undefined>;
  createPromptVersion(draft: PromptVersionDraft): Promise<PromptVersion>;
  listEvaluationRuns(scenarioId: string): Promise<EvaluationRun[]>;
  listEvaluationRunsForPrompt(promptVersionId: string): Promise<EvaluationRun[]>;
  createEvaluationRun(run: EvaluationRun): Promise<EvaluationRun>;
}

const STORAGE_KEY = 'prompt-evaluator:data:v1';
const SCHEMA_VERSION = 1;

interface Store {
  schemaVersion: number;
  scenarios: Scenario[];
  promptVersions: PromptVersion[];
  evaluationRuns: EvaluationRun[];
}

const emptyStore = (): Store => ({
  schemaVersion: SCHEMA_VERSION,
  scenarios: [],
  promptVersions: [],
  evaluationRuns: [],
});

function now() {
  return new Date().toISOString();
}

function createId(prefix: string) {
  return `${prefix}_${crypto.randomUUID()}`;
}

function readStore(): Store {
  if (typeof localStorage === 'undefined') {
    return emptyStore();
  }

  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) {
    return emptyStore();
  }

  try {
    const parsed = JSON.parse(raw) as Partial<Store>;
    if (parsed.schemaVersion !== SCHEMA_VERSION) {
      return emptyStore();
    }

    return {
      schemaVersion: SCHEMA_VERSION,
      scenarios: parsed.scenarios ?? [],
      promptVersions: parsed.promptVersions ?? [],
      evaluationRuns: parsed.evaluationRuns ?? [],
    };
  } catch {
    return emptyStore();
  }
}

function writeStore(store: Store) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
}

function byNewest<T extends { createdAt: string }>(items: T[]) {
  return [...items].sort((left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime());
}

export function createLocalStorageWorkspaceApi(): WorkspaceApi {
  return {
    async listScenarios() {
      return byNewest(readStore().scenarios);
    },

    async getScenario(id) {
      return readStore().scenarios.find((scenario) => scenario.id === id);
    },

    async createScenario(draft) {
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

    async listPromptVersions(scenarioId) {
      return readStore()
        .promptVersions.filter((version) => version.scenarioId === scenarioId)
        .sort((left, right) => right.versionNumber - left.versionNumber);
    },

    async getPromptVersion(id) {
      return readStore().promptVersions.find((version) => version.id === id);
    },

    async createPromptVersion(draft) {
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

    async listEvaluationRuns(scenarioId) {
      return byNewest(readStore().evaluationRuns.filter((run) => run.scenarioId === scenarioId));
    },

    async listEvaluationRunsForPrompt(promptVersionId) {
      return byNewest(readStore().evaluationRuns.filter((run) => run.promptVersionId === promptVersionId));
    },

    async createEvaluationRun(run) {
      const store = readStore();
      writeStore({
        ...store,
        evaluationRuns: [...store.evaluationRuns, run],
      });
      return run;
    },
  };
}

export const workspaceStoreTestUtils = {
  reset() {
    localStorage.removeItem(STORAGE_KEY);
  },
  storageKey: STORAGE_KEY,
};
