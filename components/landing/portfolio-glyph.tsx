"use client";

import { useState } from "react";

const HOLDINGS = [
  { pct: 34 },
  { pct: 24 },
  { pct: 18 },
  { pct: 14 },
  { pct: 10 },
];

const RADIUS = 70;
const STROKE = 26;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;
const TICK_INNER = RADIUS - STROKE / 2 - 6;
const TICK_OUTER = RADIUS + STROKE / 2 + 6;

const BOUNDARIES = (() => {
  const degrees: number[] = [];
  let cumulativePct = 0;
  for (const holding of HOLDINGS) {
    degrees.push((cumulativePct / 100) * 360);
    cumulativePct += holding.pct;
  }
  return degrees;
})();

export function PortfolioGlyph() {
  const [hovered, setHovered] = useState<number | null>(null);
  let cumulative = 0;

  return (
    <svg viewBox="-100 -100 200 200" className="h-auto w-full overflow-visible">
      <g transform="rotate(-90)">
        {HOLDINGS.map((holding, i) => {
          const dash = (holding.pct / 100) * CIRCUMFERENCE;
          const gap = CIRCUMFERENCE - dash;
          const offset = -cumulative;
          cumulative += dash;
          const active = hovered === i;

          return (
            <circle
              key={i}
              cx="0"
              cy="0"
              r={RADIUS}
              fill="none"
              stroke="white"
              strokeWidth={active ? STROKE + 6 : STROKE}
              strokeDasharray={`${dash} ${gap}`}
              strokeDashoffset={offset}
              opacity={active ? 1 : 0.4}
              onMouseEnter={() => setHovered(i)}
              onMouseLeave={() => setHovered(null)}
              style={{
                cursor: "pointer",
                transition: "opacity 200ms ease, stroke-width 200ms ease",
              }}
            />
          );
        })}
        {BOUNDARIES.map((deg, i) => {
          const rad = (deg * Math.PI) / 180;
          const cos = Math.cos(rad);
          const sin = Math.sin(rad);
          return (
            <line
              key={i}
              x1={TICK_INNER * cos}
              y1={TICK_INNER * sin}
              x2={TICK_OUTER * cos}
              y2={TICK_OUTER * sin}
              stroke="white"
              strokeWidth={2}
              strokeLinecap="round"
              opacity={0.7}
              pointerEvents="none"
            />
          );
        })}
      </g>
    </svg>
  );
}
