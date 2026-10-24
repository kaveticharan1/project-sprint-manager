"use client";

import { IterationCw, Plus, SearchX } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import { TagBadge } from "@/components/badges";
import { useBreadcrumbs } from "@/components/layout/breadcrumbs";
import { PageHeader } from "@/components/page-header";
import { SprintCard } from "@/components/sprints/sprint-card";
import { SprintFormDialog } from "@/components/sprints/sprint-form-dialog";
import { CardGridSkeleton, EmptyState, ErrorState } from "@/components/states";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { useAllProducts } from "@/hooks/use-products";
import { useSprints } from "@/hooks/use-sprints";
import { useUrlState } from "@/hooks/use-url-state";
import { SPRINT_STATES, type Sprint, type SprintState } from "@/lib/api/types";
import { cn } from "@/lib/utils";

const ALL = "__all__";
const STATE_ORDER: Record<SprintState, number> = { Active: 0, Upcoming: 1, Completed: 2 };

export function SprintsView() {
  useBreadcrumbs([{ label: "Sprints" }]);
  const url = useUrlState();
  const productId = url.get("product_id");
  const state = url.get("state") as SprintState | "";
  const [creating, setCreating] = useState(false);
  const products = useAllProducts();
  const query = useSprints({
    product_id: productId || undefined,
    state: state || undefined,
    page_size: 200,
  });

  // Group by product (in product-name order); inside a group, active first, then by number.
  const groups = (products.data?.items ?? [])
    .map((product) => ({
      product,
      sprints: (query.data?.items ?? [])
        .filter((s: Sprint) => s.product_id === product.id)
        .sort((a, b) => STATE_ORDER[a.state] - STATE_ORDER[b.state] || b.number - a.number),
    }))
    .filter((group) => group.sprints.length > 0);

  const filtered = Boolean(productId || state);

  return (
    <>
      <PageHeader
        title="Sprints"
        description="Time-boxed iterations per product. Status is derived from today's date."
        actions={
          <Button onClick={() => setCreating(true)}>
            <Plus aria-hidden /> New sprint
          </Button>
        }
      />

      <div className="mb-6 flex flex-wrap items-center gap-3">
        <Select
          value={productId || ALL}
          onValueChange={(value) => url.set({ product_id: value === ALL ? null : value })}
        >
          <SelectTrigger className="h-9 w-56" aria-label="Filter by product">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>All products</SelectItem>
            {products.data?.items.map((p) => (
              <SelectItem key={p.id} value={p.id}>
                <TagBadge tag={p.tag} /> {p.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <ToggleGroup
          type="single"
          variant="outline"
          value={state || "all"}
          onValueChange={(value) => value && url.set({ state: value === "all" ? null : value })}
          aria-label="Filter by sprint status"
        >
          <ToggleGroupItem value="all" className="px-3">
            All
          </ToggleGroupItem>
          {SPRINT_STATES.map((s) => (
            <ToggleGroupItem key={s} value={s} className="px-3">
              {s}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
      </div>

      {query.isPending || products.isPending ? (
        <CardGridSkeleton />
      ) : query.isError ? (
        <ErrorState error={query.error} onRetry={() => query.refetch()} />
      ) : groups.length === 0 ? (
        filtered ? (
          <EmptyState
            icon={SearchX}
            title="No sprints match these filters"
            action={
              <Button variant="outline" onClick={() => url.clear(["product_id", "state"])}>
                Clear filters
              </Button>
            }
          />
        ) : (
          <EmptyState
            icon={IterationCw}
            title="No sprints yet"
            description="Create a sprint to start planning tasks for a product."
            action={
              <Button onClick={() => setCreating(true)}>
                <Plus aria-hidden /> New sprint
              </Button>
            }
          />
        )
      ) : (
        <div className={cn("space-y-8", query.isPlaceholderData && "opacity-60")}>
          {groups.map(({ product, sprints }) => (
            <section key={product.id} aria-labelledby={`group-${product.id}`}>
              <div className="mb-3 flex items-center gap-2">
                <TagBadge tag={product.tag} />
                <h2 id={`group-${product.id}`} className="font-semibold">
                  <Link href={`/products/${product.id}`} className="hover:underline">
                    {product.name}
                  </Link>
                </h2>
                <span className="text-sm text-muted-foreground">· {sprints.length}</span>
              </div>
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {sprints.map((sprint) => (
                  <SprintCard key={sprint.id} sprint={sprint} showProduct={false} />
                ))}
              </div>
            </section>
          ))}
        </div>
      )}

      <SprintFormDialog
        open={creating}
        onOpenChange={setCreating}
        productId={productId || undefined}
      />
    </>
  );
}
