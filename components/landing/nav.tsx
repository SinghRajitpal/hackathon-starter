"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

const NAV_LINKS = [
  { id: "how-it-works", label: "How it works" },
  { id: "the-scope", label: "The Scope" },
];

export function LandingNav() {
  const [active, setActive] = useState<string | null>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setActive(entry.target.id);
          }
        }
      },
      { rootMargin: "-45% 0px -45% 0px", threshold: 0 },
    );

    for (const { id } of NAV_LINKS) {
      const el = document.getElementById(id);
      if (el) observer.observe(el);
    }

    return () => observer.disconnect();
  }, []);

  return (
    <header className="fixed inset-x-0 top-0 z-50 border-b border-white/10 bg-[#0b0d22]/80 backdrop-blur">
      <div className="mx-auto flex h-20 max-w-6xl items-center justify-between px-6">
        <span className="text-2xl font-semibold tracking-tight text-white">
          meridian
        </span>
        <nav className="hidden items-center gap-8 text-sm text-slate-300 sm:flex">
          {NAV_LINKS.map(({ id, label }) => (
            <a
              key={id}
              href={`#${id}`}
              className={`inline-block origin-center transition-all duration-200 hover:scale-110 hover:text-white ${
                active === id ? "text-white" : ""
              }`}
            >
              {label}
            </a>
          ))}
        </nav>
        <Link
          href="/app"
          className="inline-block origin-center rounded-full bg-white px-6 py-2.5 text-base font-medium text-[#0b0d22] transition-transform duration-200 hover:scale-110"
        >
          Get started
        </Link>
      </div>
    </header>
  );
}
