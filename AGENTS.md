# Agent Guidance

This file is for AI coding agents. For human-facing setup, commands, and architecture overview, read `README.md` only when needed.

## Lazy-Load Policy

- Do not load README content by default if the task is narrow and the relevant code can be inspected directly.
- Load `README.md` when the task involves setup, commands, architecture, environment variables, or contributor-facing documentation.
- Load `.codex/plans/prompt-evaluator-implementation-plan.md` only when the task asks about the implementation plan, planning history, or prior product decisions.
- Do not read `.env`; it may contain a local Anthropic API key.

## Source Organization

- Keep route configuration in `src/app/routes/`.
- Keep shared domain and localStorage persistence in `src/features/workspace/`.
- Keep feature logic in the owning folder under `src/features/`: `anthropic`, `evaluations`, `prompts`, `reports`, `scenarios`, `test-data`, or `workspace`.
- Do not create broad `services/` or `types/` folders unless a module is genuinely cross-feature and cannot fit `workspace` or `common`.
- Use clear feature/store naming in filenames and docs.

## Implementation Defaults

- Use Biome for formatting and linting. Do not add Prettier or ESLint.
- Keep TypeScript config in the single root `tsconfig.json` unless a concrete tooling conflict requires a split.
- Keep prompt versions immutable; editing a prompt creates a new version.
- Keep Anthropic browser calls local-dev only; non-dev mode must fail closed.
- Keep generated test data validation backed by the local `validate_test_data` tool and AJV.

## Verification

- For code changes, run the smallest relevant check first, then `pnpm lint`, `pnpm test`, and `pnpm build` before finalizing.
- Run `pnpm audit` after dependency changes.
- Treat the current Husky hook scripts as user-owned unless explicitly asked to change them.
- Mock Anthropic calls in tests; do not call the real API from automated tests.
