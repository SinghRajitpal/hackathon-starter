import type { ReactNode } from "react";

import { TONE_CLASS } from "@/features/netzero/engine/dashboard/labels";
import type { Tile } from "@/features/netzero/engine/dashboard/types";

export function ScreenHeader({ title, subtitle, right }: { title: string; subtitle?: string; right?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-2 border-b pb-2">
      <div>
        <h2 className="text-lg font-semibold tracking-tight">{title}</h2>
        {subtitle && <p className="text-xs text-muted-foreground">{subtitle}</p>}
      </div>
      {right}
    </div>
  );
}

export function KpiTiles({ tiles }: { tiles: Tile[] }) {
  return (
    <dl className="grid grid-cols-2 gap-2 md:grid-cols-4 xl:grid-cols-5">
      {tiles.map((t) => (
        <div key={t.label} className="rounded-md border bg-card px-3 py-2">
          <dt className="text-[11px] uppercase tracking-wide text-muted-foreground">{t.label}</dt>
          <dd className={`font-mono text-xl font-semibold tabular-nums ${t.tone ? TONE_CLASS[t.tone] : ""}`}>{t.value}</dd>
          {t.sub && <dd className="text-[11px] text-muted-foreground">{t.sub}</dd>}
        </div>
      ))}
    </dl>
  );
}

export function Takeaways({ items }: { items: string[] }) {
  if (items.length === 0) return null;
  return (
    <section className="rounded-md border bg-muted/40 px-3 py-2">
      <h3 className="text-[11px] uppercase tracking-wide text-muted-foreground">Key takeaways</h3>
      <ul className="mt-1 flex flex-col gap-1 text-sm">
        {items.slice(0, 3).map((s) => (
          <li key={s}>{s}</li>
        ))}
      </ul>
    </section>
  );
}

export function Panel({ title, children, right }: { title: string; children: ReactNode; right?: ReactNode }) {
  return (
    <section className="rounded-md border bg-card">
      <div className="flex items-center justify-between border-b px-3 py-1.5">
        <h3 className="text-[11px] uppercase tracking-wide text-muted-foreground">{title}</h3>
        {right}
      </div>
      <div className="overflow-x-auto p-3">{children}</div>
    </section>
  );
}

export function Pill({ text, tone }: { text: string; tone: Tile["tone"] }) {
  return (
    <span className={`inline-block rounded border px-1.5 py-0.5 text-[11px] font-medium ${tone ? TONE_CLASS[tone] : ""}`}>
      {text}
    </span>
  );
}
