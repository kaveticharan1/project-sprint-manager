import {
  Ban,
  ChevronDown,
  ChevronsUp,
  ChevronUp,
  CircleCheck,
  CircleDashed,
  CircleDot,
  Equal,
  type LucideIcon,
} from "lucide-react";

import type { Severity, SprintState, Status } from "@/lib/api/types";

interface VisualMeta {
  icon: LucideIcon;
  /** Pill classes: background, text and ring for light and dark themes. */
  badge: string;
  /** Icon tint used on its own (selects, lists). */
  text: string;
  /** Solid color for charts and progress bars. */
  chart: string;
}

export const SEVERITY_META: Record<Severity, VisualMeta> = {
  Critical: {
    icon: ChevronsUp,
    badge: "bg-red-50 text-red-700 ring-red-600/20 dark:bg-red-500/10 dark:text-red-300 dark:ring-red-400/30",
    text: "text-red-600 dark:text-red-400",
    chart: "#dc2626",
  },
  High: {
    icon: ChevronUp,
    badge:
      "bg-orange-50 text-orange-700 ring-orange-600/20 dark:bg-orange-500/10 dark:text-orange-300 dark:ring-orange-400/30",
    text: "text-orange-600 dark:text-orange-400",
    chart: "#f97316",
  },
  Medium: {
    icon: Equal,
    badge:
      "bg-amber-50 text-amber-800 ring-amber-600/25 dark:bg-amber-500/10 dark:text-amber-300 dark:ring-amber-400/30",
    text: "text-amber-600 dark:text-amber-400",
    chart: "#eab308",
  },
  Low: {
    icon: ChevronDown,
    badge:
      "bg-sky-50 text-sky-700 ring-sky-600/20 dark:bg-sky-500/10 dark:text-sky-300 dark:ring-sky-400/30",
    text: "text-sky-600 dark:text-sky-400",
    chart: "#0284c7",
  },
};

export const STATUS_META: Record<Status, VisualMeta> = {
  "To Do": {
    icon: CircleDashed,
    badge:
      "bg-zinc-100 text-zinc-700 ring-zinc-500/20 dark:bg-zinc-500/15 dark:text-zinc-300 dark:ring-zinc-400/25",
    text: "text-zinc-500 dark:text-zinc-400",
    chart: "#a1a1aa",
  },
  "In Progress": {
    icon: CircleDot,
    badge:
      "bg-blue-50 text-blue-700 ring-blue-600/20 dark:bg-blue-500/10 dark:text-blue-300 dark:ring-blue-400/30",
    text: "text-blue-600 dark:text-blue-400",
    chart: "#2563eb",
  },
  Blocked: {
    icon: Ban,
    badge:
      "bg-rose-50 text-rose-700 ring-rose-600/20 dark:bg-rose-500/10 dark:text-rose-300 dark:ring-rose-400/30",
    text: "text-rose-600 dark:text-rose-400",
    chart: "#e11d48",
  },
  Done: {
    icon: CircleCheck,
    badge:
      "bg-emerald-50 text-emerald-700 ring-emerald-600/20 dark:bg-emerald-500/10 dark:text-emerald-300 dark:ring-emerald-400/30",
    text: "text-emerald-600 dark:text-emerald-400",
    chart: "#059669",
  },
};

export const SPRINT_STATE_BADGE: Record<SprintState, string> = {
  Active:
    "bg-emerald-50 text-emerald-700 ring-emerald-600/20 dark:bg-emerald-500/10 dark:text-emerald-300 dark:ring-emerald-400/30",
  Upcoming:
    "bg-violet-50 text-violet-700 ring-violet-600/20 dark:bg-violet-500/10 dark:text-violet-300 dark:ring-violet-400/30",
  Completed:
    "bg-zinc-100 text-zinc-600 ring-zinc-500/20 dark:bg-zinc-500/15 dark:text-zinc-300 dark:ring-zinc-400/25",
};

// Product tag pills: a hue picked deterministically from the tag text.
const TAG_PALETTE = [
  "bg-indigo-100 text-indigo-800 dark:bg-indigo-500/20 dark:text-indigo-200",
  "bg-teal-100 text-teal-800 dark:bg-teal-500/20 dark:text-teal-200",
  "bg-fuchsia-100 text-fuchsia-800 dark:bg-fuchsia-500/20 dark:text-fuchsia-200",
  "bg-cyan-100 text-cyan-800 dark:bg-cyan-500/20 dark:text-cyan-200",
  "bg-violet-100 text-violet-800 dark:bg-violet-500/20 dark:text-violet-200",
  "bg-lime-100 text-lime-800 dark:bg-lime-500/20 dark:text-lime-200",
  "bg-pink-100 text-pink-800 dark:bg-pink-500/20 dark:text-pink-200",
  "bg-slate-200 text-slate-800 dark:bg-slate-500/25 dark:text-slate-200",
];

export function tagColor(tag: string): string {
  let hash = 0;
  for (const char of tag) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  return TAG_PALETTE[hash % TAG_PALETTE.length];
}

// Avatar backgrounds, also deterministic per name.
const AVATAR_PALETTE = [
  "bg-indigo-500",
  "bg-teal-500",
  "bg-rose-500",
  "bg-amber-500",
  "bg-sky-500",
  "bg-violet-500",
  "bg-emerald-500",
  "bg-fuchsia-500",
];

export function avatarColor(seed: string): string {
  let hash = 0;
  for (const char of seed) hash = (hash * 33 + char.charCodeAt(0)) >>> 0;
  return AVATAR_PALETTE[hash % AVATAR_PALETTE.length];
}
