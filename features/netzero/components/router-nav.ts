"use client";

import { useRouter } from "next/navigation";
import { useMemo } from "react";

import type { Nav } from "@/features/netzero/engine/dashboard/types";
import { sectorAnchor } from "@/features/netzero/ranking";

/** Tool 2's in-screen navigation, mapped onto the unified app's routes. */
export function useRouterNav(): Nav {
  const router = useRouter();
  return useMemo(
    () => ({
      openView: (view) => {
        if (view === "portfolio") router.push("/portfolio");
        else if (view === "market") router.push("/market");
        else router.push("/tickers?ranking=netzero");
      },
      openSector: (sector) => router.push(`/tickers?ranking=netzero#${sectorAnchor(sector)}`),
      openCompany: (ticker) => router.push(`/ticker/${encodeURIComponent(ticker)}`),
    }),
    [router],
  );
}
