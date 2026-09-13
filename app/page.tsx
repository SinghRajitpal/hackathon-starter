import Link from "next/link";

import { TickerSearch } from "@/components/ticker-search";

export default function Home() {
  return (
    <main className="min-h-screen flex flex-col items-center gap-8 px-5 py-16">
      <h1 className="text-4xl font-bold text-center">ETHack</h1>
      <TickerSearch />
      <Link href="/leaderboard" className="text-sm underline text-muted-foreground hover:text-foreground">
        View the Sustainability Leaderboard
      </Link>
    </main>
  );
}
