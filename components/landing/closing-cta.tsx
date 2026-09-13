import Link from "next/link";

import { Reveal } from "@/components/landing/reveal";

export function ClosingCta() {
  return (
    <section className="relative px-6 py-32">
      <Reveal className="mx-auto flex max-w-2xl flex-col items-center gap-8 text-center">
        <h2 className="font-serif text-5xl leading-tight text-white sm:text-6xl">
          Score today. Stress-test tomorrow. Invest accordingly.
        </h2>
        <Link
          href="/app"
          className="inline-block origin-center rounded-full bg-white px-8 py-4 text-xl font-medium text-[#0b0d22] transition-transform duration-200 hover:scale-110"
        >
          get started →
        </Link>
      </Reveal>
    </section>
  );
}
