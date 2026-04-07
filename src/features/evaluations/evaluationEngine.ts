import type { AnthropicTextClient } from '@/features/anthropic/anthropicClient';
import { interpolatePrompt } from '@/features/prompts/promptTemplate';
import { extractJson } from '@/features/test-data/testDataGeneration';
import type {
  CodeCheckResult,
  EvaluationResult,
  EvaluationRubric,
  EvaluationRun,
  PromptVersion,
  Scenario,
} from '@/features/workspace/workspaceStore';

export function asStringList(value: string) {
  return value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

function hasPath(value: unknown, path: string) {
  return path.split('.').every((segment, index, segments) => {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      return false;
    }

    const objectValue = value as Record<string, unknown>;
    if (!(segment in objectValue)) {
      return false;
    }

    value = objectValue[segment];
    return index < segments.length;
  });
}

export function runCodeChecks(output: string, rubric: EvaluationRubric): CodeCheckResult[] {
  const checks: CodeCheckResult[] = [];
  let parsedJson: unknown;

  if (rubric.requireJson || rubric.requiredJsonFields.length > 0) {
    try {
      parsedJson = JSON.parse(output);
      checks.push({
        name: 'Valid JSON',
        passed: true,
        message: 'Output is valid JSON.',
      });
    } catch {
      checks.push({
        name: 'Valid JSON',
        passed: false,
        message: 'Output is not valid JSON.',
      });
    }
  }

  for (const field of rubric.requiredJsonFields) {
    const passed = parsedJson !== undefined && hasPath(parsedJson, field);
    checks.push({
      name: `Required field: ${field}`,
      passed,
      message: passed ? `JSON field "${field}" is present.` : `JSON field "${field}" is missing.`,
    });
  }

  for (const requiredText of rubric.mustContain) {
    const passed = output.toLowerCase().includes(requiredText.toLowerCase());
    checks.push({
      name: `Contains: ${requiredText}`,
      passed,
      message: passed ? `Output contains "${requiredText}".` : `Output does not contain "${requiredText}".`,
    });
  }

  return checks;
}

interface LlmGrade {
  score: number;
  passed: boolean;
  reasoning: string;
}

function isLlmGrade(value: unknown): value is LlmGrade {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const candidate = value as Record<string, unknown>;
  return typeof candidate.score === 'number' && typeof candidate.passed === 'boolean' && typeof candidate.reasoning === 'string';
}

async function gradeOutput(input: {
  client: AnthropicTextClient;
  rubric: EvaluationRubric;
  renderedPrompt: string;
  output: string;
  codeCheckSummary: string;
}) {
  const response = await input.client.complete({
    maxTokens: 1200,
    system: 'You are a strict prompt evaluation grader. Return only compact JSON.',
    prompt: [
      'Grade the model output against the criteria.',
      '',
      `<criteria>${input.rubric.criteria}</criteria>`,
      `<pass_score>${input.rubric.passScore}</pass_score>`,
      `<rendered_prompt>${input.renderedPrompt}</rendered_prompt>`,
      `<output>${input.output}</output>`,
      `<code_checks>${input.codeCheckSummary}</code_checks>`,
      '',
      'Return JSON with keys: score (0-10 number), passed (boolean), reasoning (string).',
    ].join('\n'),
  });
  const parsed = extractJson(response);

  if (!isLlmGrade(parsed)) {
    throw new Error('LLM grader returned an invalid grade object.');
  }

  return parsed;
}

export async function evaluatePromptVersion(input: {
  client: AnthropicTextClient;
  scenario: Scenario;
  promptVersion: PromptVersion;
}): Promise<EvaluationRun> {
  const results: EvaluationResult[] = [];

  for (const [recordIndex, record] of input.scenario.testRecords.entries()) {
    const renderedPrompt = interpolatePrompt(input.promptVersion.promptText, record);

    try {
      const output = await input.client.complete({
        maxTokens: 2000,
        prompt: renderedPrompt,
      });
      const codeChecks = runCodeChecks(output, input.scenario.rubric);
      const codeCheckSummary = codeChecks.map((check) => `${check.name}: ${check.passed ? 'pass' : 'fail'}`).join('; ');
      const llmGrade = await gradeOutput({
        client: input.client,
        rubric: input.scenario.rubric,
        renderedPrompt,
        output,
        codeCheckSummary,
      });
      const codeChecksPassed = codeChecks.every((check) => check.passed);

      results.push({
        id: crypto.randomUUID(),
        recordIndex,
        input: record,
        renderedPrompt,
        output,
        score: llmGrade.score,
        passed: llmGrade.passed && codeChecksPassed && llmGrade.score >= input.scenario.rubric.passScore,
        reasoning: llmGrade.reasoning,
        codeChecks,
      });
    } catch (error) {
      results.push({
        id: crypto.randomUUID(),
        recordIndex,
        input: record,
        renderedPrompt,
        output: '',
        score: 0,
        passed: false,
        reasoning: 'Evaluation failed before grading completed.',
        codeChecks: [],
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  const averageScore = results.reduce((sum, result) => sum + result.score, 0) / Math.max(1, results.length);
  const passRate = (results.filter((result) => result.passed).length / Math.max(1, results.length)) * 100;

  return {
    id: `run_${crypto.randomUUID()}`,
    scenarioId: input.scenario.id,
    promptVersionId: input.promptVersion.id,
    model: input.client.model,
    createdAt: new Date().toISOString(),
    testRecordsSnapshot: input.scenario.testRecords,
    rubricSnapshot: input.scenario.rubric,
    results,
    averageScore,
    passRate,
  };
}
