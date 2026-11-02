import { buildClosings, type FeedView } from "@/lib/election";
import { Panel, SourceLink } from "./primitives";

export function PollClosings({ data }: { data: unknown }) {
  const { rows, sourceUrl } = buildClosings(data);
  return (
    <Panel id="closings" kicker="Mountain Time" title="Poll closings"
      aside={sourceUrl ? <SourceLink href={sourceUrl} testId="link-closings-source">Source</SourceLink> : null}>
      {rows.length ? (
        <ol className="relative space-y-3 border-l border-border pl-4">
          {rows.map((r) => (
            <li key={r.time} className="relative" data-testid={`row-closing-${r.time}`}>
              <span className="absolute -left-[21px] top-1.5 h-2 w-2 rounded-full border border-foreground bg-card" aria-hidden />
              <p className="tabnum font-mono text-sm font-semibold">{r.time} MT</p>
              <p className="text-sm text-muted-foreground">{r.states.length ? r.states.join(", ") : "\u2013"}</p>
            </li>
          ))}
        </ol>
      ) : <p className="text-sm text-muted-foreground">Schedule not yet posted.</p>}
    </Panel>
  );
}

export function Feed({ id, title, items, empty }: { id: string; title: string; items: FeedView[]; empty: string }) {
  return (
    <Panel id={id} title={title} kicker={`${items.length} ${items.length === 1 ? "entry" : "entries"}`}>
      {items.length ? (
        <ul className="divide-y divide-border" aria-live="polite">
          {items.map((it, i) => (
            <li key={i} className="grid grid-cols-[4.5rem_1fr] gap-3 py-2.5 first:pt-0 last:pb-0 text-sm" data-testid={`row-${id}-${i}`}>
              <span className="tabnum font-mono text-xs text-muted-foreground pt-0.5">{it.time ? `${it.time} MT` : "\u2013"}</span>
              <div className="min-w-0">
                <p className="break-words leading-snug">{it.text}</p>
                {it.url && <SourceLink href={it.url} testId={`link-${id}-${i}`}>Source</SourceLink>}
              </div>
            </li>
          ))}
        </ul>
      ) : <p className="text-sm text-muted-foreground" data-testid={`empty-${id}`}>{empty}</p>}
    </Panel>
  );
}

export function Methodology({ notes }: { notes: string[] }) {
  return (
    <footer className="mt-10 border-t border-border pt-6 text-sm text-muted-foreground" id="methodology">
      <h2 className="mb-3 text-base font-semibold text-foreground">Methodology</h2>
      <ul className="grid gap-2 sm:grid-cols-2 leading-relaxed">
        <li>A race is shown as called only when the AP or a network decision desk has made a call. Leads and models never count as calls.</li>
        <li>Model projections are an independent estimate with a stated confidence. They are not calls.</li>
        <li>Prediction-market figures, if shown, are trader odds, not probabilities endorsed here.</li>
        <li>Margins are Democrat minus Republican, shown as D+ or R+. A dash means no data. All times are Mountain Time (MT).</li>
      </ul>
      {notes.length > 0 && (
        <div className="mt-5">
          <p className="eyebrow mb-2">Notes</p>
          <ul className="list-disc space-y-1 pl-5">{notes.map((n, i) => <li key={i} data-testid={`text-note-${i}`}>{n}</li>)}</ul>
        </div>
      )}
      <div className="mt-6 flex flex-wrap items-center justify-between gap-3 text-xs">
        <p>Nonpartisan. No cookies, tracking, ads or data collection.</p>
        <a href="https://github.com/davidmorgan8055/election-night-2026-data" target="_blank" rel="noopener noreferrer" data-testid="link-github"
          className="underline underline-offset-2 hover:text-foreground">Data history on GitHub</a>
      </div>
    </footer>
  );
}
