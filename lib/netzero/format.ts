/** Display helpers shared by the ticker panel and the portfolio page. */

export function formatUsd(value: number | null): string {
  if (value === null || !Number.isFinite(value)) return "n/a";
  const sign = value < 0 ? "-" : "";
  const abs = Math.abs(value);
  if (abs >= 1e9) return `${sign}$${(abs / 1e9).toFixed(1)}bn`;
  if (abs >= 1e6) return `${sign}$${(abs / 1e6).toFixed(1)}M`;
  if (abs >= 1e3) return `${sign}$${(abs / 1e3).toFixed(1)}k`;
  return `${sign}$${abs.toFixed(0)}`;
}

export function formatTonnes(value: number | null): string {
  if (value === null || !Number.isFinite(value)) return "n/a";
  if (value >= 1e6) return `${(value / 1e6).toFixed(2)} Mt`;
  if (value >= 1e3) return `${(value / 1e3).toFixed(1)} kt`;
  return `${value.toFixed(0)} t`;
}

export function formatPercent(value: number | null, digits = 0): string {
  if (value === null || !Number.isFinite(value)) return "n/a";
  return `${(value * 100).toFixed(digits)}%`;
}

export function formatYears(value: number | null): string {
  if (value === null || !Number.isFinite(value)) return "n/a";
  return `${value.toFixed(2)} yrs`;
}

export function formatRatio(value: number | null): string {
  if (value === null || !Number.isFinite(value)) return "n/a";
  return `${value.toFixed(1)}x`;
}
