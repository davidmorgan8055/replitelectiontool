interface Props {
  total: number;
  dem: number | null;
  rep: number | null;
  threshold: number;
  thresholdLabel: string;
  label: string;
  testId: string;
}

/** Called-seat bar: D from left, uncalled middle, R from right. Equal treatment. */
export function SeatBar({ total, dem, rep, threshold, thresholdLabel, label, testId }: Props) {
  const d = Math.max(0, Math.min(total, dem ?? 0));
  const r = Math.max(0, Math.min(total - d, rep ?? 0));
  const u = total - d - r;
  const pct = (n: number) => `${(n / total) * 100}%`;
  return (
    <div data-testid={testId}>
      <div className="mb-2 flex items-end justify-between gap-3">
        <div>
          <p className="eyebrow">Democrats called</p>
          <p className="tabnum font-mono text-3xl font-bold text-[hsl(var(--dem))] sm:text-4xl" data-testid={`${testId}-dem`}>{dem ?? "\u2013"}</p>
        </div>
        <div className="text-center">
          <p className="eyebrow">Not yet called</p>
          <p className="tabnum font-mono text-xl font-semibold text-muted-foreground" data-testid={`${testId}-undecided`}>{dem === null && rep === null ? "\u2013" : u}</p>
        </div>
        <div className="text-right">
          <p className="eyebrow">Republicans called</p>
          <p className="tabnum font-mono text-3xl font-bold text-[hsl(var(--rep))] sm:text-4xl" data-testid={`${testId}-rep`}>{rep ?? "\u2013"}</p>
        </div>
      </div>
      <div className="relative" role="img" aria-label={`${label}: Democrats ${dem ?? "none"} called, Republicans ${rep ?? "none"} called, ${u} not yet called, of ${total}. ${thresholdLabel}.`}>
        <div className="flex h-7 overflow-hidden rounded-[4px] bg-[hsl(var(--undecided))]">
          <div className="h-full bg-[hsl(var(--dem))] transition-[width] duration-700 ease-out" style={{ width: pct(d) }} />
          <div className="h-full flex-1" />
          <div className="h-full bg-[hsl(var(--rep))] transition-[width] duration-700 ease-out" style={{ width: pct(r) }} />
        </div>
        <div className="pointer-events-none absolute -top-1 -bottom-1 w-px bg-foreground" style={{ left: pct(threshold) }} aria-hidden />
      </div>
      <div className="relative mt-1 h-4 text-[11px] text-muted-foreground" aria-hidden>
        <span className="absolute -translate-x-1/2 whitespace-nowrap font-mono" style={{ left: pct(threshold) }}>{thresholdLabel}</span>
      </div>
    </div>
  );
}
