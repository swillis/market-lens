/**
 * US equity market status utilities.
 * All times are evaluated in America/New_York (ET).
 *
 * Sessions:
 *   pre_market   04:00 – 09:29 ET  (limited liquidity, news-driven)
 *   open         09:30 – 15:59 ET  (regular session)
 *   after_hours  16:00 – 19:59 ET  (extended session)
 *   closed       20:00 – 03:59 ET, all day Sat/Sun
 *
 * Note: this does not account for US market holidays.
 */

export type MarketStatus = "open" | "pre_market" | "after_hours" | "closed";

export type MarketStatusInfo = {
  status: MarketStatus;
  label: string;
  description: string;
  /** True only during the regular 9:30–4:00 session */
  isRegularSession: boolean;
};

// ---------------------------------------------------------------------------
// Core calculation
// ---------------------------------------------------------------------------

export function getMarketStatus(now: Date = new Date()): MarketStatusInfo {
  const etParts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    weekday: "short",
    hour: "numeric",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(now);

  const get = (type: string) =>
    etParts.find((p) => p.type === type)?.value ?? "";

  const weekday      = get("weekday");           // "Mon" … "Sun"
  const hour         = parseInt(get("hour"), 10);
  const minute       = parseInt(get("minute"), 10);
  const timeMinutes  = hour * 60 + minute;

  const MARKET_OPEN  = 9  * 60 + 30;  // 9:30
  const MARKET_CLOSE = 16 * 60;        // 16:00
  const PRE_START    = 4  * 60;        // 04:00
  const AH_END       = 20 * 60;        // 20:00

  const isWeekend = weekday === "Sat" || weekday === "Sun";

  let status: MarketStatus;

  if (isWeekend || timeMinutes < PRE_START || timeMinutes >= AH_END) {
    status = "closed";
  } else if (timeMinutes >= MARKET_OPEN && timeMinutes < MARKET_CLOSE) {
    status = "open";
  } else if (timeMinutes >= PRE_START && timeMinutes < MARKET_OPEN) {
    status = "pre_market";
  } else {
    status = "after_hours";
  }

  const INFO: Record<MarketStatus, { label: string; description: string }> = {
    open: {
      label: "Market open",
      description: "Live session — the timeline will update as the narrative evolves.",
    },
    pre_market: {
      label: "Pre-market",
      description:
        "Pre-market session (4 AM – 9:30 AM ET). Price and news data may be limited until the regular session opens.",
    },
    after_hours: {
      label: "After hours",
      description:
        "After-hours session (4 PM – 8 PM ET). The narrative reflects today's closing data.",
    },
    closed: {
      label: isWeekend ? "Market closed (weekend)" : "Market closed",
      description:
        "Markets are closed. The timeline will resume updating during the next trading session (9:30 AM – 4 PM ET, Mon–Fri).",
    },
  };

  return {
    status,
    isRegularSession: status === "open",
    ...INFO[status],
  };
}
