"use client";

import { Button } from "@/components/ui/button";
import { toCsv, type AllocationRow } from "@/lib/netzero/allocation";
import type { Mandate } from "@/lib/netzero/types";

export function CsvButton({ rows, mandate }: { rows: AllocationRow[]; mandate: Mandate }) {
  const download = () => {
    const blob = new Blob([toCsv(rows)], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `nz-portfolio-${mandate}.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  };
  return (
    <Button variant="outline" size="sm" onClick={download} disabled={rows.length === 0}>
      Download CSV ({rows.length} rows)
    </Button>
  );
}
