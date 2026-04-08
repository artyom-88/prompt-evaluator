import { createLocalStorageWorkspaceApi } from '@/features/workspace/workspaceStore';
import type { WorkspaceApi } from '@/features/workspace/workspaceTypes';

export const workspaceApi: WorkspaceApi = createLocalStorageWorkspaceApi();
