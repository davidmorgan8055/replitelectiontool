import { seatCounts } from "@/lib/election";
import { Panel, SourceLink } from "./primitives";
import { SeatBar } from "./seat-bar";

export function SenatePanel({ data }: { data: unknown }) {
  const s = seatCounts(data);
  return (
    <Panel id="senate" kicker="100 seats" title="U.S. Senate"
      aside={s.sourceUrl ? <SourceLink href={s.sourceUrl} testId="link-senate-source">{s.sourceLabel ?? "Source"}</SourceLink> : null}>
      <SeatBar total={100} dem={s.dem} rep={s.rep} threshold={50} thresholdLabel="50 + VP tiebreak" label="Senate called seats" testId="bar-senate" />
      <div className="mt-4 grid gap-3 border-t border-dashed border-border pt-4 text-sm sm:grid-cols-[auto_1fr] sm:gap-6">
        <div>
          <p className="eyebrow mb-1">Current baseline (held, not called)</p>
          <p className="tabnum font-mono text-sm" data-testid="text-senate-baseline">
            <span className="text-[hsl(var(--rep))] font-semibold">R 53</span>
            <span className="text-muted-foreground"> · </span>
            <span className="text-[hsl(var(--dem))] font-semibold">D 45</span>
            <span className="text-muted-foreground"> + 2 independents caucusing D</span>
          </p>
        </div>
        <p className="text-muted-foreground leading-relaxed">
          Republicans hold 53 seats. Democrats need a net gain of 4 for control; at 50 seats the Vice President breaks ties, so 51 votes for Democrats in practice. Counts above reflect only races called by AP or a network decision desk.
        </p>
      </div>
    </Panel>
  );
}

export function HousePanel({ data }: { data: unknown }) {
  const h = seatCounts(data);
  return (
    <Panel id="house" kicker="435 seats" title="U.S. House"
      aside={h.sourceUrl ? <SourceLink href={h.sourceUrl} testId="link-house-source">{h.sourceLabel ?? "Source"}</SourceLink> : null}>
      <SeatBar total={435} dem={h.dem} rep={h.rep} threshold={218} thresholdLabel="218 for majority" label="House called seats" testId="bar-house" />
      <p className="mt-4 border-t border-dashed border-border pt-4 text-sm text-muted-foreground">
        218 seats needed for a majority. Counts reflect called races only.
      </p>
    </Panel>
  );
}
