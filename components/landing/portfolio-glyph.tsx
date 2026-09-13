const ROWS = [
  { short: 40, long: 140 },
  { short: 90, long: 110 },
  { short: 60, long: 170 },
  { short: 30, long: 95 },
  { short: 75, long: 130 },
];

export function PortfolioGlyph() {
  return (
    <svg viewBox="-200 -100 400 200" className="h-auto w-full overflow-visible">
      <line
        x1="0"
        y1="-85"
        x2="0"
        y2="85"
        stroke="rgba(255,255,255,0.15)"
      />
      {ROWS.map((row, i) => {
        const y = -68 + i * 34;
        return (
          <g key={i}>
            <line
              x1={-row.short}
              y1={y}
              x2="0"
              y2={y}
              stroke="white"
              strokeWidth={3}
              strokeLinecap="round"
              opacity={0.35}
            />
            <line
              x1="0"
              y1={y}
              x2={row.long}
              y2={y}
              stroke="white"
              strokeWidth={3}
              strokeLinecap="round"
              opacity={0.9}
            />
          </g>
        );
      })}
    </svg>
  );
}
