const STATS = [
  { value: "503", label: "S&P 500 companies scored" },
  { value: "12", label: "Sector-relative variables per company" },
  { value: "6,036", label: "Individual z-scores computed" },
  { value: "11", label: "GICS sectors, compared apples-to-apples" },
  { value: "4", label: "Independent data sources blended" },
  { value: "Quarterly", label: "Financials refreshed, not stale TTM" },
];

export function ScopeSection() {
  return (
    <section id="the-scope" className="relative px-6 py-32">
      <div className="mx-auto max-w-3xl text-center">
        <span className="text-xs font-semibold uppercase tracking-[0.2em] text-indigo-300/80">
          The Scope
        </span>
        <h2 className="mt-4 font-serif text-3xl text-white sm:text-4xl">
          Every score, backed by the numbers.
        </h2>
      </div>
      <div className="mx-auto mt-16 grid max-w-5xl grid-cols-2 gap-x-8 gap-y-14 text-center sm:grid-cols-3">
        {STATS.map((stat) => (
          <div key={stat.label} className="flex flex-col items-center gap-3">
            <span className="font-serif text-5xl text-white sm:text-6xl">
              {stat.value}
            </span>
            <span className="max-w-[14rem] text-sm text-slate-400">
              {stat.label}
            </span>
          </div>
        ))}
      </div>
    </section>
  );
}
