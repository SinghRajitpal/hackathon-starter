"use client";

import { useState } from "react";

type Side = "long" | "short";

interface Position {
  ticker: string;
  side: Side;
  /** Share of gross active dollars, in percent. */
  share: number;
  color: string;
}

/**
 * Hardcoded snapshot of the Utilities long/short book at $1B gross active,
 * from the one-time engine run. It does not follow the preset controls above.
 * Order is the drawing order, clockwise from 12 o'clock: longs, then shorts.
 */
const GROSS_USD = 1_000_000_000;
const SIDE_TOTAL = { long: 50.0, short: 50.0 } as const;
const POSITIONS: Position[] = [
  { ticker: "ES", side: "long", share: 17.2, color: "#2a78d6" },
  { ticker: "NEE", side: "long", share: 13.3, color: "#1baf7a" },
  { ticker: "AES", side: "long", share: 6.3, color: "#6450d6" },
  { ticker: "PEG", side: "long", share: 4.1, color: "#5dc6a2" },
  { ticker: "EXC", side: "long", share: 3.5, color: "#3a8bdd" },
  { ticker: "FE", side: "long", share: 2.8, color: "#99c25b" },
  { ticker: "NI", side: "long", share: 2.8, color: "#a6e3cf" },
  { ticker: "SO", side: "short", share: 17.1, color: "#eb6834" },
  { ticker: "SRE", side: "short", share: 9.3, color: "#e34948" },
  { ticker: "XEL", side: "short", share: 8.1, color: "#e87ba4" },
  { ticker: "VST", side: "short", share: 8.0, color: "#eda100" },
  { ticker: "ETR", side: "short", share: 3.5, color: "#d95b31" },
  { ticker: "ATO", side: "short", share: 2.1, color: "#ef9c7c" },
  { ticker: "PPL", side: "short", share: 1.8, color: "#f2bfd0" },
];

/** Border colours per side, lightened from the source chart so they read on the navy card. */
const SIDE_STROKE: Record<Side, string> = { long: "#34d399", short: "#f87171" };
const SHORT_DASH = "7 5";

const SIZE = 360;
const CENTER = SIZE / 2;
const OUTER = 168;
const INNER = 104;

function point(radius: number, angle: number): string {
  return `${(CENTER + radius * Math.cos(angle)).toFixed(2)} ${(CENTER + radius * Math.sin(angle)).toFixed(2)}`;
}

function slicePath(start: number, end: number): string {
  const large = end - start > Math.PI ? 1 : 0;
  return [
    `M ${point(OUTER, start)}`,
    `A ${OUTER} ${OUTER} 0 ${large} 1 ${point(OUTER, end)}`,
    `L ${point(INNER, end)}`,
    `A ${INNER} ${INNER} 0 ${large} 0 ${point(INNER, start)}`,
    "Z",
  ].join(" ");
}

/** Slices at least this big (percent) carry their ticker, so identity never rests on colour alone. */
const LABEL_MIN_SHARE = 5;

const TOTAL_SHARE = POSITIONS.reduce((sum, p) => sum + p.share, 0);
const SLICES = POSITIONS.reduce<{ position: Position; d: string; end: number; label: [number, number] }[]>(
  (acc, position) => {
    const start = acc.length ? acc[acc.length - 1].end : -Math.PI / 2;
    const end = start + (position.share / TOTAL_SHARE) * 2 * Math.PI;
    const mid = (start + end) / 2;
    const radius = (OUTER + INNER) / 2;
    acc.push({
      position,
      d: slicePath(start, end),
      end,
      label: [CENTER + radius * Math.cos(mid), CENTER + radius * Math.sin(mid)],
    });
    return acc;
  },
  [],
);

function dollars(share: number): string {
  return `$${Math.round((share / 100) * GROSS_USD / 1e6)}M`;
}

const SIDE_LABEL: Record<Side, string> = { long: "Long", short: "Short" };

