import { FileQuestion } from "lucide-react";
import Link from "next/link";

import { EmptyState } from "@/components/states";
import { Button } from "@/components/ui/button";

export function NotFoundState({
  entity,
  backHref,
  backLabel,
}: {
  entity: string;
  backHref: string;
  backLabel: string;
}) {
  return (
    <EmptyState
      icon={FileQuestion}
      title={`${entity} not found`}
      description={`This ${entity.toLowerCase()} doesn't exist or was deleted.`}
      action={
        <Button asChild variant="outline">
          <Link href={backHref}>{backLabel}</Link>
        </Button>
      }
    />
  );
}
