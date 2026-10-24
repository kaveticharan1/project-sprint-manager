import { useMutation, useQueryClient, type UseMutationOptions } from "@tanstack/react-query";

import type { ApiError } from "@/lib/api/client";

/**
 * A mutation that refreshes every cached query once it settles. Counts, badges and charts
 * appear on many screens, so a write anywhere should never leave another view stale.
 */
export function useMutationWithRefresh<TData, TVariables, TContext = unknown>(
  options: UseMutationOptions<TData, ApiError, TVariables, TContext>,
) {
  const queryClient = useQueryClient();
  return useMutation<TData, ApiError, TVariables, TContext>({
    ...options,
    onSettled: async (...args) => {
      await options.onSettled?.(...args);
      await queryClient.invalidateQueries();
    },
  });
}
