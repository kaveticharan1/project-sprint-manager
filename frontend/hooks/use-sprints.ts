import { keepPreviousData, useQuery } from "@tanstack/react-query";

import { api } from "@/lib/api/client";
import type { MoveTasksResult, Page, Sprint, SprintState } from "@/lib/api/types";
import { queryKeys } from "@/lib/query-keys";
import type { SprintFormOutput } from "@/lib/schemas";
import { useMutationWithRefresh } from "@/hooks/use-mutation-with-refresh";

export interface SprintQuery {
  product_id?: string;
  state?: SprintState;
  page?: number;
  page_size?: number;
}

export function useSprints(params: SprintQuery = {}, options: { enabled?: boolean } = {}) {
  return useQuery({
    queryKey: queryKeys.sprints(params),
    queryFn: ({ signal }) => api<Page<Sprint>>("/sprints", { params: { ...params }, signal }),
    placeholderData: keepPreviousData,
    enabled: options.enabled,
  });
}

/** Every sprint of one product (for dependent dropdowns). Disabled until a product is chosen. */
export function useProductSprints(productId: string | undefined) {
  return useSprints({ product_id: productId, page_size: 200 }, { enabled: Boolean(productId) });
}

export function useSprint(id: string) {
  return useQuery({
    queryKey: queryKeys.sprint(id),
    queryFn: ({ signal }) => api<Sprint>(`/sprints/${id}`, { signal }),
  });
}

export function useSaveSprint(id?: string) {
  return useMutationWithRefresh({
    mutationFn: (data: SprintFormOutput) =>
      id
        ? api<Sprint>(`/sprints/${id}`, { method: "PATCH", body: data })
        : api<Sprint>("/sprints", { method: "POST", body: data }),
  });
}

export function useDeleteSprint() {
  return useMutationWithRefresh({
    mutationFn: (id: string) => api<void>(`/sprints/${id}`, { method: "DELETE" }),
  });
}

export interface MoveTasksInput {
  id: string;
  target_sprint_id: string;
  date_strategy: "reject" | "clamp";
  delete_source: boolean;
}

export function useMoveTasks() {
  return useMutationWithRefresh({
    mutationFn: ({ id, ...body }: MoveTasksInput) =>
      api<MoveTasksResult>(`/sprints/${id}/move-tasks`, { method: "POST", body }),
  });
}
