import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useRef } from "react";

type UrlValue = string | number | boolean | readonly string[] | null | undefined;

/**
 * Read and write view state (filters, sort, page) in the query string, so views are
 * shareable and survive a refresh. Changing anything but ``page`` resets to page 1.
 */
export function useUrlState() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  // router.replace commits asynchronously. Remember the last URL we asked for so a second
  // quick update builds on it instead of on the stale `searchParams` and drops the first.
  const pending = useRef<string | null>(null);
  const current = searchParams.toString();

  useEffect(() => {
    if (pending.current === current) pending.current = null;
  }, [current]);

  const set = useCallback(
    (updates: Record<string, UrlValue>) => {
      const next = new URLSearchParams(pending.current ?? current);
      for (const [key, value] of Object.entries(updates)) {
        next.delete(key);
        if (Array.isArray(value)) value.forEach((v) => next.append(key, v));
        else if (value !== null && value !== undefined && value !== "" && value !== false) {
          next.set(key, String(value));
        }
      }
      if (!("page" in updates)) next.delete("page");
      const query = next.toString();
      pending.current = query;
      router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
    },
    [pathname, router, current],
  );

  const clear = useCallback(
    (keys: string[]) => set(Object.fromEntries(keys.map((k) => [k, null]))),
    [set],
  );

  return {
    get: (key: string) => searchParams.get(key) ?? "",
    getAll: (key: string) => searchParams.getAll(key),
    page: Math.max(1, Number(searchParams.get("page")) || 1),
    set,
    clear,
  };
}
