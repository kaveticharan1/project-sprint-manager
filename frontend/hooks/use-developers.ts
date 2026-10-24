import { keepPreviousData, useQuery } from "@tanstack/react-query";

import { api } from "@/lib/api/client";
import type { Developer, Page, Role, Task, TaskQuery } from "@/lib/api/types";
import { queryKeys } from "@/lib/query-keys";
import type { DeveloperFormOutput } from "@/lib/schemas";
import { useMutationWithRefresh } from "@/hooks/use-mutation-with-refresh";

export interface DeveloperQuery {
  q?: string;
  is_active?: boolean;
  role?: Role;
  page?: number;
  page_size?: number;
}

export function useDevelopers(params: DeveloperQuery = {}) {
  return useQuery({
    queryKey: queryKeys.developers(params),
    queryFn: ({ signal }) =>
      api<Page<Developer>>("/developers", { params: { ...params }, signal }),
    placeholderData: keepPreviousData,
  });
}

/** Every developer (for dropdowns and filters). */
export function useAllDevelopers() {
  return useDevelopers({ page_size: 200 });
}

export function useDeveloper(id: string) {
  return useQuery({
    queryKey: queryKeys.developer(id),
    queryFn: ({ signal }) => api<Developer>(`/developers/${id}`, { signal }),
  });
}

export function useDeveloperTasks(id: string, params: TaskQuery = {}) {
  return useQuery({
    queryKey: [...queryKeys.developer(id), "tasks", params],
    queryFn: ({ signal }) =>
      api<Page<Task>>(`/developers/${id}/tasks`, { params: { ...params }, signal }),
    placeholderData: keepPreviousData,
  });
}

export function useSaveDeveloper(id?: string) {
  return useMutationWithRefresh({
    mutationFn: (data: DeveloperFormOutput) =>
      id
        ? api<Developer>(`/developers/${id}`, { method: "PATCH", body: data })
        : api<Developer>("/developers", { method: "POST", body: data }),
  });
}

export function useDeleteDeveloper() {
  return useMutationWithRefresh({
    mutationFn: (id: string) => api<void>(`/developers/${id}`, { method: "DELETE" }),
  });
}

export function useSetDeveloperActive() {
  return useMutationWithRefresh({
    mutationFn: ({ id, active }: { id: string; active: boolean }) =>
      api<Developer>(`/developers/${id}/${active ? "activate" : "deactivate"}`, {
        method: "POST",
      }),
  });
}

export function useReassignTasks() {
  return useMutationWithRefresh({
    mutationFn: ({ id, targetId }: { id: string; targetId: string }) =>
      api<{ moved: number }>(`/developers/${id}/reassign-tasks`, {
        method: "POST",
        body: { target_developer_id: targetId, only_open: true },
      }),
  });
}
