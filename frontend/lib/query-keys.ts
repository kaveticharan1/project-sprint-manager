import type { TaskQuery } from "@/lib/api/types";

export const queryKeys = {
  dashboard: ["dashboard"] as const,
  developers: (params: object = {}) => ["developers", params] as const,
  developer: (id: string) => ["developer", id] as const,
  products: (params: object = {}) => ["products", params] as const,
  product: (id: string) => ["product", id] as const,
  sprints: (params: object = {}) => ["sprints", params] as const,
  sprint: (id: string) => ["sprint", id] as const,
  tasks: (params: TaskQuery = {}) => ["tasks", params] as const,
  task: (id: string) => ["task", id] as const,
};
