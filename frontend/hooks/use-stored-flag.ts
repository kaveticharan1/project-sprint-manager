import { useCallback, useSyncExternalStore } from "react";

const EVENT = "stored-flag-change";

/** A boolean persisted in localStorage and shared by every component that reads it. */
export function useStoredFlag(key: string, fallback = false): [boolean, (value: boolean) => void] {
  const value = useSyncExternalStore(
    (onChange) => {
      window.addEventListener(EVENT, onChange);
      window.addEventListener("storage", onChange);
      return () => {
        window.removeEventListener(EVENT, onChange);
        window.removeEventListener("storage", onChange);
      };
    },
    () => {
      const stored = window.localStorage.getItem(key);
      return stored === null ? fallback : stored === "true";
    },
    () => fallback,
  );

  const set = useCallback(
    (next: boolean) => {
      window.localStorage.setItem(key, String(next));
      window.dispatchEvent(new Event(EVENT));
    },
    [key],
  );

  return [value, set];
}
