import type { ReactElement } from 'react';
import { Navigate } from 'react-router-dom';

import { useWorkspaceScenarios } from '@/features/workspace/workspaceState';

export const HomeRedirect = (): ReactElement => {
  const scenarios = useWorkspaceScenarios();

  return <Navigate to={scenarios.length === 0 ? '/scenarios/new' : '/scenarios'} replace />;
};
