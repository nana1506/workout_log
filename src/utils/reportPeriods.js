/**
 * Utilities for computing completed reporting periods (ISO weeks and calendar months).
 * Pure functions with zero browser or external dependencies.
 * Evaluates strictly in UTC to align with Vercel Cron and Supabase timestamps.
 */

/**
 * Formats a Date instance as a YYYY-MM-DD string using UTC.
 * @param {Date|string|number} date
 * @returns {string}
 */
export function formatDateYMD(date) {
  const d = new Date(date);
  const year = d.getUTCFullYear();
  const month = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/**
 * Returns { start, end } as YYYY-MM-DD strings for the most recently COMPLETED ISO week (Monday-Sunday)
 * relative to referenceDate (evaluated in UTC).
 *
 * @param {Date|string|number} [referenceDate=new Date()]
 * @returns {{ start: string, end: string }}
 */
export function getPreviousIsoWeek(referenceDate = new Date()) {
  const ref = new Date(referenceDate);
  // ISO day of week in UTC: Monday is 1, Sunday is 7
  const dayOfWeek = ref.getUTCDay() === 0 ? 7 : ref.getUTCDay();

  // The end of the previous ISO week is Sunday = ref - dayOfWeek days
  const end = new Date(Date.UTC(ref.getUTCFullYear(), ref.getUTCMonth(), ref.getUTCDate() - dayOfWeek));
  // The start of the previous ISO week is Monday = end - 6 days
  const start = new Date(Date.UTC(end.getUTCFullYear(), end.getUTCMonth(), end.getUTCDate() - 6));

  return {
    start: formatDateYMD(start),
    end: formatDateYMD(end),
  };
}

/**
 * Returns { start, end } as YYYY-MM-DD strings for the most recently COMPLETED calendar month
 * relative to referenceDate (evaluated in UTC).
 *
 * @param {Date|string|number} [referenceDate=new Date()]
 * @returns {{ start: string, end: string }}
 */
export function getPreviousCalendarMonth(referenceDate = new Date()) {
  const ref = new Date(referenceDate);
  const year = ref.getUTCFullYear();
  const month = ref.getUTCMonth(); // 0-indexed (0 = Jan, 11 = Dec) in UTC

  // First day of previous month in UTC:
  const start = new Date(Date.UTC(year, month - 1, 1));
  // Last day of previous month (day 0 of current month) in UTC:
  const end = new Date(Date.UTC(year, month, 0));

  return {
    start: formatDateYMD(start),
    end: formatDateYMD(end),
  };
}

/**
 * Calculates the prior period window preceding a given period window for comparison / delta calculations.
 *
 * @param {'weekly'|'monthly'} periodType
 * @param {string} periodStart - YYYY-MM-DD
 * @param {string} periodEnd - YYYY-MM-DD
 * @returns {{ start: string, end: string }}
 */
export function getPriorPeriodWindow(periodType, periodStart, periodEnd) {
  const sDate = new Date(periodStart + "T00:00:00Z");
  if (periodType === "monthly") {
    return getPreviousCalendarMonth(sDate);
  }
  // Weekly: prior 7-day window
  const priorEnd = new Date(Date.UTC(sDate.getUTCFullYear(), sDate.getUTCMonth(), sDate.getUTCDate() - 1));
  const priorStart = new Date(Date.UTC(priorEnd.getUTCFullYear(), priorEnd.getUTCMonth(), priorEnd.getUTCDate() - 6));
  return {
    start: formatDateYMD(priorStart),
    end: formatDateYMD(priorEnd),
  };
}
