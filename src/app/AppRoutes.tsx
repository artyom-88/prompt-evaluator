import { lazy, type ReactElement } from 'react';
import { useRoutes } from 'react-router-dom';

import { AppLayout } from '@/app/AppLayout';

const HomeRedirect = lazy(async (): Promise<{ default: typeof import('@/features/workspace/HomeRedirect').HomeRedirect }> => {
  const module = await import('@/features/workspace/HomeRedirect');

  return { default: module.HomeRedirect };
});

const ScenariosListPage = lazy(
  async (): Promise<{ default: typeof import('@/features/scenarios/ScenariosListPage').ScenariosListPage }> => {
    const module = await import('@/features/scenarios/ScenariosListPage');

    return { default: module.ScenariosListPage };
  },
);

const ScenarioWizardPage = lazy(
  async (): Promise<{ default: typeof import('@/features/scenarios/ScenarioWizardPage').ScenarioWizardPage }> => {
    const module = await import('@/features/scenarios/ScenarioWizardPage');

    return { default: module.ScenarioWizardPage };
  },
);

const PromptVersionsPage = lazy(
  async (): Promise<{ default: typeof import('@/features/prompts/PromptVersionsPage').PromptVersionsPage }> => {
    const module = await import('@/features/prompts/PromptVersionsPage');

    return { default: module.PromptVersionsPage };
  },
);

const PromptDetailPage = lazy(
  async (): Promise<{ default: typeof import('@/features/prompts/PromptDetailPage').PromptDetailPage }> => {
    const module = await import('@/features/prompts/PromptDetailPage');

    return { default: module.PromptDetailPage };
  },
);

const CompareVersionsPage = lazy(
  async (): Promise<{ default: typeof import('@/features/evaluations/CompareVersionsPage').CompareVersionsPage }> => {
    const module = await import('@/features/evaluations/CompareVersionsPage');

    return { default: module.CompareVersionsPage };
  },
);

const routes = [
  {
    element: <AppLayout />,
    children: [
      { index: true, element: <HomeRedirect /> },
      { path: 'scenarios', element: <ScenariosListPage /> },
      { path: 'scenarios/new', element: <ScenarioWizardPage /> },
      { path: 'scenarios/:scenarioId/prompts', element: <PromptVersionsPage /> },
      { path: 'scenarios/:scenarioId/prompts/:promptVersionId', element: <PromptDetailPage /> },
      { path: 'scenarios/:scenarioId/compare', element: <CompareVersionsPage /> },
    ],
  },
];

export const AppRoutes = (): ReactElement | null => {
  return useRoutes(routes);
};
