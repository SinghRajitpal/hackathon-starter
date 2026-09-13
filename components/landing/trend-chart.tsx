const PATH =
  "M10,230 L70,200 L130,215 L190,150 L240,165 L300,232 L340,212 L390,240 L440,196 L490,158 L530,178 L570,128 L660,20";

export function TrendChart() {
  return (
    <div className="relative w-full">
      <svg viewBox="0 0 670 250" className="h-auto w-full overflow-visible">
        <defs>
          <linearGradient id="trend-fill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="rgba(255,255,255,0.25)" />
            <stop offset="100%" stopColor="rgba(255,255,255,0)" />
          </linearGradient>
          <filter id="trend-glow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="4" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {[70, 140, 210].map((y) => (
          <line
            key={y}
            x1="0"
            y1={y}
            x2="670"
            y2={y}
            stroke="rgba(255,255,255,0.15)"
            strokeDasharray="4 6"
          />
        ))}

        <path d={`${PATH} L660,250 L10,250 Z`} fill="url(#trend-fill)" />
        <path
          d={PATH}
          fill="none"
          stroke="white"
          strokeWidth={2}
          strokeLinejoin="round"
          strokeLinecap="round"
          filter="url(#trend-glow)"
        />

        <g
          style={{
            offsetPath: `path('${PATH}')`,
            offsetRotate: "auto",
            animation: "trend-travel 5.5s linear infinite",
          }}
        >
          <circle cx="0" cy="0" r="5" fill="white" filter="url(#trend-glow)" />
        </g>
      </svg>

      <style>{`
        @keyframes trend-travel {
          0% {
            offset-distance: 0%;
            opacity: 0;
          }
          5% {
            opacity: 1;
          }
          95% {
            opacity: 1;
          }
          100% {
            offset-distance: 100%;
            opacity: 0;
          }
        }
      `}</style>
    </div>
  );
}
