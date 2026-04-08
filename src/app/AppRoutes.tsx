import type { ReactElement } from 'react';
import { useRoutes } from 'react-router-dom';

import { AppLayout } from '@/common/components/layout/AppLayout';
import { CompareVersionsPage } from '@/features/evaluations/CompareVersionsPage';
import { PromptDetailPage } from '@/features/prompts/PromptDetailPage';
import { PromptVersionsPage } from '@/features/prompts/PromptVersionsPage';
import { ScenariosListPage } from '@/features/scenarios/ScenariosListPage';
import { ScenarioWizardPage } from '@/features/scenarios/ScenarioWizardPage';
import { HomeRedirect } from '@/features/workspace/HomeRedirect';

export const AppRoutes = (): ReactElement | null =>
  useRoutes([
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
  ]);
