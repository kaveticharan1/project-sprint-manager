"use client";

import { useBreadcrumbs } from "@/components/layout/breadcrumbs";
import { PageHeader } from "@/components/page-header";

export function DashboardView() {
  useBreadcrumbs([{ label: "Dashboard" }]);
  return <PageHeader title="Dashboard" description="Overview of products, sprints and tasks." />;
}
