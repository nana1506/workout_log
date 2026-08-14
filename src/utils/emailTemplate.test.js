import { describe, it, expect } from "vitest";
import { renderReportEmailHtml } from "./emailTemplate";

describe("emailTemplate", () => {
  it("renders a full email with all sections and valid HTML", () => {
    const mockContent = {
      subject: "Weekly Training Report: Strong 12% Volume Increase",
      highlights: "You crushed 3 sessions and hit a new PR on Bench Press.",
      trainingSummary: "Completed 2,265 kg total volume across 4 sets.",
      bodyComposition: "Weight dropped by 0.5kg with lean mass preserved.",
      goalProgress: "Body weight goal is 60% complete.",
      muscleBalance: "Push/pull ratio is balanced at 1.1.",
      notableEvents: "New 1RM PR: Bench Press 122.5 kg.",
      lookingAhead: "Aim to add 2.5kg to your Squat next week.",
    };

    const html = renderReportEmailHtml(mockContent, "weekly", "2026-08-10", "2026-08-16");

    expect(html).toContain("<!DOCTYPE html>");
    expect(html).toContain("Weekly Training Report: Strong 12% Volume Increase");
    expect(html).toContain("You crushed 3 sessions and hit a new PR on Bench Press.");
    expect(html).toContain("Training Load &amp; Volume");
    expect(html).toContain("Body Composition");
    expect(html).toContain("Looking Ahead");
    expect(html).toContain("WEEKLY PROGRESS REPORT");
  });

  it("omits empty sections gracefully", () => {
    const mockContent = {
      subject: "Weekly Training Summary",
      highlights: "Solid training week.",
      trainingSummary: "Volume was steady.",
      bodyComposition: null, // empty
      goalProgress: "",      // empty
      muscleBalance: null,
      notableEvents: "",
      lookingAhead: "Keep momentum going.",
    };

    const html = renderReportEmailHtml(mockContent, "weekly", "2026-08-10", "2026-08-16");

    expect(html).toContain("Weekly Training Summary");
    expect(html).toContain("Training Load &amp; Volume");
    expect(html).not.toContain("Body Composition");
    expect(html).not.toContain("Goal Progression");
  });
});
