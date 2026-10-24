import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { SeverityBadge, StatusBadge, TagBadge } from "@/components/badges";
import { SEVERITIES, STATUSES } from "@/lib/api/types";
import { SEVERITY_META, STATUS_META, tagColor } from "@/lib/meta";

describe("StatusBadge", () => {
  it.each(STATUSES)("shows icon and text for %s, never color alone", (status) => {
    const { container } = render(<StatusBadge status={status} />);
    const badge = screen.getByText(status);
    expect(badge).toHaveAttribute("data-status", status);
    expect(container.querySelector("svg")).not.toBeNull();
    for (const cls of STATUS_META[status].badge.split(" ").slice(0, 2)) {
      expect(badge).toHaveClass(cls);
    }
  });

  it("uses a distinct color for every status", () => {
    const colors = STATUSES.map((s) => STATUS_META[s].badge.split(" ")[0]);
    expect(new Set(colors).size).toBe(STATUSES.length);
  });

  it("maps statuses to the agreed hues", () => {
    expect(STATUS_META["To Do"].badge).toContain("zinc");
    expect(STATUS_META["In Progress"].badge).toContain("blue");
    expect(STATUS_META.Blocked.badge).toContain("rose");
    expect(STATUS_META.Done.badge).toContain("emerald");
  });
});

describe("SeverityBadge", () => {
  it.each(SEVERITIES)("shows icon and text for %s", (severity) => {
    const { container } = render(<SeverityBadge severity={severity} />);
    expect(screen.getByText(severity)).toHaveAttribute("data-severity", severity);
    expect(container.querySelector("svg")).not.toBeNull();
  });

  it("maps severities to the agreed hues", () => {
    expect(SEVERITY_META.Critical.badge).toContain("red");
    expect(SEVERITY_META.High.badge).toContain("orange");
    expect(SEVERITY_META.Medium.badge).toContain("amber");
    expect(SEVERITY_META.Low.badge).toContain("sky");
  });

  it("uses a different icon per severity", () => {
    const icons = SEVERITIES.map((s) => SEVERITY_META[s].icon);
    expect(new Set(icons).size).toBe(SEVERITIES.length);
  });
});

describe("TagBadge", () => {
  it("renders the tag with a deterministic color", () => {
    render(<TagBadge tag="LEARN" />);
    expect(screen.getByText("LEARN")).toHaveClass(...tagColor("LEARN").split(" "));
    expect(tagColor("LEARN")).toBe(tagColor("LEARN"));
  });
});
