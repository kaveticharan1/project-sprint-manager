import type { Metadata } from "next";

import { SprintsView } from "@/components/sprints/sprints-view";

export const metadata: Metadata = { title: "Sprints" };

export default function SprintsPage() {
  return <SprintsView />;
}
