import { TrendChart } from "@/components/landing/trend-chart";

export function NetZeroSection() {
  return (
    <section id="net-zero-scenario" className="relative px-6 py-32">
      <div className="mx-auto flex max-w-3xl flex-col items-center gap-6 text-center">
        <span className="text-xs font-semibold uppercase tracking-[0.2em] text-indigo-300/80">
          Net-Zero Scenario
        </span>
        <p className="font-serif text-lg leading-relaxed text-slate-200">
          Tomorrow, the world commits to net zero. Every company must pay to
          clean up its own emissions, and demand shifts — away from what it
          can no longer sell, toward what the transition needs.
        </p>
        <p className="font-serif text-base leading-relaxed text-slate-400">
          We model exactly where that shock lands, then turn it into a
          risk-adjusted portfolio: long the companies built to withstand it,
          short the ones that aren&apos;t. Sector by sector. No guessing on
          green.
        </p>
      </div>
      <div className="mx-auto mt-20 max-w-4xl">
        <TrendChart />
      </div>
    </section>
  );
}
