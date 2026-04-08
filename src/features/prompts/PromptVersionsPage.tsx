import type { ReactElement } from 'react';
import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';

import { Badge } from '@/common/components/ui/Badge';
import { Card, CardContent, CardHeader } from '@/common/components/ui/Card';
import { formatPercent, formatScore } from '@/common/utils';
import { workspaceApi } from '@/features/workspace/workspaceApi';
import type { EvaluationRun, PromptVersion, Scenario } from '@/features/workspace/workspaceTypes';

export const PromptVersionsPage = (): ReactElement => {
  const { scenarioId = '' } = useParams();
  const [scenario, setScenario] = useState<Scenario>();
  const [versions, setVersions] = useState<PromptVersion[]>([]);
  const [runs, setRuns] = useState<EvaluationRun[]>([]);

  useEffect(() => {
    void Promise.all([
      workspaceApi.getScenario(scenarioId),
      workspaceApi.listPromptVersions(scenarioId),
      workspaceApi.listEvaluationRuns(scenarioId),
    ]).then(([nextScenario, nextVersions, nextRuns]) => {
      setScenario(nextScenario);
      setVersions(nextVersions);
      setRuns(nextRuns);
    });
  }, [scenarioId]);

  if (!scenario) {
    return <p className='text-sm text-stone-600'>Scenario not found.</p>;
  }

  return (
    <div className='space-y-6'>
      <div className='flex items-start justify-between gap-4'>
        <div>
          <h1 className='text-3xl font-bold tracking-tight'>{scenario.title}</h1>
          <p className='mt-2 max-w-3xl text-stone-600'>{scenario.description}</p>
        </div>
        <Link
          className='rounded-md border border-stone-300 bg-white px-4 py-2 text-sm font-medium hover:bg-stone-50'
          to={`/scenarios/${scenario.id}/compare`}
        >
          Compare versions
        </Link>
      </div>

      <div className='grid gap-4'>
        {versions.map((version) => {
          const latestRun = runs.find((run) => run.promptVersionId === version.id);

          return (
            <Card key={version.id}>
              <CardHeader>
                <div className='flex items-start justify-between gap-4'>
                  <div>
                    <h2 className='font-semibold'>
                      v{version.versionNumber}: {version.title}
                    </h2>
                    <p className='mt-1 text-sm text-stone-600'>{version.notes || 'No version notes.'}</p>
                  </div>
                  <Badge>{new Date(version.createdAt).toLocaleString()}</Badge>
                </div>
              </CardHeader>
              <CardContent className='flex flex-wrap items-center gap-4 text-sm'>
                <Link className='font-medium text-stone-950 underline' to={`/scenarios/${scenario.id}/prompts/${version.id}`}>
                  Open prompt
                </Link>
                {latestRun ? (
                  <span className='text-stone-600'>
                    Latest run: {formatScore(latestRun.averageScore)} / 10, {formatPercent(latestRun.passRate)} pass rate
                  </span>
                ) : (
                  <span className='text-stone-500'>No evaluations yet</span>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
};
