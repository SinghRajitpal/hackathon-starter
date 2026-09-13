import type { CompanyPacket, MarketPacket, Packet, PortfolioPacket, PositionRow, SectorPacket } from "./packets";
import type { CompanyExplanation, ExplanationPayload, MarketExplanation, PortfolioExplanation, SectorExplanation } from "./types";
import type { VerdictReasonCode } from "./verdict";

/**
 * Deterministic explanations assembled from the packet alone, used when Gemini is off, fails, or
 * writes an ungrounded number. Every figure is copied verbatim from the packet, so the text always
 * passes validateGrounding.
 */

const REASON_TEXT: Record<VerdictReasonCode, string> = {
  top_third_score_revenue_at_risk_at_or_below_sector_median:
    "sits in the top third of its sector by composite score with revenue at risk at or below the sector median",
  bottom_third_score: "sits in the bottom third of its sector by composite score",
  revenue_at_risk_above_sector_p75: "has revenue at risk above the sector 75th percentile",
  top_third_score_revenue_at_risk_above_sector_median:
    "sits in the top third of its sector by composite score, but its revenue at risk is above the sector median",
  middle_third_score: "sits in the middle of its sector by composite score",
};

const orNotComputed = (value: number | null, unit = "") => (value === null ? "not computed" : `${value}${unit}`);

/** Relative distance from the sector median; used only to order drivers, never shown. */
function gap(value: number | null, sectorMedian: number | null): number {
  if (value === null || sectorMedian === null) return 0;
  return Math.abs(value - sectorMedian) / Math.max(Math.abs(sectorMedian), 0.01);
}

function companyFallback(p: CompanyPacket): CompanyExplanation {
  const drivers = [
    {
      text:
        p.transition_bill_to_ebitda_years === null
          ? "The tool did not compute cleanup cost in years of earnings"
          : `Cleanup cost ${p.transition_bill_to_ebitda_years} years of earnings vs sector median ${orNotComputed(p.sector_median_transition_bill_to_ebitda_years)}`,
      weight: gap(p.transition_bill_to_ebitda_years, p.sector_median_transition_bill_to_ebitda_years),
    },
    {
      text:
        p.revenue_at_risk_pct === null
          ? "The tool did not compute revenue at risk"
          : `Revenue at risk ${p.revenue_at_risk_pct}% vs sector median ${orNotComputed(p.sector_median_revenue_at_risk_pct, "%")}`,
      weight: gap(p.revenue_at_risk_pct, p.sector_median_revenue_at_risk_pct),
    },
    {
      text: `Composite score ${orNotComputed(p.composite_score)}, rank ${p.rank_in_sector} of ${p.sector_size} in ${p.sector}`,
      weight: Math.abs(p.rank_in_sector - (p.sector_size + 1) / 2) / Math.max(p.sector_size, 1),
    },
  ].sort((a, b) => b.weight - a.weight);

  const missing = [
    p.cleanup_cost_usd_m === null && "cleanup cost in USD",
    p.revenue_at_risk_pct === null && "revenue at risk",
    p.revenue_upside_pct === null && "revenue upside",
  ].filter((m): m is string => Boolean(m));

  return {
    verdict: p.verdict_band,
    verdict_line: `${p.verdict_band}: ${drivers[0].text}; ${drivers[1].text}.`,
    key_drivers: drivers.map((d) => d.text),
    rationale: `${p.ticker} ${REASON_TEXT[p.verdict_reason_code]}. Revenue upside is ${orNotComputed(p.revenue_upside_pct, "%")}.`,
    caveat: missing.length > 0 ? `The tool did not compute ${missing.join(", ")}.` : "",
  };
}

function sectorFallback(p: SectorPacket): SectorExplanation {
  const spread =
    p.best_ticker && p.worst_ticker
      ? `Best ${p.best_ticker} scores ${orNotComputed(p.best_composite_score)}; worst ${p.worst_ticker} scores ${orNotComputed(p.worst_composite_score)}.`
      : "The tool found no scored companies to compare.";
  return {
    headline: `${p.sector}: ${p.sector_verdict}`,
    takeaways: [
      `Cleanup cost is ${orNotComputed(p.cleanup_cost_years_of_sector_ebitda)} years of sector EBITDA.`,
      `Fossil revenue share ${orNotComputed(p.fossil_revenue_share_pct, "%")}, green revenue share ${orNotComputed(p.green_revenue_share_pct, "%")}.`,
      spread,
    ],
    pickability: p.pickable
      ? `A winner-loser gap of ${orNotComputed(p.winner_loser_gap_years)} years makes stock selection inside ${p.sector} worthwhile.`
      : `A winner-loser gap of ${orNotComputed(p.winner_loser_gap_years)} years is too narrow; ${p.sector} moves as one block.`,
  };
}

function marketFallback(p: MarketPacket): MarketExplanation {
  const byBurden = [...p.leaderboard].sort(
    (a, b) => (b.cleanup_cost_years_of_sector_ebitda ?? 0) - (a.cleanup_cost_years_of_sector_ebitda ?? 0),
  );
  const count = byBurden.length >= 6 ? 3 : 2;
  const describe = (r: MarketPacket["leaderboard"][number]) =>
    `${r.sector}: cleanup cost ${orNotComputed(r.cleanup_cost_years_of_sector_ebitda)} years of sector EBITDA, fossil revenue ${orNotComputed(r.fossil_revenue_share_pct, "%")}.`;
  const pickable = p.leaderboard.filter((r) => r.pickable);
  return {
    headline: `${p.pickable_sector_count} of ${p.sectors_covered} sectors are worth stock picking`,
    heaviest_hit: byBurden.slice(0, count).map(describe),
    least_affected: byBurden.slice(-count).reverse().map(describe),
    where_to_pick:
      pickable.length > 0
        ? `Pick winners in ${pickable.map((r) => `${r.sector} (gap ${orNotComputed(r.winner_loser_gap_years)} years)`).join(", ")}.`
        : "No sector has a wide enough winner-loser gap for single-stock picking.",
  };
}

function portfolioFallback(p: PortfolioPacket): PortfolioExplanation {
  const position = (r: PositionRow) => `${r.ticker} (${orNotComputed(r.active_weight_pp)}pp, ${orNotComputed(r.transition_bill_to_ebitda_years)} years)`;
  const longs = p.top_longs.slice(0, 3).map(position).join(", ");
  const underweights = p.top_underweights.slice(0, 3).map(position).join(", ");
  const shorts = p.top_shorts?.slice(0, 3).map((r) => `${r.ticker} (${orNotComputed(r.short_weight_pct, "%")})`).join(", ");
  return {
    headline: `${p.preset} book for a fund that may trail the S&P 500 by ${p.risk_appetite_band}`,
    long_thesis: longs ? `Largest overweights: ${longs}.` : "The book holds every name at benchmark weight.",
    short_thesis:
      p.long_short_book && shorts
        ? `Largest shorts: ${shorts}.`
        : `Shorting is disabled, so the book expresses the view only by owning winners${underweights ? `; largest underweights: ${underweights}` : ""}.`,
    risk_note: `Active weight limit ${orNotComputed(p.active_limit_pp)}pp per name${p.robust_picks_only ? ", robust picks only" : ""}; ${p.sectors_traded} sectors traded.`,
  };
}

export function fallbackExplanation(packet: Packet): ExplanationPayload {
  switch (packet.scope) {
    case "company":
      return companyFallback(packet);
    case "sector":
      return sectorFallback(packet);
    case "market":
      return marketFallback(packet);
    case "portfolio":
      return portfolioFallback(packet);
  }
}
