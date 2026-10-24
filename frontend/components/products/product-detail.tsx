"use client";

import { AlertTriangle, IterationCw, ListTodo, Plus, Timer } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useState } from "react";

import { TagBadge } from "@/components/badges";
import { useBreadcrumbs } from "@/components/layout/breadcrumbs";
import { NotFoundState } from "@/components/not-found-state";
import { PageHeader } from "@/components/page-header";
import { ProductActions } from "@/components/products/product-actions";
import { SprintCard } from "@/components/sprints/sprint-card";
import { SprintFormDialog } from "@/components/sprints/sprint-form-dialog";
import { StatCard } from "@/components/stat-card";
import { CardGridSkeleton, EmptyState, ErrorState } from "@/components/states";
import { StatusBar } from "@/components/status-bar";
import { TaskListPanel } from "@/components/tasks/task-list-panel";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useProduct } from "@/hooks/use-products";
import { useSprints } from "@/hooks/use-sprints";
import { useTasks } from "@/hooks/use-tasks";
import { useUrlState } from "@/hooks/use-url-state";
import { isApiError } from "@/lib/api/client";
import { STATUSES, type Product, type Status } from "@/lib/api/types";
import { formatRange } from "@/lib/format";

export function ProductDetail() {
  const { id } = useParams<{ id: string }>();
  const url = useUrlState();
  const tab = url.get("tab") || "overview";
  const product = useProduct(id);

  useBreadcrumbs([
    { label: "Products", href: "/products" },
    { label: product.data ? `${product.data.name} (${product.data.tag})` : "Product" },
  ]);

  if (product.isPending) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-72" />
        <CardGridSkeleton count={3} />
      </div>
    );
  }
  if (product.isError) {
    return isApiError(product.error, "not_found") ? (
      <NotFoundState entity="Product" backHref="/products" backLabel="Back to products" />
    ) : (
      <ErrorState error={product.error} onRetry={() => product.refetch()} />
    );
  }
  const p = product.data;

  return (
    <>
      <PageHeader
        eyebrow={<TagBadge tag={p.tag} className="text-xs" />}
        title={p.name}
        description={p.description ?? undefined}
        actions={<ProductActions product={p} variant="page" />}
      />
      <Tabs
        value={tab}
        // Each tab keeps its own filters; switching tabs starts clean.
        onValueChange={(value) =>
          url.set({ tab: value === "overview" ? null : value, status: null, sort: null })
        }
      >
        <TabsList className="mb-4">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="sprints">
            Sprints <span className="tabular ml-1 text-muted-foreground">{p.sprint_count}</span>
          </TabsTrigger>
          <TabsTrigger value="tasks">
            Tasks <span className="tabular ml-1 text-muted-foreground">{p.task_count}</span>
          </TabsTrigger>
        </TabsList>
        <TabsContent value="overview">
          <ProductOverview product={p} />
        </TabsContent>
        <TabsContent value="sprints">
          <ProductSprints product={p} />
        </TabsContent>
        <TabsContent value="tasks">
          <TaskListPanel
            scope={{ product_id: p.id }}
            hide={["product"]}
            createDefaults={{ product_id: p.id }}
            canCreate={p.sprint_count > 0}
          />
        </TabsContent>
      </Tabs>
    </>
  );
}

function ProductOverview({ product }: { product: Product }) {
  const sprints = useSprints({ product_id: product.id, page_size: 200 });
  const overdue = useTasks({ product_id: product.id, overdue: true, page_size: 1 });
  const items = sprints.data?.items ?? [];
  const active = items.find((s) => s.state === "Active");

  // Status totals across every sprint of the product.
  const counts = Object.fromEntries(
    STATUSES.map((s) => [s, items.reduce((sum, sp) => sum + (sp.status_counts[s] ?? 0), 0)]),
  ) as Record<Status, number>;
  const overdueCount = overdue.data?.total ?? 0;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Sprints" value={product.sprint_count} icon={IterationCw} href={`/products/${product.id}?tab=sprints`} />
        <StatCard label="Tasks" value={product.task_count} icon={ListTodo} href={`/tasks?product_id=${product.id}`} />
        <StatCard label="Open tasks" value={product.open_task_count} icon={Timer} />
        <StatCard
          label="Overdue"
          value={overdueCount}
          icon={AlertTriangle}
          tone={overdueCount ? "danger" : "default"}
          href={`/tasks?product_id=${product.id}&overdue=true`}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="rounded-xl border bg-card p-5 shadow-xs">
          <h2 className="mb-4 font-semibold">Task status</h2>
          <StatusBar counts={counts} showLegend />
        </section>
        <section className="rounded-xl border bg-card p-5 shadow-xs">
          <h2 className="mb-1 font-semibold">Current sprint</h2>
          {active ? (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                <Link href={`/sprints/${active.id}`} className="font-medium text-foreground hover:underline">
                  Sprint {active.number}
                  {active.name ? ` · ${active.name}` : ""}
                </Link>{" "}
                · {formatRange(active.start_date, active.end_date)}
              </p>
              {active.goal && <p className="text-sm">{active.goal}</p>}
              <StatusBar counts={active.status_counts} showLegend />
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">No sprint is running today.</p>
          )}
        </section>
      </div>
    </div>
  );
}

function ProductSprints({ product }: { product: Product }) {
  const sprints = useSprints({ product_id: product.id, page_size: 200 });
  const [creating, setCreating] = useState(false);

  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <Button variant="outline" onClick={() => setCreating(true)}>
          <Plus aria-hidden /> New sprint
        </Button>
      </div>
      {sprints.isPending ? (
        <CardGridSkeleton count={3} />
      ) : sprints.isError ? (
        <ErrorState error={sprints.error} onRetry={() => sprints.refetch()} />
      ) : sprints.data.items.length === 0 ? (
        <EmptyState
          icon={IterationCw}
          title="No sprints yet"
          description={`Create the first sprint for ${product.name} to start adding tasks.`}
          action={
            <Button onClick={() => setCreating(true)}>
              <Plus aria-hidden /> New sprint
            </Button>
          }
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {sprints.data.items.map((s) => (
            <SprintCard key={s.id} sprint={s} showProduct={false} />
          ))}
        </div>
      )}
      <SprintFormDialog open={creating} onOpenChange={setCreating} productId={product.id} />
    </div>
  );
}
