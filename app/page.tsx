import Link from "next/link";

export default function Home() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center gap-6 bg-black">
      <h1 className="text-white text-4xl font-bold text-center px-5">
        ETHack - Let&apos;s start building
      </h1>
      <div className="flex gap-4">
        <Link
          href="/tools/sustainability-evaluator"
          className="rounded-md border border-white/20 px-4 py-2 text-sm font-medium text-white hover:bg-white/10"
        >
          Sustainability Evaluator
        </Link>
        <Link
          href="/tools/net-zero-scenario"
          className="rounded-md border border-white/20 px-4 py-2 text-sm font-medium text-white hover:bg-white/10"
        >
          Net-Zero Scenario Tool
        </Link>
      </div>
    </main>
  );
}
