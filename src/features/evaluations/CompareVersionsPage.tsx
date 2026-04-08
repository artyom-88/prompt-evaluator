import type { ChangeEvent, ReactElement } from 'react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';

import { Card, CardContent, CardHeader } from '@/common/components/Card';
import { Label } from '@/common/components/Form';
import { formatPercent, formatScore } from '@/common/utils';
import { useEvaluationRuns, usePromptVersions, useScenario } from '@/features/workspace/workspaceState';
import type { EvaluationRun } from '@/features/workspace/workspaceTypes';

const latestRunForVersion = (runs: EvaluationRun[], versionId: string): EvaluationRun | undefined =>
  runs.find((run) => run.promptVersionId === versionId);

export const CompareVersionsPage = (): ReactElement => {
  const { scenarioId = '' } = useParams();
  const scenario = useScenario(scenarioId);
  const versions = usePromptVersions(scenarioId);
  const runs = useEvaluationRuns(scenarioId);
  const [leftVersionId, setLeftVersionId] = useState('');
  const [rightVersionId, setRightVersionId] = useState('');

  useEffect(() => {
    setLeftVersionId((current) => current || versions[1]?.id || versions[0]?.id || '');
    setRightVersionId((current) => current || versions[0]?.id || '');
  }, [versions]);

  const leftRun = latestRunForVersion(runs, leftVersionId);
  const rightRun = latestRunForVersion(runs, rightVersionId);
  const comparisonRows = useMemo(
    () =>
      !leftRun || !rightRun
        ? []
        : rightRun.results.map((candidateResult) => {
            const baselineResult = leftRun.results.find((result) => result.recordIndex === candidateResult.recordIndex);
            const baselineScore = baselineResult?.score ?? 0;
            const delta = candidateResult.score - baselineScore;

            return {
              id: candidateResult.id,
              baselineScore,
              candidateScore: candidateResult.score,
              delta,
              recordIndex: candidateResult.recordIndex,
            };
          }),
    [leftRun, rightRun],
  );
  const handleLeftVersionChange = useCallback((event: ChangeEvent<HTMLSelectElement>): void => {
    setLeftVersionId(event.target.value);
  }, []);
  const handleRightVersionChange = useCallback((event: ChangeEvent<HTMLSelectElement>): void => {
    setRightVersionId(event.target.value);
  }, []);

  if (!scenario) {
    return <p className='text-sm text-stone-600'>Scenario not found.</p>;
  }

  return (
    <div className='space-y-6'>
      <div>
        <Link className='text-sm font-medium text-stone-600 underline' to={`/scenarios/${scenario.id}/prompts`}>
          Back to versions
        </Link>
        <h1 className='mt-2 text-3xl font-bold tracking-tight'>Compare prompt versions</h1>
        <p className='mt-2 text-stone-600'>{scenario.title}</p>
      </div>

      <Card>
        <CardContent className='grid gap-4 md:grid-cols-2'>
          <div className='space-y-2'>
            <Label htmlFor='left-version'>Baseline</Label>
            <select
              id='left-version'
              className='w-full rounded-md border border-stone-300 bg-white px-3 py-2 text-sm'
              value={leftVersionId}
              onChange={handleLeftVersionChange}
            >
              {versions.map((version) => (
                <option key={version.id} value={version.id}>
                  v{version.versionNumber}: {version.title}
                </option>
              ))}
            </select>
          </div>
          <div className='space-y-2'>
            <Label htmlFor='right-version'>Candidate</Label>
            <select
              id='right-version'
              className='w-full rounded-md border border-stone-300 bg-white px-3 py-2 text-sm'
              value={rightVersionId}
              onChange={handleRightVersionChange}
            >
              {versions.map((version) => (
                <option key={version.id} value={version.id}>
                  v{version.versionNumber}: {version.title}
                </option>
              ))}
            </select>
          </div>
        </CardContent>
      </Card>

      {!leftRun || !rightRun ? (
        <Card>
          <CardContent className='py-8 text-center text-stone-600'>
            Both selected versions need at least one evaluation run before they can be compared.
          </CardContent>
        </Card>
      ) : (
        <>
          <div className='grid gap-4 md:grid-cols-2'>
            {[leftRun, rightRun].map((run) => (
              <Card key={run.id}>
                <CardHeader>
                  <h2 className='font-semibold'>{run.promptVersionId === leftVersionId ? 'Baseline' : 'Candidate'}</h2>
                </CardHeader>
                <CardContent>
                  <p className='text-2xl font-bold'>{formatScore(run.averageScore)} / 10</p>
                  <p className='mt-1 text-sm text-stone-600'>{formatPercent(run.passRate)} pass rate</p>
                </CardContent>
              </Card>
            ))}
          </div>

          <div className='overflow-x-auto rounded-lg border border-stone-300 bg-white'>
            <table className='min-w-full text-left text-sm'>
              <thead className='bg-stone-800 text-white'>
                <tr>
                  <th className='px-4 py-3'>Test case</th>
                  <th className='px-4 py-3'>Baseline score</th>
                  <th className='px-4 py-3'>Candidate score</th>
                  <th className='px-4 py-3'>Delta</th>
                </tr>
              </thead>
              <tbody>
                {comparisonRows.map((row) => {
                  return (
                    <tr key={row.id} className='even:bg-stone-50'>
                      <td className='border-t border-stone-200 px-4 py-3'>Test case {row.recordIndex + 1}</td>
                      <td className='border-t border-stone-200 px-4 py-3'>{formatScore(row.baselineScore)}</td>
                      <td className='border-t border-stone-200 px-4 py-3'>{formatScore(row.candidateScore)}</td>
                      <td
                        className={`border-t border-stone-200 px-4 py-3 font-semibold ${row.delta >= 0 ? 'text-emerald-700' : 'text-red-700'}`}
                      >
                        {row.delta >= 0 ? '+' : ''}
                        {formatScore(row.delta)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
};
