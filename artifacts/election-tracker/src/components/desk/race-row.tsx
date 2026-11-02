import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import type { HistMargin, RaceView } from "@/lib/election";
import { Margin, PartyChip, SourceLink, partyText } from "./primitives";

function Hist({ year, h }: { year: string; h: HistMargin }) {
  return (
    <li className="flex items-baseline justify-between gap-3">
      <span className="text-muted-foreground">{year}{h.label ? ` \u00b7 ${h.label}` : ""}</span>
      <Margin value={h.value} />
    </li>
  );
}

function CallCell({ race }: { race: RaceView }) {
  const { status, by, time, party } = race.call;
  if (!status) return <span className="text-xs text-muted-foreground">Not called</span>;
  return (
    <div className="text-xs leading-snug" data-testid={`status-call-${race.state}`}>
      <span className={cn("font-semibold uppercase tracking-wide", party ? partyText[party] : "text-foreground")}>{status}</span>
      {(by || time) && <div className="text-muted-foreground">{by && `by ${by}`}{by && time ? " \u00b7 " : ""}{time && `${time} MT`}</div>}
    </div>
  );
}

export function RaceRow({ race }: { race: RaceView }) {
  const [open, setOpen] = useState(false);
  const hasLive = race.current !== null || race.pctIn !== null;
  const panelId = `race-detail-${race.state}`;
  return (
    <li className="border-b border-border last:border-b-0" data-testid={`row-race-${race.state}`}>
      <div className="grid grid-cols-[3.25rem_1fr_auto] items-start gap-x-3 gap-y-2 px-4 py-3 sm:px-5 lg:grid-cols-[3.25rem_minmax(10rem,1.4fr)_minmax(8rem,1fr)_minmax(9rem,1.1fr)_minmax(7rem,.8fr)_2rem]">
        <div>
          <p className="font-mono text-lg font-bold leading-none">{race.state}</p>
          {race.watch && <p className="mt-1 eyebrow !text-[9px]">Watch</p>}
        </div>

        <div className="min-w-0 text-sm">
          {race.candidates.length ? (
            <ul className="space-y-0.5">
              {race.candidates.map((c, i) => (
                <li key={i} className="flex items-center gap-1.5 truncate"><PartyChip party={c.party} /><span className="truncate">{c.name}</span></li>
              ))}
            </ul>
          ) : <span className="text-muted-foreground">Candidates not posted</span>}
          {race.pollClose && <p className="mt-1 text-xs text-muted-foreground">Polls close {race.pollClose} MT</p>}
        </div>

        <button type="button" onClick={() => setOpen(!open)} aria-expanded={open} aria-controls={panelId} data-testid={`button-expand-${race.state}`}
          className="col-start-3 row-start-1 grid h-8 w-8 place-items-center rounded-md border border-border text-muted-foreground transition hover:bg-muted hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring lg:col-start-6"
          aria-label={`${open ? "Hide" : "Show"} polling sources and history for ${race.state}`}>
          <ChevronDown className={cn("h-4 w-4 transition-transform duration-200", open && "rotate-180")} aria-hidden />
        </button>

        <div className="col-span-3 lg:col-span-1 lg:col-start-3 lg:row-start-1">
          <p className="eyebrow lg:hidden">Current</p>
          {hasLive ? (
            <div className="flex items-baseline gap-2">
              <Margin value={race.current} className="text-base" testId={`text-margin-${race.state}`} />
              <span className="tabnum font-mono text-xs text-muted-foreground">{race.pctIn !== null ? `${race.pctIn}% in` : "\u2013 in"}</span>
            </div>
          ) : <p className="text-xs text-muted-foreground">Results begin after polls close</p>}
        </div>

        <div className="col-span-3 lg:col-span-1 lg:col-start-4 lg:row-start-1">
          <p className="eyebrow">Independent model projection, not a call</p>
          <div className="flex items-baseline gap-2">
            <Margin value={race.projected} testId={`text-projection-${race.state}`} />
            {race.confidence && <span className="text-xs text-muted-foreground">confidence {race.confidence}</span>}
          </div>
        </div>

        <div className="col-span-3 lg:col-span-1 lg:col-start-5 lg:row-start-1">
          <p className="eyebrow lg:hidden">Call</p>
          <CallCell race={race} />
        </div>
      </div>

      {open && (
        <div id={panelId} className="grid gap-4 bg-muted/50 px-4 py-4 text-sm sm:grid-cols-2 sm:px-5 lg:pl-[5.5rem] animate-in fade-in slide-in-from-top-1 duration-200">
          <div>
            <p className="eyebrow mb-1">Polling average</p>
            <Margin value={race.pollingAvg} />
            {race.pollSources.length ? (
              <ul className="mt-2 space-y-1">
                {race.pollSources.map((s, i) => (
                  <li key={i}>{s.url ? <SourceLink href={s.url} testId={`link-poll-${race.state}-${i}`}>{s.label}</SourceLink> : <span className="text-xs text-muted-foreground">{s.label}</span>}</li>
                ))}
              </ul>
            ) : <p className="mt-1 text-xs text-muted-foreground">No polling inputs posted.</p>}
          </div>
          <div>
            <p className="eyebrow mb-1">Historical margins</p>
            <ul className="space-y-1 text-xs">
              <Hist year="2022" h={race.m2022} />
              <Hist year="2024" h={race.m2024} />
            </ul>
          </div>
        </div>
      )}
    </li>
  );
}
