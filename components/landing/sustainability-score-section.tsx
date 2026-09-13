import { SustainabilityFan } from "@/components/landing/sustainability-fan";

export function SustainabilityScoreSection() {
  return (
    <section id="sustainability-score" className="relative px-6 py-32">
      <div className="mx-auto flex max-w-3xl flex-col items-center gap-6 text-center">
        <span className="text-xs font-semibold uppercase tracking-[0.2em] text-indigo-300/80">
          Sustainability Score
        </span>
        <p className="font-serif text-lg leading-relaxed text-slate-200">
          A company is sustainable if it can keep creating value without
          depending on things regulation, markets, or society are about to
          take away.
        </p>
        <p className="font-serif text-base leading-relaxed text-slate-400">
          We measure that directly: a handful of hard financial and
          environmental variables, weighted by how much they actually
          separate strong companies from weak ones — not by opinion. Every
          company is scored on its distance from an ideal, not against a
          curve.
        </p>
      </div>
      <div className="mx-auto mt-20 max-w-4xl">
        <SustainabilityFan />
      </div>
    </section>
  );
}
