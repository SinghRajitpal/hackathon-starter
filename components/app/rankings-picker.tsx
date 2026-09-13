"use client";

import { useRouter } from "next/navigation";
import { useRef } from "react";

import type { RankingView } from "@/lib/tickers";

const OPTIONS: { view: RankingView; title: string; description: string }[] = [
  {
    view: "sustainability",
    title: "Current sustainability ranking",
    description: "Every S&P 500 company scored 0–100 against today's sustainability ideal.",
  },
  {
    view: "netzero",
    title: "Net-zero scenario ranking",
    description: "Who wins and who loses inside each sector the day the world commits to net zero.",
  },
  {
    view: "both",
    title: "Side by side",
    description: "Both rankings in two panes that scroll on their own.",
  },
];

export function RankingsPicker() {
  const router = useRouter();
  const dialogRef = useRef<HTMLDialogElement>(null);

  function choose(view: RankingView) {
    dialogRef.current?.close();
    router.replace(`/tickers?ranking=${view}`, { scroll: false });
  }

  return (
    <>
      <button
        type="button"
        onClick={() => dialogRef.current?.showModal()}
        className="w-full rounded-lg bg-primary px-6 py-6 text-xl font-semibold text-primary-foreground transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
      >
        See Rankings
      </button>
      <dialog
        ref={dialogRef}
        aria-labelledby="rankings-title"
        className="m-auto w-[min(32rem,calc(100vw-2rem))] rounded-xl border bg-popover p-0 text-popover-foreground shadow-xl backdrop:bg-black/50"
      >
        <div className="flex flex-col gap-4 p-6">
          <div className="flex items-center justify-between gap-4">
            <h2 id="rankings-title" className="text-lg font-semibold">
              Choose a ranking
            </h2>
            <button
              type="button"
              aria-label="Close"
              onClick={() => dialogRef.current?.close()}
              className="rounded-md px-2 py-1 text-muted-foreground hover:bg-accent hover:text-foreground"
            >
              ✕
            </button>
          </div>
          <ul className="flex flex-col gap-2">
            {OPTIONS.map((o) => (
              <li key={o.view}>
                <button
                  type="button"
                  onClick={() => choose(o.view)}
                  className="w-full rounded-lg border p-4 text-left transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <span className="block font-medium">{o.title}</span>
                  <span className="mt-1 block text-sm text-muted-foreground">{o.description}</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      </dialog>
    </>
  );
}
