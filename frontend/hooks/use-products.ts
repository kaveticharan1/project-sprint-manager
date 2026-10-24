import { keepPreviousData, useQuery } from "@tanstack/react-query";

import { api } from "@/lib/api/client";
import type { Page, Product } from "@/lib/api/types";
import { queryKeys } from "@/lib/query-keys";
import type { ProductFormOutput } from "@/lib/schemas";
import { useMutationWithRefresh } from "@/hooks/use-mutation-with-refresh";

export function useProducts(params: { q?: string; page?: number; page_size?: number } = {}) {
  return useQuery({
    queryKey: queryKeys.products(params),
    queryFn: ({ signal }) => api<Page<Product>>("/products", { params: { ...params }, signal }),
    placeholderData: keepPreviousData,
  });
}

/** Every product (for dropdowns and filters). */
export function useAllProducts() {
  return useProducts({ page_size: 200 });
}

export function useProduct(id: string) {
  return useQuery({
    queryKey: queryKeys.product(id),
    queryFn: ({ signal }) => api<Product>(`/products/${id}`, { signal }),
  });
}

export function useSaveProduct(id?: string) {
  return useMutationWithRefresh({
    mutationFn: (data: ProductFormOutput) =>
      id
        ? api<Product>(`/products/${id}`, { method: "PATCH", body: data })
        : api<Product>("/products", { method: "POST", body: data }),
  });
}

export function useDeleteProduct() {
  return useMutationWithRefresh({
    mutationFn: (id: string) => api<void>(`/products/${id}`, { method: "DELETE" }),
  });
}
