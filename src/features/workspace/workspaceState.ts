import { atom, useAtomValue, useSetAtom } from 'jotai';
import { useCallback, useMemo } from 'react';

import {
  createEvaluationRunInStore,
  createPromptVersionInStore,
  createScenarioInStore,
  exportScenarioBundleFromStore,
  exportWorkspaceStore,
  importScenarioBundleIntoStore,
  importWorkspaceStore,
  readWorkspaceStore,
  sortByNewest,
  writeWorkspaceStore,
} from '@/features/workspace/workspaceStore';
import type {
  EvaluationRun,
  PromptVersion,
  PromptVersionDraft,
  Scenario,
  ScenarioBundle,
  ScenarioDraft,
  WorkspaceBackup,
  WorkspaceStoreData,
} from '@/features/workspace/workspaceTypes';

let pendingStore: WorkspaceStoreData | null = null;
let persistScheduled = false;

const schedulePersist = (store: WorkspaceStoreData): void => {
  pendingStore = store;

  if (persistScheduled) {
    return;
  }

  persistScheduled = true;
  queueMicrotask(() => {
    persistScheduled = false;

    if (pendingStore) {
      writeWorkspaceStore(pendingStore);
      pendingStore = null;
    }
  });
};

export const workspaceStoreAtom = atom<WorkspaceStoreData>(readWorkspaceStore());

const replaceWorkspaceStoreAtom = atom(null, (_get, set, nextStore: WorkspaceStoreData) => {
  set(workspaceStoreAtom, nextStore);
  schedulePersist(nextStore);
});

export const scenariosAtom = atom((get) => sortByNewest(get(workspaceStoreAtom).scenarios));

export const createScenarioAtom = atom(null, (get, set, draft: ScenarioDraft) => {
  const result = createScenarioInStore(get(workspaceStoreAtom), draft);

  set(replaceWorkspaceStoreAtom, result.store);

  return {
    scenario: result.scenario,
    initialPromptVersion: result.initialPromptVersion,
  };
});

export const createPromptVersionAtom = atom(null, (get, set, draft: PromptVersionDraft) => {
  const result = createPromptVersionInStore(get(workspaceStoreAtom), draft);

  set(replaceWorkspaceStoreAtom, result.store);

  return result.promptVersion;
});

export const createEvaluationRunAtom = atom(null, (get, set, evaluationRun: EvaluationRun) => {
  const result = createEvaluationRunInStore(get(workspaceStoreAtom), evaluationRun);

  set(replaceWorkspaceStoreAtom, result.store);

  return result.evaluationRun;
});

export const importWorkspaceAtom = atom(null, (_get, set, payload: unknown) => {
  set(replaceWorkspaceStoreAtom, importWorkspaceStore(payload));
});

export const useWorkspaceScenarios = (): Scenario[] => useAtomValue(scenariosAtom);

export const useScenario = (scenarioId: string): Scenario | undefined => {
  const store = useAtomValue(workspaceStoreAtom);

  return useMemo(() => store.scenarios.find((scenario) => scenario.id === scenarioId), [scenarioId, store.scenarios]);
};

export const usePromptVersions = (scenarioId: string): PromptVersion[] => {
  const store = useAtomValue(workspaceStoreAtom);

  return useMemo(
    () =>
      store.promptVersions
        .filter((promptVersion) => promptVersion.scenarioId === scenarioId)
        .sort((left, right) => right.versionNumber - left.versionNumber),
    [scenarioId, store.promptVersions],
  );
};

export const usePromptVersion = (promptVersionId: string): PromptVersion | undefined => {
  const store = useAtomValue(workspaceStoreAtom);

  return useMemo(
    () => store.promptVersions.find((promptVersion) => promptVersion.id === promptVersionId),
    [promptVersionId, store.promptVersions],
  );
};

export const useEvaluationRuns = (scenarioId: string): EvaluationRun[] => {
  const store = useAtomValue(workspaceStoreAtom);

  return useMemo(
    () => sortByNewest(store.evaluationRuns.filter((evaluationRun) => evaluationRun.scenarioId === scenarioId)),
    [scenarioId, store.evaluationRuns],
  );
};

export const useEvaluationRunsForPrompt = (promptVersionId: string): EvaluationRun[] => {
  const store = useAtomValue(workspaceStoreAtom);

  return useMemo(
    () => sortByNewest(store.evaluationRuns.filter((evaluationRun) => evaluationRun.promptVersionId === promptVersionId)),
    [promptVersionId, store.evaluationRuns],
  );
};

export const useCreateScenario = (): ((draft: ScenarioDraft) => { scenario: Scenario; initialPromptVersion: PromptVersion }) =>
  useSetAtom(createScenarioAtom);

export const useCreatePromptVersion = (): ((draft: PromptVersionDraft) => PromptVersion) => useSetAtom(createPromptVersionAtom);

export const useCreateEvaluationRun = (): ((evaluationRun: EvaluationRun) => EvaluationRun) =>
  useSetAtom(createEvaluationRunAtom);

export const useExportWorkspace = (): (() => WorkspaceBackup) => {
  const store = useAtomValue(workspaceStoreAtom);

  return useCallback((): WorkspaceBackup => exportWorkspaceStore(store), [store]);
};

export const useImportWorkspace = (): ((payload: unknown) => void) => useSetAtom(importWorkspaceAtom);

export const useExportScenarioBundle = (): ((scenarioId: string) => ScenarioBundle) => {
  const store = useAtomValue(workspaceStoreAtom);

  return useCallback((scenarioId: string): ScenarioBundle => exportScenarioBundleFromStore(store, scenarioId), [store]);
};

export const useImportScenarioBundle = (): ((payload: unknown) => Scenario) => {
  const store = useAtomValue(workspaceStoreAtom);
  const replaceWorkspaceStore = useSetAtom(replaceWorkspaceStoreAtom);

  return useCallback(
    (payload: unknown): Scenario => {
      const result = importScenarioBundleIntoStore(store, payload);

      replaceWorkspaceStore(result.store);

      return result.importedScenario;
    },
    [replaceWorkspaceStore, store],
  );
};
