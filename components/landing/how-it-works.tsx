import { PortfolioGlyph } from "@/components/landing/portfolio-glyph";
import { SustainabilityFan } from "@/components/landing/sustainability-fan";
import { TrendChart } from "@/components/landing/trend-chart";

const STEPS = [
  {
    number: "01",
    title: "Sustainability Score",
    description:
      "Rank every company against an objective, mathematically weighted ideal — not by opinion.",
    visual: <SustainabilityFan />,
  },
  {
    number: "02",
    title: "Net-Zero Stress Test",
    description:
      "Model exactly where the shock lands when the world commits to net zero, and who survives it.",
    visual: <TrendChart />,
  },
  {
    number: "03",
    title: "Portfolio Construction",
    description:
      "Turn every score into a risk-adjusted, long/short portfolio your portfolio manager can act on.",
    visual: <PortfolioGlyph />,
  },
];

export function HowItWorks() {
  return (
    <section id="how-it-works" className="relative px-6 py-32">
      <div className="mx-auto max-w-3xl text-center">
        <span className="text-xs font-semibold uppercase tracking-[0.2em] text-indigo-300/80">
          How it works
        </span>
        <h2 className="mt-4 font-serif text-3xl text-white sm:text-4xl">
          Three steps from raw data to a portfolio you can act on.
        </h2>
      </div>

      <div className="relative mx-auto mt-24 max-w-5xl">
        <div className="absolute bottom-6 left-6 top-6 hidden w-px bg-white/10 sm:block" />
        <div className="flex flex-col gap-24">
          {STEPS.map((step) => (
            <div
              key={step.number}
              className="relative flex flex-col gap-8 sm:flex-row sm:items-center sm:gap-12"
            >
              <div className="flex items-start gap-6 sm:w-1/2">
                <span className="relative z-10 flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-white/15 bg-[#0b0d22] font-serif text-lg text-white">
                  {step.number}
                </span>
                <div className="flex flex-col gap-3 pt-1">
                  <h3 className="font-serif text-2xl text-white">
                    {step.title}
                  </h3>
                  <p className="max-w-sm font-serif text-base leading-relaxed text-slate-400">
                    {step.description}
                  </p>
                </div>
              </div>
              <div className="sm:w-1/2">
                <div className="mx-auto max-w-xs">{step.visual}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
