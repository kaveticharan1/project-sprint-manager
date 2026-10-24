"use client";

import { FolderKanban, IterationCw, ListTodo, Plus, SearchX } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import { TagBadge } from "@/components/badges";
import { useBreadcrumbs } from "@/components/layout/breadcrumbs";
import { PageHeader } from "@/components/page-header";
import { Pager } from "@/components/pager";
import { ProductActions } from "@/components/products/product-actions";
import { ProductFormDialog } from "@/components/products/product-form-dialog";
import { SearchInput } from "@/components/search-input";
import { CardGridSkeleton, EmptyState, ErrorState } from "@/components/states";
import { Button } from "@/components/ui/button";
import { useProducts } from "@/hooks/use-products";
import { useUrlState } from "@/hooks/use-url-state";
import type { Product } from "@/lib/api/types";
import { cn } from "@/lib/utils";

const PAGE_SIZE = 24;

function ProductCard({ product }: { product: Product }) {
  const done = product.task_count - product.open_task_count;
  const percent = product.task_count ? Math.round((done / product.task_count) * 100) : 0;
  return (
    <article className="group relative flex flex-col gap-3 rounded-xl border bg-card p-5 shadow-xs transition-colors hover:border-primary/40 has-[a:focus-visible]:ring-2 has-[a:focus-visible]:ring-ring">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 space-y-2">
          <TagBadge tag={product.tag} className="text-xs" />
          <h2 className="truncate text-base font-semibold">
            <Link
              href={`/products/${product.id}`}
              className="outline-none after:absolute after:inset-0 after:rounded-xl"
            >
              {product.name}
            </Link>
          </h2>
        </div>
        <div className="relative z-10">
          <ProductActions product={product} />
        </div>
      </div>
      <p className="line-clamp-2 min-h-10 text-sm text-muted-foreground">
        {product.description || "No description."}
      </p>
      <dl className="tabular mt-auto grid grid-cols-3 gap-2 border-t pt-3 text-sm">
        <div>
          <dt className="flex items-center gap-1 text-xs text-muted-foreground">
            <IterationCw className="size-3.5" aria-hidden /> Sprints
          </dt>
          <dd className="font-semibold">{product.sprint_count}</dd>
        </div>
        <div>
          <dt className="flex items-center gap-1 text-xs text-muted-foreground">
            <ListTodo className="size-3.5" aria-hidden /> Tasks
          </dt>
          <dd className="font-semibold">{product.task_count}</dd>
        </div>
        <div>
          <dt className="text-xs text-muted-foreground">Done</dt>
          <dd className="font-semibold">{percent}%</dd>
        </div>
      </dl>
      <div
        className="h-1.5 overflow-hidden rounded-full bg-muted"
        role="img"
        aria-label={`${percent}% of tasks done`}
      >
        <div className="h-full rounded-full bg-emerald-500" style={{ width: `${percent}%` }} />
      </div>
    </article>
  );
}

export function ProductsView() {
  useBreadcrumbs([{ label: "Products" }]);
  const url = useUrlState();
  const q = url.get("q");
  const [creating, setCreating] = useState(false);
  const query = useProducts({ q: q || undefined, page: url.page, page_size: PAGE_SIZE });

  return (
    <>
      <PageHeader
        title="Products"
        description="Each product has its own sprints and a tag that prefixes its task numbers."
        actions={
          <Button onClick={() => setCreating(true)}>
            <Plus aria-hidden /> New product
          </Button>
        }
      />
      <div className="mb-4">
        <SearchInput
          value={q}
          onChange={(value) => url.set({ q: value })}
          placeholder="Search name or tag…"
          label="Search products"
          className="w-full sm:w-72"
        />
      </div>

      {query.isPending ? (
        <CardGridSkeleton />
      ) : query.isError ? (
        <ErrorState error={query.error} onRetry={() => query.refetch()} />
      ) : query.data.items.length === 0 ? (
        q ? (
          <EmptyState
            icon={SearchX}
            title={`No products match “${q}”`}
            action={
              <Button variant="outline" onClick={() => url.clear(["q"])}>
                Clear search
              </Button>
            }
          />
        ) : (
          <EmptyState
            icon={FolderKanban}
            title="No products yet"
            description="Create a product to start planning sprints and tasks."
            action={
              <Button onClick={() => setCreating(true)}>
                <Plus aria-hidden /> New product
              </Button>
            }
          />
        )
      ) : (
        <>
          <div
            className={cn(
              "grid gap-4 sm:grid-cols-2 xl:grid-cols-3",
              query.isPlaceholderData && "opacity-60",
            )}
          >
            {query.data.items.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
          <Pager
            page={query.data.page}
            pages={query.data.pages}
            total={query.data.total}
            pageSize={PAGE_SIZE}
            noun="products"
            onPageChange={(page) => url.set({ page })}
          />
        </>
      )}

      <ProductFormDialog open={creating} onOpenChange={setCreating} />
    </>
  );
}
