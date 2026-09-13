export function Bar({ label, value, max = 1, text }: { label: string; value: number; max?: number; text: string }) {
  const width = max > 0 ? Math.max(0, Math.min(1, value / max)) * 100 : 0;
  return (
    <div className="grid grid-cols-[10rem_1fr_4.5rem] items-center gap-2 text-xs">
      <span className="text-muted-foreground">{label}</span>
      <div className="h-2 rounded bg-muted">
        <div className="h-2 rounded bg-primary" style={{ width: `${width}%` }} />
      </div>
      <span className="text-right tabular-nums">{text}</span>
    </div>
  );
}
