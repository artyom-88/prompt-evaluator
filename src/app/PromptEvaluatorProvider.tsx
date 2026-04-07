import { createContext, type ReactNode, useContext, useMemo, useState } from 'react';

import { createLocalStorageWorkspaceApi, type WorkspaceApi } from '@/features/workspace/workspaceStore';

interface PromptEvaluatorContextValue {
  api: WorkspaceApi;
  revision: number;
  refresh(): void;
}

const PromptEvaluatorContext = createContext<PromptEvaluatorContextValue | undefined>(undefined);

export function PromptEvaluatorProvider({ children }: { children: ReactNode }) {
  const api = useMemo(() => createLocalStorageWorkspaceApi(), []);
  const [revision, setRevision] = useState(0);

  return (
    <PromptEvaluatorContext.Provider
      value={{
        api,
        revision,
        refresh: () => setRevision((current) => current + 1),
      }}
    >
      {children}
    </PromptEvaluatorContext.Provider>
  );
}

export function usePromptEvaluator() {
  const context = useContext(PromptEvaluatorContext);
  if (!context) {
    throw new Error('usePromptEvaluator must be used within PromptEvaluatorProvider.');
  }

  return context;
}
