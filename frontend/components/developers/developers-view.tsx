"use client";

import { Plus, SearchX, Users } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import { DeveloperAvatar, InactiveBadge } from "@/components/badges";
import { DeveloperActions } from "@/components/developers/developer-actions";
import { DeveloperFormDialog } from "@/components/developers/developer-form-dialog";
import { useBreadcrumbs } from "@/components/layout/breadcrumbs";
import { PageHeader } from "@/components/page-header";
import { Pager } from "@/components/pager";
import { SearchInput } from "@/components/search-input";
import { EmptyState, ErrorState, TableSkeleton } from "@/components/states";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { useDevelopers } from "@/hooks/use-developers";
import { useUrlState } from "@/hooks/use-url-state";
import { cn } from "@/lib/utils";

const PAGE_SIZE = 20;

export function DevelopersView() {
  useBreadcrumbs([{ label: "Developers" }]);
  const url = useUrlState();
  const q = url.get("q");
  const active = url.get("active"); // "", "true" or "false"
  const [creating, setCreating] = useState(false);

  const query = useDevelopers({
    q: q || undefined,
    is_active: active ? active === "true" : undefined,
    page: url.page,
    page_size: PAGE_SIZE,
  });
  const filtered = Boolean(q || active);

  return (
    <>
      <PageHeader
        title="Developers"
        description="The people who can be assigned tasks. Deactivate someone to stop new assignments while keeping their history."
        actions={
          <Button onClick={() => setCreating(true)}>
            <Plus aria-hidden /> Add developer
          </Button>
        }
      />

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <SearchInput
          value={q}
          onChange={(value) => url.set({ q: value })}
          placeholder="Search name or email…"
          label="Search developers"
          className="w-full sm:w-72"
        />
        <ToggleGroup
          type="single"
          variant="outline"
          value={active || "all"}
          onValueChange={(value) => value && url.set({ active: value === "all" ? null : value })}
          aria-label="Filter by status"
        >
          <ToggleGroupItem value="all" className="px-3">All</ToggleGroupItem>
          <ToggleGroupItem value="true" className="px-3">Active</ToggleGroupItem>
          <ToggleGroupItem value="false" className="px-3">Inactive</ToggleGroupItem>
        </ToggleGroup>
      </div>

      {query.isPending ? (
        <TableSkeleton columns={5} />
      ) : query.isError ? (
        <ErrorState error={query.error} onRetry={() => query.refetch()} />
      ) : query.data.items.length === 0 ? (
        filtered ? (
          <EmptyState
            icon={SearchX}
            title="No developers match"
            description="Try a different search or clear the filters."
            action={
              <Button variant="outline" onClick={() => url.clear(["q", "active"])}>
                Clear filters
              </Button>
            }
          />
        ) : (
          <EmptyState
            icon={Users}
            title="No developers yet"
            description="Add the people on your team so you can assign them tasks."
            action={
              <Button onClick={() => setCreating(true)}>
                <Plus aria-hidden /> Add developer
              </Button>
            }
          />
        )
      ) : (
        <>
          <div
            className={cn(
              "overflow-hidden rounded-xl border bg-card shadow-xs transition-opacity",
              query.isPlaceholderData && "opacity-60",
            )}
          >
            <Table className="min-w-[720px]">
              <TableHeader className="bg-muted/40">
                <TableRow className="hover:bg-transparent">
                  <TableHead className="pl-4">Developer</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Open / total tasks</TableHead>
                  <TableHead className="w-14 pr-4">
                    <span className="sr-only">Actions</span>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {query.data.items.map((dev) => (
                  <TableRow key={dev.id} className={cn(!dev.is_active && "bg-muted/30")}>
                    <TableCell className="pl-4">
                      <Link
                        href={`/developers/${dev.id}`}
                        className="flex items-center gap-3 rounded outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      >
                        <DeveloperAvatar name={dev.name} inactive={!dev.is_active} />
                        <span
                          className={cn(
                            "font-medium hover:underline",
                            !dev.is_active && "text-muted-foreground",
                          )}
                        >
                          {dev.name}
                        </span>
                      </Link>
                    </TableCell>
                    <TableCell className="text-muted-foreground">{dev.email}</TableCell>
                    <TableCell>{dev.role}</TableCell>
                    <TableCell>
                      {dev.is_active ? (
                        <span className="inline-flex items-center gap-1.5 text-sm text-emerald-700 dark:text-emerald-400">
                          <span className="size-1.5 rounded-full bg-current" aria-hidden /> Active
                        </span>
                      ) : (
                        <InactiveBadge />
                      )}
                    </TableCell>
                    <TableCell className="tabular text-right">
                      <Link
                        href={`/tasks?developer_id=${dev.id}`}
                        className="rounded hover:underline"
                        aria-label={`${dev.open_task_count} open of ${dev.task_count} tasks for ${dev.name}`}
                      >
                        <span className="font-medium">{dev.open_task_count}</span>
                        <span className="text-muted-foreground"> / {dev.task_count}</span>
                      </Link>
                    </TableCell>
                    <TableCell className="pr-4">
                      <DeveloperActions developer={dev} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <Pager
            page={query.data.page}
            pages={query.data.pages}
            total={query.data.total}
            pageSize={PAGE_SIZE}
            noun="developers"
            onPageChange={(page) => url.set({ page })}
          />
        </>
      )}

      <DeveloperFormDialog open={creating} onOpenChange={setCreating} />
    </>
  );
}
