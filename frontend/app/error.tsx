"use client";

import { ErrorState } from "@/components/states";

/** Route-level error boundary: anything that throws while rendering a page lands here. */
export default function Error({ error, reset }: { error: Error; reset: () => void }) {
  return (
    <ErrorState
      error={error}
      onRetry={reset}
      title="Something went wrong on this page"
      className="mt-10"
    />
  );
}
