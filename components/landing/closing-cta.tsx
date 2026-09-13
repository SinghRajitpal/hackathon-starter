import Link from "next/link";

export function ClosingCta() {
  return (
    <section className="relative px-6 py-32">
      <div className="mx-auto flex max-w-2xl flex-col items-center gap-8 text-center">
        <h2 className="font-serif text-4xl leading-tight text-white sm:text-5xl">
          Score today. Stress-test tomorrow. Invest accordingly.
        </h2>
        <Link
          href="/app"
          className="inline-block origin-center rounded-full bg-white px-8 py-4 text-lg font-medium text-[#0b0d22] transition-transform duration-200 hover:scale-110"
        >
          get started →
        </Link>
      </div>
    </section>
  );
}
