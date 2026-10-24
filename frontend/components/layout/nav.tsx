"use client";

import {
  FolderKanban,
  IterationCw,
  LayoutDashboard,
  ListTodo,
  Users,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Suspense } from "react";

import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

export const NAV_ITEMS: { href: string; label: string; icon: LucideIcon }[] = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/tasks", label: "Tasks", icon: ListTodo },
  { href: "/sprints", label: "Sprints", icon: IterationCw },
  { href: "/products", label: "Products", icon: FolderKanban },
  { href: "/developers", label: "Developers", icon: Users },
];

function isActive(pathname: string | null, href: string) {
  if (!pathname) return false;
  return href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`);
}

function NavList({
  pathname,
  iconOnly,
  onNavigate,
}: {
  pathname: string | null;
  iconOnly: boolean;
  onNavigate?: () => void;
}) {
  return (
    <ul className="flex flex-col gap-0.5">
      {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
        const active = isActive(pathname, href);
        const link = (
          <Link
            href={href}
            onClick={onNavigate}
            aria-current={active ? "page" : undefined}
            aria-label={iconOnly ? label : undefined}
            className={cn(
              "flex h-9 items-center gap-3 rounded-lg px-2.5 text-sm font-medium transition-colors outline-none",
              "text-sidebar-foreground/80 hover:bg-sidebar-accent/70 hover:text-sidebar-accent-foreground",
              "focus-visible:ring-2 focus-visible:ring-sidebar-ring",
              active && "bg-sidebar-accent text-sidebar-accent-foreground",
              iconOnly && "justify-center px-0",
            )}
          >
            <Icon
              className={cn("size-[18px] shrink-0", active ? "text-sidebar-primary" : "opacity-80")}
              aria-hidden
            />
            {!iconOnly && <span>{label}</span>}
          </Link>
        );
        return (
          <li key={href}>
            {iconOnly ? (
              <Tooltip>
                <TooltipTrigger asChild>{link}</TooltipTrigger>
                <TooltipContent side="right">{label}</TooltipContent>
              </Tooltip>
            ) : (
              link
            )}
          </li>
        );
      })}
    </ul>
  );
}

function ActiveNavList(props: { iconOnly: boolean; onNavigate?: () => void }) {
  return <NavList pathname={usePathname()} {...props} />;
}

/** Primary navigation; the active item is resolved client-side from the current path. */
export function Nav({
  iconOnly = false,
  onNavigate,
}: {
  iconOnly?: boolean;
  onNavigate?: () => void;
}) {
  return (
    <nav aria-label="Main">
      <Suspense fallback={<NavList pathname={null} iconOnly={iconOnly} />}>
        <ActiveNavList iconOnly={iconOnly} onNavigate={onNavigate} />
      </Suspense>
    </nav>
  );
}
