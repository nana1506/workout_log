import { describe, it, expect } from "vitest";
import {
  renderReportEmailHtml,
  parseMarkdownToHtml,
  escapeHtml,
  getVolumeEquivalent,
  getAchievementMedal,
  renderAnatomicalBodySvg,
} from "./emailTemplate.js";

describe("emailTemplate", () => {
  describe("getVolumeEquivalent", () => {
    it("returns correct equivalency for various volume thresholds", () => {
      const elephant = getVolumeEquivalent(5000);
      expect(elephant.name).toBe("African Bush Elephant");
      expect(elephant.emoji).toBe("🐘");
      expect(elephant.description).toContain("African Bush Elephant");

      const bus = getVolumeEquivalent(18000);
      expect(bus.name).toBe("City Transit Bus");
      expect(bus.emoji).toBe("🚌");

      const piano = getVolumeEquivalent(500);
      expect(piano.name).toBe("Grand Concert Piano");
    });
  });

  describe("getAchievementMedal", () => {
    it("awards Gold medal for 3+ PRs", () => {
      const gold = getAchievementMedal(3);
      expect(gold.tier).toBe("gold");
      expect(gold.medal).toBe("🥇");
    });

    it("awards Silver medal for 1-2 PRs", () => {
      const silver = getAchievementMedal(2);
      expect(silver.tier).toBe("silver");
      expect(silver.medal).toBe("🥈");
    });

    it("awards Bronze medal for 0 PRs", () => {
      const bronze = getAchievementMedal(0);
      expect(bronze.tier).toBe("bronze");
      expect(bronze.medal).toBe("🥉");
    });
  });

  describe("renderAnatomicalBodySvg", () => {
    it("renders dual anterior and posterior SVGs with muscle highlight colors", () => {
      const svgHtml = renderAnatomicalBodySvg({
        topMuscles: [{ muscle: "chest" }, { muscle: "quadriceps" }],
        neglectedMuscles: ["hamstrings"],
      });
      expect(svgHtml).toContain("ANTERIOR (FRONT)");
      expect(svgHtml).toContain("POSTERIOR (BACK)");
      expect(svgHtml).toContain("<svg");
      expect(svgHtml).toContain("#10B981"); // green for chest/quads
      expect(svgHtml).toContain("#EF4444"); // red/rose for neglected hamstrings
    });
  });

  describe("parseMarkdownToHtml & escapeHtml", () => {
    it("escapes malicious HTML tags", () => {
      const sanitized = escapeHtml("<script>alert('xss')</script>");
      expect(sanitized).toBe("&lt;script&gt;alert(&#039;xss&#039;)&lt;/script&gt;");
    });

    it("parses bold and custom highlights", () => {
      const html = parseMarkdownToHtml("Hit a **new PR** and ==massive load== today!");
      expect(html).toContain('<strong style="font-weight: 700; color: inherit;">new PR</strong>');
      expect(html).toContain("<mark");
      expect(html).toContain("massive load");
    });

    it("parses bulleted pointer lists with target highlighting", () => {
      const markdown = "* 🎯 **Bench Press**: add 2.5kg\n* ⚡ **Deload** leg volume";
      const html = parseMarkdownToHtml(markdown, true);
      expect(html).toContain("<ul");
      expect(html).toContain("<li");
      expect(html).toContain("Bench Press");
      expect(html).toContain("2.5kg");
    });
  });

  describe("renderReportEmailHtml", () => {
    it("renders dark & light mode support, medals, weight equivalency, and body balance", () => {
      const mockContent = {
        subject: "Weekly Training Report: Strong 12% Volume Increase",
        highlights: "You crushed **3 sessions** and hit 3 new PRs.",
        trainingSummary: "Completed 5,200 kg total volume across 12 sets.",
        bodyComposition: "Weight dropped by 0.5kg with lean mass preserved.",
        goalProgress: "Body weight goal is 60% complete.",
        muscleBalance: "Push/pull ratio is balanced at 1.1.",
        notableEvents: "New 1RM PR on Bench Press and Squat.",
        lookingAhead: "* 🎯 Add **+2.5kg** to Squats next week.\n* ⚡ Maintain **RPE 8** on bench.",
      };

      const mockPayload = {
        summary: {
          sessionCount: 3,
          totalVolumeKg: 5200,
          volumeDeltaPct: 12.5,
        },
        prs: [
          { exercise: "Bench Press", oneRm: 120, date: "2026-08-12" },
          { exercise: "Back Squat", oneRm: 160, date: "2026-08-14" },
          { exercise: "Deadlift", oneRm: 200, date: "2026-08-15" },
        ],
        muscleBalance: {
          pushPullRatio: 1.1,
          quadHamstringRatio: 1.2,
          topMuscles: [{ muscle: "chest" }],
          neglectedMuscles: [],
        },
        bodyComp: {
          scansCount: 1,
          latestWeightKg: 78.5,
          weightDeltaKg: -0.5,
        },
      };

      const options = {
        payload: mockPayload,
        dashboardUrl: "https://workout-log.vercel.app",
      };

      const html = renderReportEmailHtml(mockContent, "weekly", "2026-08-10", "2026-08-16", options);

      // Dark & Light mode tags & media queries
      expect(html).toContain('content="light dark"');
      expect(html).toContain("@media (prefers-color-scheme: dark)");

      // Scorecard stats & Medals (3 PRs = Gold medal)
      expect(html).toContain("Sessions");
      expect(html).toContain("Total Volume");
      expect(html).toContain("5,200");
      expect(html).toContain("🥇"); // Gold medal
      expect(html).toContain("Gold Tier Performance");

      // Hevy-style weight equivalency
      expect(html).toContain("Equivalency Milestone");
      expect(html).toContain("African Bush Elephant");
      expect(html).toContain("▲ +12.5% vs prior");

      // Anatomical body visualizer
      expect(html).toContain("ANTERIOR (FRONT)");
      expect(html).toContain("POSTERIOR (BACK)");
      expect(html).toContain("Push / Pull");

      // Body composition rendered when data exists
      expect(html).toContain("Body Composition");

      // Focus for next cycle action pointers with highlight
      expect(html).toContain("Focus For Next Cycle (Action Pointers)");
      expect(html).toContain("+2.5kg");

      // Primary CTA button
      expect(html).toContain("View Detailed Analytics &rarr;");
      expect(html).toContain('href="https://workout-log.vercel.app"');
    });

    it("omits Body Composition when no data is found or content is null", () => {
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

      const mockPayload = {
        summary: {
          sessionCount: 2,
          totalVolumeKg: 2000,
          volumeDeltaPct: -5.0,
        },
        prs: [],
        muscleBalance: null,
        bodyComp: null, // No scans
      };

      const html = renderReportEmailHtml(mockContent, "weekly", "2026-08-10", "2026-08-16", {
        payload: mockPayload,
      });

      expect(html).toContain("Weekly Training Summary");
      expect(html).toContain("Training Load &amp; Volume");
      expect(html).toContain("▼ -5% vs prior"); // Negative growth red pill
      expect(html).toContain("🥉"); // Bronze for 0 PRs
      expect(html).not.toContain("Body Composition");
      expect(html).not.toContain("Goal Progression");
      expect(html).not.toContain("Focus For Next Cycle");
    });
  });
});
