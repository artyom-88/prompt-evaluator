import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';

import { usePromptEvaluator } from '@/app/PromptEvaluatorProvider';
import { Badge } from '@/common/components/ui/Badge';
import { Card, CardContent, CardHeader } from '@/common/components/ui/Card';
import type { Scenario } from '@/features/workspace/workspaceStore';

export function ScenariosListPage() {
  const { api } = usePromptEvaluator();
  const [scenarios, setScenarios] = useState<Scenario[]>([]);

  useEffect(() => {
    void api.listScenarios().then(setScenarios);
  }, [api]);

  return (
    <div className='space-y-6'>
      <div className='flex items-start justify-between gap-4'>
        <div>
          <h1 className='text-3xl font-bold tracking-tight'>Scenarios</h1>
          <p className='mt-2 text-stone-600'>Create evaluation scenarios, generate test data, and compare prompt versions.</p>
        </div>
        <Link className='rounded-md bg-stone-950 px-4 py-2 text-sm font-medium text-white hover:bg-stone-800' to='/scenarios/new'>
          New scenario
        </Link>
      </div>

      {scenarios.length === 0 ? (
        <Card>
          <CardContent className='py-10 text-center'>
            <h2 className='text-xl font-semibold'>No scenarios yet</h2>
            <p className='mx-auto mt-2 max-w-2xl text-stone-600'>
              Start with the guided wizard. It will capture the scenario, JSON Schema, test data, evaluation rubric, and initial
              prompt.
            </p>
            <Link
              className='mt-6 inline-flex rounded-md bg-stone-950 px-4 py-2 text-sm font-medium text-white hover:bg-stone-800'
              to='/scenarios/new'
            >
              Create first scenario
            </Link>
          </CardContent>
        </Card>
      ) : (
        <div className='grid gap-4 md:grid-cols-2'>
          {scenarios.map((scenario) => (
            <Card key={scenario.id}>
              <CardHeader>
                <div className='flex items-start justify-between gap-4'>
                  <div>
                    <h2 className='font-semibold'>{scenario.title}</h2>
                    <p className='mt-1 line-clamp-2 text-sm text-stone-600'>{scenario.description}</p>
                  </div>
                  <Badge>{scenario.testRecords.length} records</Badge>
                </div>
              </CardHeader>
              <CardContent className='flex gap-3'>
                <Link className='text-sm font-medium text-stone-950 underline' to={`/scenarios/${scenario.id}/prompts`}>
                  Prompt versions
                </Link>
                <Link className='text-sm font-medium text-stone-950 underline' to={`/scenarios/${scenario.id}/compare`}>
                  Compare
                </Link>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
