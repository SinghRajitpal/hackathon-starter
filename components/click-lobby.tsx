"use client";

import { useState } from "react";

const CLICKS_REQUIRED = 10;

export function ClickLobby({ children }: { children: React.ReactNode }) {
  const [clicks, setClicks] = useState(0);

  if (clicks >= CLICKS_REQUIRED) {
    return <>{children}</>;
  }

  return (
    <main className="min-h-screen flex flex-col items-center justify-center gap-6 text-center px-4">
      <h1 className="text-3xl font-semibold">Waiting lobby</h1>
      <p className="text-foreground/70">
        Click the button {CLICKS_REQUIRED} times to enter the site.
      </p>
      <button
        type="button"
        onClick={() => setClicks((c) => c + 1)}
        className="rounded-md bg-foreground text-background px-6 py-3 text-lg font-medium hover:opacity-90 active:scale-95 transition"
      >
        Click to enter ({clicks}/{CLICKS_REQUIRED})
      </button>
    </main>
  );
}
