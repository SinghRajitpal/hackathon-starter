import { TickerSearch } from "@/components/ticker-search";

export default function Home() {
  return (
    <main className="min-h-screen flex flex-col items-center gap-8 px-5 py-16">
      <h1 className="text-4xl font-bold text-center">ETHack</h1>
      <TickerSearch />
    </main>
  );
}
