import { keepPreviousData, useQuery, useQueryClient } from "@tanstack/react-query";

import { api } from "@/lib/api/client";
import type { DashboardSummary, Page, Task, TaskQuery } from "@/lib/api/types";
import { queryKeys } from "@/lib/query-keys";
import type { TaskFormOutput } from "@/lib/schemas";
import { useMutationWithRefresh } from "@/hooks/use-mutation-with-refresh";

export function useTasks(params: TaskQuery = {}) {
  return useQuery({
    queryKey: queryKeys.tasks(params),
    queryFn: ({ signal }) => api<Page<Task>>("/tasks", { params: { ...params }, signal }),
    placeholderData: keepPreviousData,
  });
}

export function useTask(id: string | null) {
  return useQuery({
    queryKey: queryKeys.task(id ?? ""),
    queryFn: ({ signal }) => api<Task>(`/tasks/${id}`, { signal }),
    enabled: Boolean(id),
  });
}

export function useDashboard() {
  return useQuery({
    queryKey: queryKeys.dashboard,
    queryFn: ({ signal }) => api<DashboardSummary>("/dashboard/summary", { signal }),
  });
}

export function useSaveTask(id?: string) {
  return useMutationWithRefresh({
    mutationFn: (data: TaskFormOutput) =>
      id
        ? // The product of an existing task is immutable, so it isn't sent on edit.
          api<Task>(`/tasks/${id}`, { method: "PATCH", body: { ...data, product_id: undefined } })
        : api<Task>("/tasks", { method: "POST", body: data }),
  });
}

export function useDeleteTask() {
  return useMutationWithRefresh({
    mutationFn: (id: string) => api<void>(`/tasks/${id}`, { method: "DELETE" }),
  });
}

export type QuickEdit =
  | { field: "status"; value: Task["status"] }
  | { field: "severity"; value: Task["severity"] }
  | { field: "assignee"; value: string | null; developer?: Task["developer"] };

type Snapshot = [readonly unknown[], unknown][];

/** Inline edits from tables/boards: applied optimistically, rolled back if the API refuses. */
export function useQuickEditTask() {
  const queryClient = useQueryClient();

  const patch = (task: Task, edit: QuickEdit): Task => {
    if (edit.field === "assignee") {
      return { ...task, developer_id: edit.value, developer: edit.developer ?? null };
    }
    return { ...task, [edit.field]: edit.value };
  };

  return useMutationWithRefresh<Task, { task: Task; edit: QuickEdit }, Snapshot>({
    mutationFn: ({ task, edit }) => {
      const body =
        edit.field === "assignee" ? { developer_id: edit.value } : { [edit.field]: edit.value };
      return api<Task>(`/tasks/${task.id}/${edit.field}`, { method: "PATCH", body });
    },
    onMutate: async ({ task, edit }) => {
      await queryClient.cancelQueries({ queryKey: ["tasks"] });
      await queryClient.cancelQueries({ queryKey: queryKeys.task(task.id) });
      const snapshot: Snapshot = [
        ...queryClient.getQueriesData({ queryKey: ["tasks"] }),
        ...queryClient.getQueriesData({ queryKey: queryKeys.task(task.id) }),
      ];
      queryClient.setQueriesData<Page<Task>>({ queryKey: ["tasks"] }, (page) =>
        page
          ? { ...page, items: page.items.map((t) => (t.id === task.id ? patch(t, edit) : t)) }
          : page,
      );
      queryClient.setQueryData<Task>(queryKeys.task(task.id), (t) => (t ? patch(t, edit) : t));
      return snapshot;
    },
    onError: (_error, _vars, snapshot) => {
      snapshot?.forEach(([key, data]) => queryClient.setQueryData(key, data));
    },
  });
}
