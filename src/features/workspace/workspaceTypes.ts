export type JsonValue = string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue };

export interface JsonObject {
  [key: string]: JsonValue;
}

export type ScenarioFieldType = 'string' | 'number' | 'integer' | 'boolean';

export interface ScenarioFieldDefinition {
  id: string;
  name: string;
  type: ScenarioFieldType;
  description: string;
}

export interface Scenario {
  id: string;
  title: string;
  description: string;
  recordCount: number;
  fieldDefinitions: ScenarioFieldDefinition[];
  recordSchemaText: string;
  generationConstraints: string;
  testRecords: JsonObject[];
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
  expectedResult: string;
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
  evaluatorVersion: string;
  createdAt: string;
  testRecordsSnapshot: JsonObject[];
  results: EvaluationResult[];
  averageScore: number;
  passRate: number;
}

export interface ScenarioDraft {
  title: string;
  description: string;
  recordCount: number;
  fieldDefinitions: ScenarioFieldDefinition[];
  recordSchemaText: string;
  generationConstraints: string;
  testRecords: JsonObject[];
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

export interface WorkspaceStoreData {
  schemaVersion: number;
  scenarios: Scenario[];
  promptVersions: PromptVersion[];
  evaluationRuns: EvaluationRun[];
}

export interface WorkspaceBackup {
  kind: 'workspace-backup';
  exportedAt: string;
  store: WorkspaceStoreData;
}

export interface ScenarioBundle {
  kind: 'scenario-bundle';
  exportedAt: string;
  scenario: Scenario;
  promptVersions: PromptVersion[];
  evaluationRuns: EvaluationRun[];
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
  exportWorkspace(): Promise<WorkspaceBackup>;
  importWorkspace(payload: unknown): Promise<void>;
  exportScenarioBundle(scenarioId: string): Promise<ScenarioBundle>;
  importScenarioBundle(payload: unknown): Promise<Scenario>;
}
