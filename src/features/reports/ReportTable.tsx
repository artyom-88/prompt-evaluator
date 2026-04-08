import type { ReactElement } from 'react';
import { Card, CardContent } from '@/common/components/ui/Card';
import { formatPercent, formatScore } from '@/common/utils';
import type { EvaluationRun } from '@/features/workspace/workspaceTypes';

export const ReportTable = ({ run }: { run: EvaluationRun }): ReactElement => (
  <section className='space-y-4'>
    <div className='grid gap-4 md:grid-cols-3'>
      <Card>
        <CardContent>
          <p className='text-sm font-medium text-stone-600'>Total Test Cases</p>
          <p className='mt-3 text-2xl font-bold'>{run.results.length}</p>
        </CardContent>
      </Card>
      <Card>
        <CardContent>
          <p className='text-sm font-medium text-stone-600'>Average Score</p>
          <p className='mt-3 text-2xl font-bold'>{formatScore(run.averageScore)} / 10</p>
        </CardContent>
      </Card>
      <Card>
        <CardContent>
          <p className='text-sm font-medium text-stone-600'>Pass Rate</p>
          <p className='mt-3 text-2xl font-bold'>{formatPercent(run.passRate)}</p>
        </CardContent>
      </Card>
    </div>

    <div className='overflow-x-auto rounded-lg border border-stone-300 bg-white'>
      <table className='min-w-full border-collapse text-left text-sm'>
        <thead className='bg-stone-800 text-white'>
          <tr>
            <th className='w-56 px-4 py-3 font-semibold'>Scenario</th>
            <th className='w-72 px-4 py-3 font-semibold'>Prompt Inputs</th>
            <th className='w-72 px-4 py-3 font-semibold'>Solution Criteria</th>
            <th className='w-96 px-4 py-3 font-semibold'>Output</th>
            <th className='w-24 px-4 py-3 font-semibold'>Score</th>
            <th className='w-96 px-4 py-3 font-semibold'>Reasoning</th>
          </tr>
        </thead>
        <tbody>
          {run.results.map((result) => (
            <tr key={result.id} className='align-top even:bg-stone-50'>
              <td className='border-t border-stone-200 px-4 py-3'>Test case {result.recordIndex + 1}</td>
              <td className='border-t border-stone-200 px-4 py-3'>
                <pre className='whitespace-pre-wrap text-xs'>{JSON.stringify(result.input, null, 2)}</pre>
              </td>
              <td className='border-t border-stone-200 px-4 py-3'>
                <ul className='list-disc space-y-1 pl-4'>
                  {run.rubricSnapshot.criteria
                    .split('\n')
                    .filter(Boolean)
                    .map((criterion) => (
                      <li key={criterion}>{criterion}</li>
                    ))}
                </ul>
                {result.codeChecks.length > 0 ? (
                  <div className='mt-3 space-y-1 text-xs'>
                    {result.codeChecks.map((check) => (
                      <p key={check.name} className={check.passed ? 'text-emerald-700' : 'text-red-700'}>
                        {check.passed ? 'Pass' : 'Fail'}: {check.message}
                      </p>
                    ))}
                  </div>
                ) : null}
              </td>
              <td className='border-t border-stone-200 px-4 py-3'>
                <pre className='max-h-96 overflow-auto whitespace-pre-wrap rounded-md bg-stone-100 p-3 text-xs'>
                  {result.error ? `Error: ${result.error}` : result.output}
                </pre>
              </td>
              <td className='border-t border-stone-200 px-4 py-3'>
                <span
                  className={`rounded px-2 py-1 font-semibold ${
                    result.passed ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-800'
                  }`}
                >
                  {formatScore(result.score)}
                </span>
              </td>
              <td className='border-t border-stone-200 px-4 py-3'>{result.reasoning}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  </section>
);
