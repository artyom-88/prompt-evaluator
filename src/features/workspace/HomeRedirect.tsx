import type { ReactElement } from 'react';
import { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';

import { workspaceApi } from '@/features/workspace/workspaceApi';

export const HomeRedirect = (): ReactElement => {
  const [target, setTarget] = useState<string>();

  useEffect(() => {
    void workspaceApi.listScenarios().then((scenarios) => {
      setTarget(scenarios.length === 0 ? '/scenarios/new' : '/scenarios');
    });
  }, []);

  if (!target) {
    return <p className='text-sm text-stone-600'>Loading workspace...</p>;
  }

  return <Navigate to={target} replace />;
};
