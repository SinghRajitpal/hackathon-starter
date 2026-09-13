"use client";

import { useRouter } from "next/navigation";
import { useMemo } from "react";

import type { Nav } from "@/features/netzero/engine/dashboard/types";

/** Tool 2's in-screen navigation, mapped onto the unified app's routes. */
export function useRouterNav(): Nav {
  const router = useRouter();
  return useMemo(
    () => ({
      openView: (view) => {
        if (view === "portfolio") router.push("/portfolio");
        else if (view === "company") router.push("/dashboard");
        else router.push("/market");
      },
      openSector: (sector) => router.push(`/market/${encodeURIComponent(sector)}`),
      openCompany: (ticker) => router.push(`/ticker/${encodeURIComponent(ticker)}`),
    }),
    [router],
  );
}
