"use client";

import { Search } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Suspense } from "react";

const LINKS = [
  { href: "/dashboard", label: "Search", icon: Search },
  { href: "/market", label: "Market Overview" },
  { href: "/tickers", label: "Tickers Overview" },
  { href: "/portfolio", label: "Best Portfolio Net Zero Scenario" },
];

export function AppHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-white/10 bg-background/80 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-7xl items-center gap-4 px-4">
        <Link href="/" className="shrink-0 text-2xl font-semibold tracking-tight text-white">
          meridian
        </Link>
        {/* usePathname is runtime data on dynamic routes, so the active state streams in. */}
        <Suspense fallback={<NavLinks pathname={null} />}>
          <ActiveNavLinks />
        </Suspense>
      </div>
    </header>
  );
}

function ActiveNavLinks() {
  return <NavLinks pathname={usePathname()} />;
}

function NavLinks({ pathname }: { pathname: string | null }) {
  return (
    // ml-auto instead of justify-end: an overflowing justify-end row clips its first link out of scroll reach on phones.
    <nav aria-label="Main" className="ml-auto flex min-w-0 items-center gap-1 overflow-x-auto sm:gap-2">
      {LINKS.map(({ href, label, icon: Icon }) => {
        const active = pathname !== null && (pathname === href || pathname.startsWith(`${href}/`));
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? "page" : undefined}
            className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-4 py-2 text-sm font-medium transition-colors ${
              active ? "bg-primary text-primary-foreground" : "text-slate-300 hover:bg-white/10 hover:text-white"
            }`}
          >
            {Icon && <Icon aria-hidden className="size-4" />}
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
