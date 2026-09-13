import Link from "next/link";

import { Globe } from "@/components/landing/globe";

export function Hero() {
  return (
    <section className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden px-6 pt-16">
      <div className="mx-auto grid w-full max-w-7xl grid-cols-1 items-center gap-12 py-24 md:grid-cols-2">
        <div className="flex flex-col items-start gap-7">
          <span className="rounded-full border border-white/15 bg-white/5 px-4 py-2 text-base text-slate-300">
            Meridian ranks every S&amp;P 500 company against an objective,
            mathematically weighted ideal.
          </span>
          <h1 className="font-serif text-6xl leading-[1.1] text-white sm:text-7xl">
            Score today.
            <br />
            Stress-test tomorrow.
          </h1>
          <p className="max-w-md font-serif text-xl leading-relaxed text-slate-300">
            See exactly which numbers drive each score, stress-test what
            happens the day the world commits to net zero, and build a
            portfolio ready for either outcome.
          </p>
          <Link
            href="/app"
            className="inline-block origin-left rounded-full bg-white px-7 py-3.5 text-lg font-medium text-[#0b0d22] transition-transform duration-200 hover:scale-110"
          >
            get started →
          </Link>
        </div>
        <Globe />
      </div>
    </section>
  );
}
