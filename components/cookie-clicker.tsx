"use client";

import { useState } from "react";

export function CookieClicker() {
  const [count, setCount] = useState(0);

  return (
    <section className="flex flex-col items-center gap-4 mt-12">
      <p className="text-2xl font-semibold tabular-nums" aria-live="polite">
        Cookies: {count}
      </p>
      <button
        type="button"
        aria-label="Cookie"
        onClick={() => setCount((c) => c + 1)}
        className="h-40 w-40 rounded-full bg-white border border-foreground/20 shadow-lg hover:scale-105 active:scale-95 transition"
      />
      <p className="text-sm text-foreground/60">Click the cookie</p>
    </section>
  );
}
