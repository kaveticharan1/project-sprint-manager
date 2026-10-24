"use client";

import { BookOpen, Menu, PanelLeftClose, PanelLeftOpen, Plus } from "lucide-react";
import Link from "next/link";
import { Suspense, useState, type ReactNode } from "react";

import { Breadcrumbs } from "@/components/layout/breadcrumbs";
import { Nav } from "@/components/layout/nav";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { useTaskUI } from "@/components/tasks/task-ui-provider";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useMediaQuery } from "@/hooks/use-media-query";
import { useStoredFlag } from "@/hooks/use-stored-flag";
import { API_URL } from "@/lib/api/client";
import { cn } from "@/lib/utils";

const DOCS_URL = API_URL.replace(/\/api\/v1$/, "") + "/docs";

function Brand({ compact = false }: { compact?: boolean }) {
  return (
    <Link
      href="/"
      className="flex items-center gap-2.5 rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring"
      aria-label="SprintFlow home"
    >
      <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-indigo-500 to-violet-600 text-sm font-bold text-white shadow-sm">
        SF
      </span>
      {!compact && (
        <span className="text-[15px] font-semibold tracking-tight text-sidebar-foreground">
          SprintFlow
        </span>
      )}
    </Link>
  );
}

function PageFallback() {
  return (
    <div className="space-y-6" aria-busy="true" aria-label="Loading page">
      <div className="space-y-2">
        <Skeleton className="h-8 w-56" />
        <Skeleton className="h-4 w-80" />
      </div>
      <Skeleton className="h-96 w-full rounded-xl" />
    </div>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const isDesktop = useMediaQuery("(min-width: 1024px)", true);
  const [collapsed, setCollapsed] = useStoredFlag("sidebar-collapsed");
  const [mobileOpen, setMobileOpen] = useState(false);
  const { openCreate } = useTaskUI();
  const iconOnly = !isDesktop || collapsed;

  return (
    <div className="flex min-h-svh">
      <aside
        className={cn(
          "sticky top-0 hidden h-svh shrink-0 flex-col border-r border-sidebar-border bg-sidebar transition-[width] duration-200 md:flex",
          iconOnly ? "w-16 items-center" : "w-60",
        )}
      >
        <div className={cn("flex h-14 items-center", iconOnly ? "justify-center" : "px-4")}>
          <Brand compact={iconOnly} />
        </div>
        <div className={cn("flex-1 overflow-y-auto py-3", iconOnly ? "px-2" : "px-3")}>
          <Nav iconOnly={iconOnly} />
        </div>
        <div
          className={cn(
            "flex gap-1 border-t border-sidebar-border p-2",
            iconOnly ? "flex-col" : "items-center",
          )}
        >
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="icon" asChild>
                <a href={DOCS_URL} target="_blank" rel="noreferrer" aria-label="API documentation">
                  <BookOpen aria-hidden />
                </a>
              </Button>
            </TooltipTrigger>
            <TooltipContent side="right">API docs</TooltipContent>
          </Tooltip>
          {isDesktop && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className={cn(!iconOnly && "ml-auto")}
                  aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
                  onClick={() => setCollapsed(!collapsed)}
                >
                  {collapsed ? <PanelLeftOpen aria-hidden /> : <PanelLeftClose aria-hidden />}
                </Button>
              </TooltipTrigger>
              <TooltipContent side="right">
                {collapsed ? "Expand" : "Collapse"} sidebar
              </TooltipContent>
            </Tooltip>
          )}
        </div>
      </aside>

      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <SheetContent side="left" className="w-64 bg-sidebar p-0">
          <SheetTitle className="sr-only">Navigation</SheetTitle>
          <SheetDescription className="sr-only">Go to a section of the app</SheetDescription>
          <div className="flex h-14 items-center px-4">
            <Brand />
          </div>
          <div className="px-3">
            <Nav onNavigate={() => setMobileOpen(false)} />
          </div>
        </SheetContent>
      </Sheet>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-14 items-center gap-2 border-b bg-background/85 px-4 backdrop-blur supports-[backdrop-filter]:bg-background/70 md:px-6">
          <Button
            variant="ghost"
            size="icon"
            className="md:hidden"
            aria-label="Open navigation"
            onClick={() => setMobileOpen(true)}
          >
            <Menu aria-hidden />
          </Button>
          <div className="min-w-0 flex-1">
            <Breadcrumbs />
          </div>
          <Button onClick={() => openCreate()} className="shadow-sm">
            <Plus aria-hidden />
            <span className="hidden sm:inline">New task</span>
            <span className="sr-only sm:hidden">New task</span>
          </Button>
          <ThemeToggle />
        </header>
        <main id="main" className="mx-auto w-full max-w-[1400px] flex-1 px-4 py-6 md:px-6 lg:px-8">
          <Suspense fallback={<PageFallback />}>{children}</Suspense>
        </main>
      </div>
    </div>
  );
}
