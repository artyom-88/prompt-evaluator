# Prompt Evaluator

A local-first React app for building and comparing AI prompts against generated test data. The app is designed for early prompt-evaluation workflows inspired by Anthropic prompt engineering and evaluation practices.

## What It Does

- Guides you through creating an evaluation scenario.
- Generates test records from a user-provided JSON Schema.
- Lets you write prompts with XML-style structure and `{data.field}` placeholders.
- Runs prompt evaluations with a mix of code checks and LLM grading, with per-run progress and cancellation.
- Stores scenarios, prompt versions, and evaluation runs in browser localStorage.
- Compares prompt versions under the same scenario.
- Supports scenario export/import and full workspace backup/restore.

## Local Setup

Install dependencies:

```sh
pnpm install
```

Create a local `.env` file:

```sh
cp .env.example .env
```

Set your local Anthropic key:

```sh
VITE_ANTHROPIC_API_KEY=your_local_key
VITE_ANTHROPIC_MODEL=claude-haiku-4-5
VITE_ANTHROPIC_TEST_DATA_MAX_VALIDATION_ATTEMPTS=2
```

Start the app:

```sh
pnpm dev
```

This app intentionally uses browser-direct Anthropic calls only for local development. Do not deploy this setup as-is with a browser-exposed API key.

## Commands

- `pnpm dev` starts the Vite dev server.
- `pnpm build` runs `tsc --noEmit` and creates a Vite production build.
- `pnpm test` runs the Vitest suite once.
- `pnpm test:watch` runs Vitest in watch mode.
- `pnpm lint` runs Biome formatting, import organization, and lint checks.
- `pnpm lint:fix` applies safe Biome fixes.
- `pnpm audit` checks installed packages for known advisories.

## Git Hooks

Husky installs Git hooks during `pnpm install` through the `prepare` script.

- Pre-commit: runs `pnpm pre-commit`, which type-checks with `tsc` and runs `lint-staged`.
- Pre-push: runs `pnpm build` and `pnpm test`.

## Project Structure

- `src/app/` contains the app entry route configuration and shell wiring.
- `src/common/` contains reusable layout, UI primitives, and shared utilities.
- `src/features/workspace/` owns shared domain types in `workspaceTypes.ts`, the directly imported `workspaceApi.ts`, and localStorage persistence in `workspaceStore.ts`.
- `src/features/scenarios/` owns scenario list and scenario creation UI.
- `src/features/prompts/` owns prompt version UI and prompt templating helpers.
- `src/features/test-data/` owns generated test data, JSON Schema validation, and related types.
- `src/features/evaluations/` owns prompt evaluation, code checks, and comparison UI.
- `src/features/reports/` owns report rendering components.
- `src/features/anthropic/` owns Anthropic API client integration and related client types.

Route paths are configured centrally in `src/app/AppRoutes.tsx`; feature folders do not mirror route nesting.

## Test Data Validation

Generated test data uses Claude tool use with a local `validate_test_data` client tool. Claude drafts records, calls the tool, the app validates the candidate data with AJV against the JSON Schema, and Claude repairs invalid records before returning the final JSON array.

The app still performs final local validation before saving generated records. App-owned data such as localStorage payloads and import/export files are validated separately with Zod.

## Development Notes

- Use Biome for formatting and linting; do not add Prettier or ESLint.
- Keep TypeScript configuration simple in the single root `tsconfig.json`.
- Keep dependency versions pinned exactly in `package.json`; do not use semver ranges.
- Prefer arrow functions consistently instead of `function` declarations.
- Add explicit return types to named functions and components where practical.
- Keep shared and exported feature types in dedicated `*Types.ts` files instead of implementation files.
- Keep prompt versions immutable; editing a prompt creates a new version.
- Mock Anthropic calls in automated tests.
- Run `pnpm audit` before keeping new dependencies.
