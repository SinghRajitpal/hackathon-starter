import { PortfolioGlyph } from "@/components/landing/portfolio-glyph";
import { Reveal } from "@/components/landing/reveal";
import { SustainabilityFan } from "@/components/landing/sustainability-fan";
import { TrendChart } from "@/components/landing/trend-chart";

const STEPS = [
  {
    eyebrow: "Sustainability Score",
    title: "Every company, ranked against an ideal",
    description:
      "Rank every company against an objective, mathematically weighted ideal — not by opinion.",
    visual: <SustainabilityFan />,
  },
  {
    eyebrow: "Net-Zero Scenario",
    title: "Model who survives the transition",
    description:
      "Model exactly where the shock lands when the world commits to net zero, and who survives it.",
    visual: <TrendChart />,
  },
  {
    eyebrow: "Portfolio",
    title: "A long/short book, ready to trade",
    description:
      "Turn every score into a risk-adjusted, long/short portfolio your portfolio manager can act on.",
    visual: <PortfolioGlyph />,
  },
];

export function HowItWorks() {
  return (
    <section id="how-it-works" className="relative px-6 py-32">
      <div className="mx-auto max-w-6xl">
        <span className="text-base font-semibold uppercase tracking-[0.2em] text-indigo-300/80">
          How it works
        </span>

        <Reveal className="mt-6 flex flex-col gap-10 border-b border-white/10 pb-16 sm:flex-row sm:items-start sm:justify-between sm:gap-16">
          <h2 className="max-w-xl font-serif text-5xl leading-tight text-white sm:text-6xl">
            Three steps from raw data to a portfolio you can act on.
          </h2>
          <div className="flex max-w-md flex-col gap-5 pt-2 text-xl leading-relaxed text-slate-400">
            <p>
              Meridian pulls live quarterly financials, ESG risk ratings, and
              legally-mandated emissions disclosures for every company in the
              S&amp;P 500.
            </p>
            <p>
              Then it turns those numbers into three things: a sustainability
              score, a net-zero stress test, and a portfolio built from both.
            </p>
          </div>
        </Reveal>

        <div className="mt-16 grid grid-cols-1 gap-12 sm:grid-cols-3 sm:gap-8">
          {STEPS.map((step, i) => (
            <Reveal
              key={step.eyebrow}
              delay={i * 120}
              className="flex flex-col gap-5"
            >
              <span className="text-base font-semibold uppercase tracking-[0.15em] text-indigo-300/80">
                {step.eyebrow}
              </span>
              <div className="flex min-h-[220px] items-center justify-center rounded-2xl border border-white/10 bg-white/[0.03] p-6">
                <div className="w-full max-w-[220px]">{step.visual}</div>
              </div>
              <h3 className="font-serif text-3xl text-white">{step.title}</h3>
              <p className="text-lg leading-relaxed text-slate-400">
                {step.description}
              </p>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
