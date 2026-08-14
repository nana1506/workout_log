/**
 * Utilities for rendering email HTML templates.
 * Generates a dark & light mode compatible, single-column email with 100% inline styles,
 * MSO XML conditional tags, Outlook fallback colors, rich typography, and interactive visual widgets.
 */

import { fmtDate } from "./calculations.js";

/**
 * Escapes special HTML characters to prevent XSS / markup corruption.
 * @param {string} str
 * @returns {string}
 */
export function escapeHtml(str) {
  if (!str) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

/**
 * Computes a fun, Hevy-app-style real world weight equivalency for total volume lifted.
 *
 * @param {number} volumeKg
 * @returns {{ name: string, emoji: string, count: number, description: string }}
 */
export function getVolumeEquivalent(volumeKg) {
  const vol = Math.max(0, Number(volumeKg) || 0);

  const TIERS = [
    { threshold: 100000, name: "Blue Whale", emoji: "🐋", weight: 100000 },
    { threshold: 45000, name: "Boeing 737 Jet", emoji: "✈️", weight: 45000 },
    { threshold: 18000, name: "City Transit Bus", emoji: "🚌", weight: 18000 },
    { threshold: 10000, name: "Industrial Bulldozer", emoji: "🚜", weight: 10000 },
    { threshold: 6000, name: "Monster Truck", emoji: "🛻", weight: 6000 },
    { threshold: 4000, name: "African Bush Elephant", emoji: "🐘", weight: 5000 },
    { threshold: 2000, name: "Full-Size SUV", emoji: "🚙", weight: 2200 },
    { threshold: 1000, name: "Compact Sedan", emoji: "🚗", weight: 1200 },
    { threshold: 400, name: "Grand Concert Piano", emoji: "🎹", weight: 450 },
    { threshold: 150, name: "Adult Gorilla", emoji: "🦍", weight: 180 },
    { threshold: 0, name: "Heavy Barbell Stack", emoji: "🏋️‍♂️", weight: 100 },
  ];

  const matched = TIERS.find((t) => vol >= t.threshold) || TIERS[TIERS.length - 1];
  const count = matched.weight > 0 ? Math.round((vol / matched.weight) * 10) / 10 : 1;
  const countFormatted = count === 1 ? "1" : count.toString();
  const description = `${countFormatted}x ${matched.name} ${matched.emoji} (${(matched.weight * count).toLocaleString()} kg)`;

  return {
    name: matched.name,
    emoji: matched.emoji,
    count,
    description,
  };
}

/**
 * Determines reward medal tier based on PR count and achievements.
 *
 * @param {number} prCount
 * @returns {{ tier: string, medal: string, title: string, color: string, bg: string, border: string }}
 */
export function getAchievementMedal(prCount) {
  const count = Number(prCount) || 0;
  if (count >= 3) {
    return {
      tier: "gold",
      medal: "🥇",
      title: "Gold Tier Performance",
      color: "#B45309",
      bg: "#FEF3C7",
      border: "#FCD34D",
      darkBg: "#451A03",
      darkText: "#FDE68A",
    };
  }
  if (count >= 1) {
    return {
      tier: "silver",
      medal: "🥈",
      title: "Silver Tier Achievement",
      color: "#475569",
      bg: "#F1F5F9",
      border: "#CBD5E1",
      darkBg: "#1E293B",
      darkText: "#E2E8F0",
    };
  }
  return {
    tier: "bronze",
    medal: "🥉",
    title: "Bronze Tier Consistency",
    color: "#92400E",
    bg: "#FFFBEB",
    border: "#FDE68A",
    darkBg: "#292524",
    darkText: "#FDE68A",
  };
}

/**
 * Lightweight markdown parser for safe inline email formatting with support for:
 * - **bold**
 * - ==highlighted== or `code`
 * - Bullet lists (*, -, or numerical/pointer items)
 * - Auto-highlighting of metrics and key action terms
 *
 * @param {string} text
 * @param {boolean} [enableHighlighting=false]
 * @returns {string}
 */
export function parseMarkdownToHtml(text, enableHighlighting = false) {
  if (!text || typeof text !== "string") return "";

  // 1. Sanitize HTML first
  const sanitized = escapeHtml(text.trim());

  // 2. Split by double newlines into block segments
  const blocks = sanitized.split(/\n\s*\n/);

  const formattedBlocks = blocks.map((block) => {
    const lines = block.split(/\n/);
    const isList =
      lines.length > 0 &&
      lines.every((line) => /^\s*([*\-•]|🎯|⚡|📌|💡|\d+\.)\s+/.test(line));

    if (isList) {
      const listItems = lines
        .map((line) => {
          let itemText = line.replace(/^\s*([*\-•]|🎯|⚡|📌|💡|\d+\.)\s+/, "");
          itemText = formatInlineStyles(itemText, enableHighlighting);
          return `<li style="margin-bottom: 8px; line-height: 1.55; color: inherit;">${itemText}</li>`;
        })
        .join("");
      return `<ul style="margin: 6px 0 0 0; padding-left: 20px; font-size: 14px; line-height: 1.55; list-style-type: disc;">${listItems}</ul>`;
    } else {
      let formatted = formatInlineStyles(block, enableHighlighting);
      formatted = formatted.replace(/\n/g, "<br />");
      return `<p style="margin: 0; font-size: 14px; line-height: 1.6;">${formatted}</p>`;
    }
  });

  return formattedBlocks.join("\n");
}

/**
 * Helper to apply inline styles (bold, ==highlight==, keyword emphasis)
 */
function formatInlineStyles(str, enableHighlighting = false) {
  if (!str) return "";

  // ==highlight==
  let res = str.replace(
    /==(.*?)==/g,
    '<mark style="background-color: rgba(244, 183, 64, 0.25); color: #B45309; padding: 2px 6px; border-radius: 4px; font-weight: 700; border: 1px solid rgba(244, 183, 64, 0.4);">$1</mark>'
  );

  // **bold**
  res = res.replace(
    /\*\*(.*?)\*\*/g,
    '<strong style="font-weight: 700; color: inherit;">$1</strong>'
  );

  // If highlighting is enabled for Next Cycle pointers, auto-highlight targets/weights/RPE
  if (enableHighlighting) {
    res = res.replace(
      /(\+\d+(?:\.\d+)?(?:kg|%|lbs)|\b\d+(?:\.\d+)?\s*(?:kg|lbs|sets|reps|RPE\s*\d+)\b)/gi,
      '<span style="background-color: rgba(79, 209, 197, 0.18); color: #0D9488; padding: 1px 5px; border-radius: 4px; font-weight: 700; font-family: monospace; font-size: 13px; border: 1px solid rgba(79, 209, 197, 0.3);">$1</span>'
    );
  }

  return res;
}

/**
 * Renders an email-safe, dark-mode compatible SVG dual-anatomical body silhouette
 * showing muscle volume distribution and balance.
 *
 * @param {Object} muscleBalance
 * @returns {string} Email-safe SVG markup
 */
export function renderAnatomicalBodySvg(muscleBalance) {
  const topMuscles = (muscleBalance?.topMuscles || []).map((m) =>
    (m.muscle || "").toLowerCase()
  );
  const neglectedMuscles = (muscleBalance?.neglectedMuscles || []).map((m) =>
    (m || "").toLowerCase()
  );

  const getMuscleColor = (muscleKey) => {
    if (topMuscles.some((m) => m.includes(muscleKey))) {
      return "#10B981"; // Emerald green: high stimulus
    }
    if (neglectedMuscles.some((m) => m.includes(muscleKey))) {
      return "#EF4444"; // Rose / Coral: neglected
    }
    return "#64748B"; // Slate: balanced / moderate
  };

  const chestColor = getMuscleColor("chest");
  const shoulderColor = getMuscleColor("shoulder");
  const armColor = getMuscleColor("biceps") || getMuscleColor("triceps") || getMuscleColor("arm");
  const quadColor = getMuscleColor("quad");
  const backColor = getMuscleColor("back") || getMuscleColor("lat");
  const hamstringColor = getMuscleColor("hamstring") || getMuscleColor("glute");

  return `
  <table border="0" cellspacing="0" cellpadding="0" align="center" style="margin: 12px auto;">
    <tr>
      <td align="center" style="padding: 0 12px;">
        <div style="font-size: 10px; font-weight: 700; text-transform: uppercase; color: #94A3B8; margin-bottom: 6px; letter-spacing: 0.05em;">ANTERIOR (FRONT)</div>
        <svg width="110" height="150" viewBox="0 0 100 140" fill="none" xmlns="http://www.w3.org/2000/svg" style="display: block; max-width: 110px;">
          <!-- Head -->
          <circle cx="50" cy="14" r="10" fill="#94A3B8" />
          <!-- Neck -->
          <rect x="47" y="24" width="6" height="6" fill="#94A3B8" />
          <!-- Shoulders -->
          <path d="M30 30 Q50 27 70 30 L66 38 Q50 35 34 38 Z" fill="${shoulderColor}" />
          <!-- Chest -->
          <path d="M34 38 Q50 35 66 38 L64 54 Q50 56 36 54 Z" fill="${chestColor}" />
          <!-- Arms (Front) -->
          <path d="M26 33 L32 37 L28 65 L22 62 Z" fill="${armColor}" />
          <path d="M74 33 L68 37 L72 65 L78 62 Z" fill="${armColor}" />
          <!-- Core / Abs -->
          <rect x="38" y="56" width="24" height="20" rx="3" fill="#64748B" />
          <!-- Hips / Pelvis -->
          <path d="M36 78 L64 78 L58 88 L42 88 Z" fill="#94A3B8" />
          <!-- Quadriceps / Upper Legs -->
          <path d="M37 90 L48 90 L46 114 L37 114 Z" fill="${quadColor}" />
          <path d="M52 90 L63 90 L63 114 L54 114 Z" fill="${quadColor}" />
          <!-- Calves / Lower Legs -->
          <path d="M38 116 L45 116 L44 136 L39 136 Z" fill="#94A3B8" />
          <path d="M55 116 L62 116 L61 136 L56 136 Z" fill="#94A3B8" />
        </svg>
      </td>
      <td align="center" style="padding: 0 12px; border-left: 1px dashed rgba(148, 163, 184, 0.3);">
        <div style="font-size: 10px; font-weight: 700; text-transform: uppercase; color: #94A3B8; margin-bottom: 6px; letter-spacing: 0.05em;">POSTERIOR (BACK)</div>
        <svg width="110" height="150" viewBox="0 0 100 140" fill="none" xmlns="http://www.w3.org/2000/svg" style="display: block; max-width: 110px;">
          <!-- Head (Back) -->
          <circle cx="50" cy="14" r="10" fill="#94A3B8" />
          <!-- Traps & Upper Back -->
          <path d="M32 30 Q50 25 68 30 L66 46 Q50 49 34 46 Z" fill="${backColor}" />
          <!-- Lats / Mid Back -->
          <path d="M34 46 Q50 49 66 46 L62 66 Q50 68 38 66 Z" fill="${backColor}" />
          <!-- Rear Delts / Arms (Back) -->
          <path d="M26 33 L32 37 L28 65 L22 62 Z" fill="${armColor}" />
          <path d="M74 33 L68 37 L72 65 L78 62 Z" fill="${armColor}" />
          <!-- Lower Back & Glutes -->
          <path d="M36 68 L64 68 L62 86 L38 86 Z" fill="${hamstringColor}" />
          <!-- Hamstrings -->
          <path d="M37 90 L48 90 L46 114 L37 114 Z" fill="${hamstringColor}" />
          <path d="M52 90 L63 90 L63 114 L54 114 Z" fill="${hamstringColor}" />
          <!-- Calves (Back) -->
          <path d="M38 116 L45 116 L44 136 L39 136 Z" fill="#94A3B8" />
          <path d="M55 116 L62 116 L61 136 L56 136 Z" fill="#94A3B8" />
        </svg>
      </td>
    </tr>
  </table>
  `;
}

/**
 * Renders the HTML body for a Progress Report email.
 *
 * @param {Object} content - Structured content generated by Gemini
 * @param {string} [content.subject] - Email subject
 * @param {string} [content.highlights] - Top takeaways
 * @param {string} [content.trainingSummary] - Training load & volume analysis
 * @param {string} [content.bodyComposition] - Body comp notes (or null)
 * @param {string} [content.goalProgress] - Goal progression status
 * @param {string} [content.muscleBalance] - Muscle balance & symmetry notes
 * @param {string} [content.notableEvents] - PRs, plateaus, records
 * @param {string} [content.lookingAhead] - Forward-looking coaching advice
 * @param {Object} [content.stats] - { sessions, totalVolume, prsCount }
 * @param {string} [periodType='weekly'] - 'weekly' | 'monthly'
 * @param {string} [periodStart=''] - YYYY-MM-DD
 * @param {string} [periodEnd=''] - YYYY-MM-DD
 * @param {Object} [options={}] - Extra rendering options (stats, dashboardUrl, payload)
 * @returns {string} Fully styled HTML string
 */
export function renderReportEmailHtml(
  content,
  periodType = "weekly",
  periodStart = "",
  periodEnd = "",
  options = {}
) {
  const periodLabel = periodType === "monthly" ? "MONTHLY PROGRESS REPORT" : "WEEKLY PROGRESS REPORT";
  const dateRangeStr = periodStart && periodEnd
    ? `${fmtDate(periodStart)} – ${fmtDate(periodEnd)}`
    : "";

  const subjectText = content?.subject || `${periodLabel}: ${dateRangeStr}`;
  const highlightsText = content?.highlights || "";
  const preheaderText = highlightsText
    ? highlightsText.replace(/\*\*/g, "").slice(0, 140)
    : `${periodLabel} (${dateRangeStr}) · Performance breakdown & analytics`;

  const payload = options?.payload || null;
  const stats = options?.stats || content?.stats || (payload?.summary ? {
    sessions: payload.summary.sessionCount || 0,
    totalVolume: payload.summary.totalVolumeKg || 0,
    prsCount: payload.prs?.length || 0,
  } : null);

  const dashboardUrl = options?.dashboardUrl || content?.dashboardUrl || "https://workout-log.vercel.app";

  // 1. Volume Equivalency & Growth Calculations
  const totalVolume = Number(stats?.totalVolume) || Number(payload?.summary?.totalVolumeKg) || 0;
  const volumeEquiv = getVolumeEquivalent(totalVolume);
  const volumeDeltaPct = payload?.summary?.volumeDeltaPct ?? options?.volumeDeltaPct ?? null;
  const prsList = payload?.prs || [];
  const prsCount = stats?.prsCount ?? prsList.length ?? 0;
  const achievementMedal = getAchievementMedal(prsCount);

  // Growth badge formatting
  let growthBadgeHtml = "";
  if (volumeDeltaPct != null) {
    if (volumeDeltaPct > 0) {
      growthBadgeHtml = `<span style="display: inline-block; font-size: 11px; font-weight: 700; color: #059669; background-color: #ECFDF5; border: 1px solid #A7F3D0; padding: 2px 8px; border-radius: 9999px; font-family: monospace;">▲ +${volumeDeltaPct}% vs prior</span>`;
    } else if (volumeDeltaPct < 0) {
      growthBadgeHtml = `<span style="display: inline-block; font-size: 11px; font-weight: 700; color: #DC2626; background-color: #FEF2F2; border: 1px solid #FECACA; padding: 2px 8px; border-radius: 9999px; font-family: monospace;">▼ ${volumeDeltaPct}% vs prior</span>`;
    } else {
      growthBadgeHtml = `<span style="display: inline-block; font-size: 11px; font-weight: 700; color: #4B5563; background-color: #F3F4F6; border: 1px solid #E5E7EB; padding: 2px 8px; border-radius: 9999px; font-family: monospace;">▶ 0.0% vs prior</span>`;
    }
  }

  // 2. Training Load & Volume Section Widget
  let trainingLoadWidget = "";
  if (totalVolume > 0) {
    trainingLoadWidget = `
    <div style="margin-top: 12px; padding: 12px 14px; background-color: rgba(244, 183, 64, 0.08); border: 1px solid rgba(244, 183, 64, 0.25); border-radius: 8px;">
      <div style="font-size: 11px; font-weight: 700; text-transform: uppercase; color: #D97706; letter-spacing: 0.05em; margin-bottom: 4px;">
        🏋️ Equivalency Milestone
      </div>
      <div style="font-size: 13px; font-weight: 600; color: #1F2937;" class="card-text">
        You lifted <strong style="color: #D97706;">${totalVolume.toLocaleString()} kg</strong> this cycle — equivalent to lifting <strong>${escapeHtml(volumeEquiv.description)}</strong>!
      </div>
      ${growthBadgeHtml ? `<div style="margin-top: 8px;">${growthBadgeHtml}</div>` : ""}
    </div>`;
  }

  // 3. Notable Events & PRs Widget with Medal System
  let notableEventsWidget = "";
  if (prsCount > 0 || prsList.length > 0) {
    const prBadges = prsList.length > 0
      ? prsList.map((pr) => `
        <div style="display: inline-block; margin: 3px; padding: 4px 10px; background-color: #FFFFFF; border: 1px solid #E5E7EB; border-radius: 6px; font-size: 12px; color: #111827; box-shadow: 0 1px 2px rgba(0,0,0,0.04);">
          🎖️ <strong>${escapeHtml(pr.exercise)}</strong>: <span style="color: #059669; font-weight: 700;">${pr.oneRm} kg 1RM</span>
          ${pr.date ? `<span style="font-size: 10px; color: #6B7280; margin-left: 4px;">(${fmtDate(pr.date)})</span>` : ""}
        </div>
      `).join("")
      : "";

    notableEventsWidget = `
    <div style="margin-top: 12px; padding: 12px 14px; background-color: ${achievementMedal.bg}; border: 1px solid ${achievementMedal.border}; border-radius: 8px;">
      <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 6px;">
        <span style="font-size: 20px;">${achievementMedal.medal}</span>
        <span style="font-size: 12px; font-weight: 700; text-transform: uppercase; color: ${achievementMedal.color}; letter-spacing: 0.05em;">
          ${achievementMedal.title} (${prsCount} PR${prsCount === 1 ? "" : "s"})
        </span>
      </div>
      ${prBadges ? `<div style="margin-top: 8px;">${prBadges}</div>` : ""}
    </div>`;
  }

  // 4. Muscle Balance & Symmetry Widget
  let muscleBalanceWidget = "";
  if (payload?.muscleBalance || content?.muscleBalance) {
    const mb = payload?.muscleBalance || {};
    const pushPull = mb.pushPullRatio != null ? `${mb.pushPullRatio}x` : null;
    const quadHam = mb.quadHamstringRatio != null ? `${mb.quadHamstringRatio}x` : null;

    muscleBalanceWidget = `
    <div style="margin-top: 12px; padding: 12px 14px; background-color: rgba(79, 209, 197, 0.08); border: 1px solid rgba(79, 209, 197, 0.25); border-radius: 8px;">
      ${renderAnatomicalBodySvg(mb)}
      <div style="display: flex; justify-content: space-around; text-align: center; margin-top: 8px; font-size: 11px; color: #4B5563;">
        ${pushPull ? `<div><span style="display: block; font-weight: 700; color: #0D9488;">${pushPull}</span>Push / Pull Ratio</div>` : ""}
        ${quadHam ? `<div><span style="display: block; font-weight: 700; color: #0D9488;">${quadHam}</span>Quad / Hamstring</div>` : ""}
      </div>
      <div style="text-align: center; margin-top: 6px; font-size: 10px; color: #6B7280;">
        🟢 High Stimulus &nbsp;·&nbsp; ⚪ Balanced &nbsp;·&nbsp; 🔴 Low / Neglected
      </div>
    </div>`;
  }

  // 5. Body Composition Check: completely skip if not found
  const hasBodyCompData =
    (payload?.bodyComp != null && payload.bodyComp.scansCount > 0) ||
    (content?.bodyComposition &&
      typeof content.bodyComposition === "string" &&
      content.bodyComposition.trim().length > 0 &&
      !/no\s+(?:scan|body\s*comp|metrics)|null|not\s+(?:found|available)/i.test(content.bodyComposition));

  // Build section items
  const sections = [
    {
      id: "training_summary",
      title: "Training Load &amp; Volume",
      icon: "🏋️‍♂️",
      text: content?.trainingSummary,
      extraWidget: trainingLoadWidget,
      show: Boolean(content?.trainingSummary && content.trainingSummary.trim().length > 0),
    },
    {
      id: "notable_events",
      title: "Notable Events &amp; PRs",
      icon: "🏆",
      text: content?.notableEvents,
      extraWidget: notableEventsWidget,
      show: Boolean(content?.notableEvents && content.notableEvents.trim().length > 0),
    },
    {
      id: "muscle_balance",
      title: "Muscle Balance &amp; Symmetry",
      icon: "⚖️",
      text: content?.muscleBalance,
      extraWidget: muscleBalanceWidget,
      show: Boolean(content?.muscleBalance && content.muscleBalance.trim().length > 0),
    },
    {
      id: "goal_progress",
      title: "Goal Progression",
      icon: "🎯",
      text: content?.goalProgress,
      extraWidget: "",
      show: Boolean(content?.goalProgress && content.goalProgress.trim().length > 0),
    },
    {
      id: "body_composition",
      title: "Body Composition",
      icon: "📊",
      text: hasBodyCompData ? content?.bodyComposition : null,
      extraWidget: "",
      show: Boolean(hasBodyCompData && content?.bodyComposition),
    },
  ];

  const renderedSections = sections
    .filter((s) => s.show && s.text && typeof s.text === "string" && s.text.trim().length > 0)
    .map(
      (s) => `
      <table width="100%" border="0" cellspacing="0" cellpadding="0" class="report-card" style="margin-bottom: 16px; background-color: #F9FAFB; border: 1px solid #E5E7EB; border-radius: 10px; overflow: hidden;">
        <tr>
          <td style="padding: 16px 20px;">
            <div style="font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; color: #4B5563; margin-bottom: 8px;">
              ${s.icon} ${s.title}
            </div>
            <div class="card-text" style="color: #374151;">
              ${parseMarkdownToHtml(s.text)}
            </div>
            ${s.extraWidget || ""}
          </td>
        </tr>
      </table>`
    )
    .join("\n");

  return `<!DOCTYPE html>
<html lang="en" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="color-scheme" content="light dark">
  <meta name="supported-color-schemes" content="light dark">
  <!--[if mso]>
  <xml>
    <o:OfficeDocumentSettings>
      <o:AllowPNG/>
      <o:PixelsPerInch>96</o:PixelsPerInch>
    </o:OfficeDocumentSettings>
  </xml>
  <![endif]-->
  <title>${escapeHtml(subjectText)}</title>
  <style>
    :root {
      color-scheme: light dark;
      supported-color-schemes: light dark;
    }
    @media (prefers-color-scheme: dark) {
      body, .email-body {
        background-color: #0C0E12 !important;
        color: #E7E9EC !important;
      }
      .email-container {
        background-color: #15181D !important;
        border-color: #232830 !important;
      }
      .report-card {
        background-color: #1A1E26 !important;
        border-color: #282E38 !important;
      }
      .card-text {
        color: #D1D5DB !important;
      }
      .highlight-box {
        background-color: #2D2415 !important;
        border-color: #78350F !important;
        color: #FEF08A !important;
      }
      .scorecard-box {
        background-color: #1A1E26 !important;
        border-color: #282E38 !important;
      }
      .scorecard-divider {
        border-color: #282E38 !important;
      }
      .stat-number {
        color: #F3F4F6 !important;
      }
      .focus-box {
        background-color: #172554 !important;
        border-color: #1E40AF !important;
      }
      .footer-box {
        background-color: #11141A !important;
        border-color: #232830 !important;
      }
    }
  </style>
</head>
<body class="email-body" style="margin: 0; padding: 0; background-color: #F3F4F6; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #111827; -webkit-font-smoothing: antialiased;">
  
  <!-- Hidden Preheader Text for Inbox Previews -->
  <div style="display: none; font-size: 1px; line-height: 1px; max-height: 0px; max-width: 0px; opacity: 0; overflow: hidden; mso-hide: all; font-family: sans-serif;">
    ${escapeHtml(preheaderText)}
    &zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;
  </div>

  <table width="100%" border="0" cellspacing="0" cellpadding="0" bgcolor="#F3F4F6" class="email-body" style="background-color: #F3F4F6; padding: 24px 12px;">
    <tr>
      <td align="center">
        <!-- Main Email Container (max 600px) -->
        <table width="100%" border="0" cellspacing="0" cellpadding="0" bgcolor="#FFFFFF" class="email-container" style="max-width: 600px; background-color: #FFFFFF; border-radius: 12px; overflow: hidden; border: 1px solid #E5E7EB; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);">
          
          <!-- Header Banner (with Outlook bgcolor fallback) -->
          <tr>
            <td bgcolor="#15181D" style="padding: 28px 32px 22px 32px; background-color: #15181D; background: linear-gradient(135deg, #15181D 0%, #1F242D 100%); border-bottom: 3px solid #F4B740;">
              <table width="100%" border="0" cellspacing="0" cellpadding="0">
                <tr>
                  <td>
                    <span style="display: inline-block; font-size: 10px; font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase; color: #F4B740; background-color: rgba(244, 183, 64, 0.15); padding: 4px 10px; border-radius: 9999px; margin-bottom: 8px;">
                      ${periodLabel}
                    </span>
                    ${dateRangeStr ? `<span style="font-size: 12px; color: #9CA3AF; margin-left: 8px;">${dateRangeStr}</span>` : ""}
                    <h1 style="margin: 8px 0 0 0; font-size: 22px; font-weight: 700; color: #FFFFFF; line-height: 1.3;">
                      ${escapeHtml(subjectText)}
                    </h1>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Main Content Body -->
          <tr>
            <td style="padding: 28px 28px 24px 28px;">

              <!-- Scorecard Stats (Sessions, Volume, PRs with Medal) -->
              ${stats ? `
              <table width="100%" border="0" cellspacing="0" cellpadding="0" class="scorecard-box" style="margin-bottom: 24px; background-color: #F9FAFB; border: 1px solid #E5E7EB; border-radius: 10px; overflow: hidden;">
                <tr>
                  <td width="33.33%" align="center" class="scorecard-divider" style="padding: 16px 8px; border-right: 1px solid #E5E7EB;">
                    <span style="display: block; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; color: #6B7280; margin-bottom: 4px;">Sessions</span>
                    <span class="stat-number" style="display: block; font-size: 20px; font-weight: 700; color: #111827; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
                      ${stats.sessions ?? 0}
                    </span>
                  </td>
                  <td width="33.33%" align="center" class="scorecard-divider" style="padding: 16px 8px; border-right: 1px solid #E5E7EB;">
                    <span style="display: block; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; color: #6B7280; margin-bottom: 4px;">Total Volume</span>
                    <span style="display: block; font-size: 20px; font-weight: 700; color: #D97706; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
                      ${typeof stats.totalVolume === 'number' ? stats.totalVolume.toLocaleString() : (stats.totalVolume ?? 0)} <span style="font-size: 11px; font-weight: 500; color: #6B7280;">kg</span>
                    </span>
                  </td>
                  <td width="33.33%" align="center" style="padding: 16px 8px;">
                    <span style="display: block; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; color: #6B7280; margin-bottom: 4px;">PRs &amp; Medal</span>
                    <span style="display: block; font-size: 18px; font-weight: 700; color: #059669; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
                      ${achievementMedal.medal} ${stats.prsCount ?? 0}
                    </span>
                  </td>
                </tr>
              </table>
              ` : ""}

              <!-- Highlights Box -->
              ${highlightsText ? `
              <div class="highlight-box" style="background-color: #FEF9C3; border: 1px solid #FDE047; border-left: 4px solid #CA8A04; border-radius: 8px; padding: 16px 20px; margin-bottom: 24px;">
                <div style="font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; color: #854D0E; margin-bottom: 6px;">
                  ✨ Key Takeaways
                </div>
                <div>
                  ${parseMarkdownToHtml(highlightsText)}
                </div>
              </div>
              ` : ""}

              <!-- Rendered Core Sections -->
              ${renderedSections}

              <!-- Focus for Next Cycle (Actionable pointers with automatic highlighting) -->
              ${content?.lookingAhead && typeof content.lookingAhead === "string" && content.lookingAhead.trim().length > 0 ? `
              <table width="100%" border="0" cellspacing="0" cellpadding="0" class="focus-box" style="margin-top: 8px; margin-bottom: 20px; background-color: #EFF6FF; border: 1px solid #BFDBFE; border-left: 4px solid #2563EB; border-radius: 8px; overflow: hidden;">
                <tr>
                  <td style="padding: 16px 20px;">
                    <div style="font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; color: #1E40AF; margin-bottom: 8px;">
                      🎯 Focus For Next Cycle (Action Pointers)
                    </div>
                    <div style="color: #1E3A8A;">
                      ${parseMarkdownToHtml(content.lookingAhead, true)}
                    </div>
                  </td>
                </tr>
              </table>
              ` : ""}

              <!-- Primary CTA (Bulletproof Button) -->
              <table width="100%" border="0" cellspacing="0" cellpadding="0" style="margin: 28px 0 12px 0;">
                <tr>
                  <td align="center">
                    <table border="0" cellspacing="0" cellpadding="0">
                      <tr>
                        <td align="center" bgcolor="#F4B740" style="border-radius: 8px; background-color: #F4B740;">
                          <a href="${escapeHtml(dashboardUrl)}" target="_blank" style="font-size: 14px; font-weight: 700; color: #0C0E12; text-decoration: none; padding: 12px 28px; border-radius: 8px; border: 1px solid #E2A028; display: inline-block; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; letter-spacing: 0.02em;">
                            View Detailed Analytics &rarr;
                          </a>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>

            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td bgcolor="#F9FAFB" class="footer-box" style="padding: 24px 32px; background-color: #F9FAFB; border-top: 1px solid #E5E7EB; text-align: center;">
              <p style="margin: 0 0 6px 0; font-size: 12px; color: #6B7280;">
                Generated automatically by your <strong>Workout Performance Dashboard</strong>.
              </p>
              <p style="margin: 0; font-size: 11px; color: #9CA3AF;">
                Keep up the consistent work · Every session counts.
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}
