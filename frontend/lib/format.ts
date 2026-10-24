import { differenceInCalendarDays, format, formatDistanceToNowStrict, parseISO } from "date-fns";

import type { ISODate } from "@/lib/api/types";

/** Parse an API calendar date ("YYYY-MM-DD") as a local date, never shifting the day. */
export function parseDate(value: ISODate): Date {
  return parseISO(value);
}

export function toISODate(value: Date): ISODate {
  return format(value, "yyyy-MM-dd");
}

export function formatDate(value: ISODate, pattern = "MMM d, yyyy"): string {
  return format(parseDate(value), pattern);
}

export function formatShortDate(value: ISODate): string {
  return format(parseDate(value), "MMM d");
}

export function formatRange(start: ISODate, end: ISODate): string {
  const s = parseDate(start);
  const e = parseDate(end);
  if (s.getFullYear() === e.getFullYear()) {
    return `${format(s, "MMM d")} – ${format(e, "MMM d, yyyy")}`;
  }
  return `${format(s, "MMM d, yyyy")} – ${format(e, "MMM d, yyyy")}`;
}

export function relativeTime(iso: string): string {
  return `${formatDistanceToNowStrict(new Date(iso))} ago`;
}

/** "Due in 3 days" / "Due today" / "5 days overdue" relative to today. */
export function dueLabel(end: ISODate, today: Date = new Date()): string {
  const days = differenceInCalendarDays(parseDate(end), today);
  if (days === 0) return "Due today";
  if (days === 1) return "Due tomorrow";
  if (days > 1) return `Due in ${days} days`;
  if (days === -1) return "1 day overdue";
  return `${-days} days overdue`;
}

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const letters = parts.length > 1 ? parts[0][0] + parts[parts.length - 1][0] : name.slice(0, 2);
  return letters.toUpperCase();
}

export function plural(count: number, word: string, pluralWord = `${word}s`): string {
  return `${count} ${count === 1 ? word : pluralWord}`;
}

export function sprintLabel(tag: string | undefined, number: number): string {
  return tag ? `${tag} · Sprint ${number}` : `Sprint ${number}`;
}