export function LongShortDonut() {
  const [active, setActive] = useState<string | null>(null);
  const focused = POSITIONS.find((p) => p.ticker === active) ?? null;

  return (
    <div className="flex flex-col items-center gap-8 py-2 lg:flex-row lg:justify-center lg:gap-16">
      <svg
        viewBox={`0 0 ${SIZE} ${SIZE}`}
        role="img"
        aria-label="Utilities long/short book at $1B gross active: longs ES, NEE, AES, PEG, EXC, FE, NI (50%); shorts SO, SRE, XEL, VST, ETR, ATO, PPL (50%)."
        className="w-full max-w-[380px] shrink-0"
      >
        {SLICES.map(({ position, d }) => (
          <path
            key={position.ticker}
            d={d}
            fill={position.color}
            stroke={SIDE_STROKE[position.side]}
            strokeWidth={3}
            strokeDasharray={position.side === "short" ? SHORT_DASH : undefined}
            strokeLinejoin="round"
            opacity={active && active !== position.ticker ? 0.3 : 1}
            className="cursor-default transition-opacity"
            onMouseEnter={() => setActive(position.ticker)}
            onMouseLeave={() => setActive(null)}
          >
            <title>{`${position.ticker} · ${SIDE_LABEL[position.side]} ${position.share.toFixed(1)}% · ${dollars(position.share)}`}</title>
          </path>
        ))}
        {SLICES.filter(({ position }) => position.share >= LABEL_MIN_SHARE).map(({ position, label }) => (
          <text
            key={`label-${position.ticker}`}
            x={label[0]}
            y={label[1]}
            textAnchor="middle"
            dominantBaseline="central"
            fill="#0b0d22"
            opacity={active && active !== position.ticker ? 0.3 : 1}
            className="pointer-events-none text-[13px] font-semibold"
          >
            {position.ticker}
          </text>
        ))}
        {focused ? (
          <text x={CENTER} y={CENTER} textAnchor="middle" className="fill-foreground">
            <tspan x={CENTER} dy="-0.6em" className="text-[28px] font-semibold">
              {focused.ticker}
            </tspan>
            <tspan x={CENTER} dy="1.4em" className="fill-muted-foreground text-[15px]">
              {SIDE_LABEL[focused.side]} {focused.share.toFixed(1)}% · {dollars(focused.share)}
            </tspan>
          </text>
        ) : (
          <text x={CENTER} y={CENTER} textAnchor="middle" className="fill-foreground">
            <tspan x={CENTER} dy="-0.4em" className="text-[30px] font-semibold">
              $1B
            </tspan>
            <tspan x={CENTER} dy="1.5em" className="fill-muted-foreground text-[15px]">
              gross active
            </tspan>
          </text>
        )}
      </svg>

      <div className="flex w-full max-w-xl flex-col gap-6">
        <div className="grid grid-cols-1 gap-8 sm:grid-cols-2">
          {(["long", "short"] as const).map((side) => (
            <div key={side}>
              <div
                className="mb-3 border-t-[3px]"
                style={{ borderColor: SIDE_STROKE[side], borderStyle: side === "short" ? "dashed" : "solid" }}
              />
              <div className="mb-2 flex items-baseline justify-between">
                <span className="text-xl font-semibold">
                  {SIDE_LABEL[side]} {SIDE_TOTAL[side].toFixed(1)}%
                </span>
                <span className="text-muted-foreground">${(SIDE_TOTAL[side] / 100).toFixed(1)}B</span>
              </div>
              <ul className="flex flex-col">
                {POSITIONS.filter((p) => p.side === side).map((p) => (
                  <li key={p.ticker}>
                    <button
                      type="button"
                      onMouseEnter={() => setActive(p.ticker)}
                      onMouseLeave={() => setActive(null)}
                      onFocus={() => setActive(p.ticker)}
                      onBlur={() => setActive(null)}
                      className={`flex w-full items-center gap-3 rounded px-1 py-1.5 text-left transition-colors hover:bg-white/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                        active === p.ticker ? "bg-white/5" : ""
                      }`}
                    >
                      <span
                        aria-hidden
                        className="size-4 shrink-0 rounded-[3px] border-2"
                        style={{
                          backgroundColor: p.color,
                          borderColor: SIDE_STROKE[side],
                          borderStyle: side === "short" ? "dashed" : "solid",
                        }}
                      />
                      <span className="flex-1">{p.ticker}</span>
                      <span className="font-mono tabular-nums text-muted-foreground">{p.share.toFixed(1)}%</span>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <p className="text-sm text-muted-foreground">Solid border = overweight, dashed = underweight</p>
      </div>
    </div>
  );
}
