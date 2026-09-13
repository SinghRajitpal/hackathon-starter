import type { ReactNode } from "react";

/**
 * Two side-by-side panes that each scroll on their own. The container takes a
 * fixed height from `className` and never scrolls itself. Stacks on phones.
 */
export function SplitPanes({
  left,
  right,
  leftLabel,
  rightLabel,
  className = "",
}: {
  left: ReactNode;
  right: ReactNode;
  leftLabel: string;
  rightLabel: string;
  className?: string;
}) {
  return (
    <div className={`grid min-h-0 grid-cols-1 grid-rows-2 gap-4 md:grid-cols-2 md:grid-rows-1 ${className}`}>
      <Pane label={leftLabel}>{left}</Pane>
      <Pane label={rightLabel}>{right}</Pane>
    </div>
  );
}

function Pane({ label, children }: { label: string; children: ReactNode }) {
  return (
    <section aria-label={label} className="flex min-h-0 min-w-0 flex-col overflow-hidden rounded-lg border bg-card">
      <h2 className="shrink-0 border-b px-4 py-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </h2>
      <div className="min-h-0 flex-1 overflow-y-auto p-3">{children}</div>
    </section>
  );
}
