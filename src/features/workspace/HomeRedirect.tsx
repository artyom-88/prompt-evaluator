import { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';

import { usePromptEvaluator } from '@/app/PromptEvaluatorProvider';

export function HomeRedirect() {
  const { api } = usePromptEvaluator();
  const [target, setTarget] = useState<string>();

  useEffect(() => {
    void api.listScenarios().then((scenarios) => {
      setTarget(scenarios.length === 0 ? '/scenarios/new' : '/scenarios');
    });
  }, [api]);

  if (!target) {
    return <p className='text-sm text-stone-600'>Loading workspace...</p>;
  }

  return <Navigate to={target} replace />;
}
