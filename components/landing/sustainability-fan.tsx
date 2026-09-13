"use client";

import { useMemo, useState } from "react";

const LINE_COUNT = 56;

function mulberry32(seed: number) {
  return function random() {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function useFanLines() {
  return useMemo(() => {
    const random = mulberry32(42);
    return Array.from({ length: LINE_COUNT }, (_, i) => {
      const t = i / (LINE_COUNT - 1);
      const angle = -84 + t * 168 + (random() - 0.5) * 2;
      const length = 170 + random() * 190;
      return { angle, length };
    });
  }, []);
}

export function SustainabilityFan() {
  const lines = useFanLines();
  const [hovered, setHovered] = useState<number | null>(null);

  return (
    <svg
      viewBox="-380 -420 760 440"
      className="h-auto w-full overflow-visible"
    >
      <defs>
        <radialGradient id="fan-glow" cx="50%" cy="100%" r="60%">
          <stop offset="0%" stopColor="rgba(255,255,255,0.9)" />
          <stop offset="100%" stopColor="rgba(255,255,255,0)" />
        </radialGradient>
      </defs>
      <circle cx="0" cy="0" r="70" fill="url(#fan-glow)" />
      {lines.map((line, i) => {
        const active = hovered === i;
        const end = -(active ? line.length + 24 : line.length);
        return (
          <g
            key={i}
            transform={`rotate(${line.angle})`}
            onMouseEnter={() => setHovered(i)}
            onMouseLeave={() => setHovered(null)}
            style={{ cursor: "pointer" }}
          >
            <line
              x1="0"
              y1="0"
              x2="0"
              y2={-line.length}
              stroke="transparent"
              strokeWidth={14}
            />
            <line
              x1="0"
              y1="0"
              x2="0"
              y2={end}
              stroke="white"
              strokeWidth={active ? 2 : 1}
              opacity={active ? 1 : 0.55}
              style={{ transition: "all 200ms ease" }}
            />
            <circle
              cx="0"
              cy={end}
              r={active ? 3 : 1.6}
              fill="white"
              opacity={active ? 1 : 0.8}
              style={{ transition: "all 200ms ease" }}
            />
          </g>
        );
      })}
    </svg>
  );
}
