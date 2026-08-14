import { describe, it, expect } from "vitest";
import { renderReportEmailHtml, parseMarkdownToHtml, escapeHtml } from "./emailTemplate.js";

describe("emailTemplate", () => {
  describe("parseMarkdownToHtml & escapeHtml", () => {
    it("escapes malicious HTML tags", () => {
      const sanitized = escapeHtml("<script>alert('xss')</script>");
      expect(sanitized).toBe("&lt;script&gt;alert(&#039;xss&#039;)&lt;/script&gt;");
    });

    it("parses bold text", () => {
      const html = parseMarkdownToHtml("Hit a **new PR** today!");
      expect(html).toContain('<strong style="color: #111827;">new PR</strong>');
    });

    it("parses bulleted lists", () => {
      const markdown = "* Bench Press: 100kg\n* Squat: 140kg\n* Deadlift: 180kg";
      const html = parseMarkdownToHtml(markdown);
      expect(html).toContain("<ul");
      expect(html).toContain("<li");
      expect(html).toContain("Bench Press: 100kg");
    });
  });

  describe("renderReportEmailHtml", () => {
    it("renders a full email with MSO tags, scorecard stats, section cards, and CTA", () => {
      const mockContent = {
        subject: "Weekly Training Report: Strong 12% Volume Increase",
        highlights: "You crushed **3 sessions** and hit a new PR on Bench Press.",
        trainingSummary: "Completed 2,265 kg total volume across 4 sets.",
        bodyComposition: "Weight dropped by 0.5kg with lean mass preserved.",
        goalProgress: "Body weight goal is 60% complete.",
        muscleBalance: "Push/pull ratio is balanced at 1.1.",
        notableEvents: "New 1RM PR: Bench Press 122.5 kg.",
        lookingAhead: "Aim to add **2.5kg** to your Squat next week.",
      };

      const options = {
        stats: {
          sessions: 3,
          totalVolume: 2265,
          prsCount: 1,
        },
        dashboardUrl: "https://workout-log.vercel.app",
      };

      const html = renderReportEmailHtml(mockContent, "weekly", "2026-08-10", "2026-08-16", options);

      // Email client tags
      expect(html).toContain("<!DOCTYPE html>");
      expect(html).toContain('content="light"');
      expect(html).toContain("<!--[if mso]>");
      expect(html).toContain("Weekly Training Report: Strong 12% Volume Increase");

      // Scorecard stats
      expect(html).toContain("Sessions");
      expect(html).toContain("Total Volume");
      expect(html).toContain("New PRs");
      expect(html).toContain("2,265");

      // Highlights with parsed markdown
      expect(html).toContain('<strong style="color: #111827;">3 sessions</strong>');

      // Sections and coaching callout
      expect(html).toContain("Training Load &amp; Volume");
      expect(html).toContain("Body Composition");
      expect(html).toContain("Focus For Next Cycle");
      expect(html).toContain('<strong style="color: #111827;">2.5kg</strong>');

      // Primary CTA button
      expect(html).toContain("View Detailed Analytics &rarr;");
      expect(html).toContain('href="https://workout-log.vercel.app"');
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
        lookingAhead: "",      // empty
      };

      const html = renderReportEmailHtml(mockContent, "weekly", "2026-08-10", "2026-08-16");

      expect(html).toContain("Weekly Training Summary");
      expect(html).toContain("Training Load &amp; Volume");
      expect(html).not.toContain("Body Composition");
      expect(html).not.toContain("Goal Progression");
      expect(html).not.toContain("Focus For Next Cycle");
    });
  });
});
