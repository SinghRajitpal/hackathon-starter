import Link from "next/link";

export function TickerLink({ ticker }: { ticker: string }) {
  return (
    <Link href={`/?ticker=${encodeURIComponent(ticker)}`} className="font-mono text-xs font-bold hover:underline">
      {ticker}
    </Link>
  );
}
