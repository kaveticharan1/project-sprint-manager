"use client";

import Link from "next/link";
import {
  createContext,
  Fragment,
  useContext,
  useEffect,
  useState,
  type Dispatch,
  type ReactNode,
  type SetStateAction,
} from "react";

import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";

export interface Crumb {
  label: string;
  href?: string;
}

const BreadcrumbContext = createContext<{
  crumbs: Crumb[];
  setCrumbs: Dispatch<SetStateAction<Crumb[]>>;
} | null>(null);

export function BreadcrumbProvider({ children }: { children: ReactNode }) {
  const [crumbs, setCrumbs] = useState<Crumb[]>([]);
  return (
    <BreadcrumbContext.Provider value={{ crumbs, setCrumbs }}>{children}</BreadcrumbContext.Provider>
  );
}

/** Pages declare their breadcrumb trail; the top bar renders it. */
export function useBreadcrumbs(crumbs: Crumb[]) {
  const context = useContext(BreadcrumbContext);
  const key = JSON.stringify(crumbs);
  useEffect(() => {
    context?.setCrumbs(JSON.parse(key));
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `key` captures the crumbs by value
  }, [key]);
}

export function Breadcrumbs() {
  const crumbs = useContext(BreadcrumbContext)?.crumbs ?? [];
  if (!crumbs.length) return null;
  return (
    <Breadcrumb className="min-w-0">
      <BreadcrumbList className="flex-nowrap">
        {crumbs.map((crumb, i) => {
          const last = i === crumbs.length - 1;
          return (
            <Fragment key={`${crumb.label}-${i}`}>
              <BreadcrumbItem className={last ? "min-w-0" : "hidden sm:inline-flex"}>
                {last || !crumb.href ? (
                  <BreadcrumbPage className="truncate font-medium">{crumb.label}</BreadcrumbPage>
                ) : (
                  <BreadcrumbLink asChild>
                    <Link href={crumb.href}>{crumb.label}</Link>
                  </BreadcrumbLink>
                )}
              </BreadcrumbItem>
              {!last && <BreadcrumbSeparator className="hidden sm:inline-flex" />}
            </Fragment>
          );
        })}
      </BreadcrumbList>
    </Breadcrumb>
  );
}
