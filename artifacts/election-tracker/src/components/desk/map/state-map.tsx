import { useMemo, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";
import { fmtStampMT, str } from "@/lib/election";
import { Panel, PartyChip, SourceLink } from "@/components/desk/primitives";
import { STATE_SHAPES, BORDERS, VIEWBOX } from "./geometry";
import {
  MAP_VIEWS, PROJECTION_DISCLAIMER, MISS_LEGEND, EARLY_BASELINE_CAVEAT, DEFAULT_MISS_DEF, STATUS_LABEL,
  MARGIN_STEPS, MARGIN_CLIP, MISS_STEPS, MISS_CLIP, SCALE, NO_RACE_FILL, NO_DATA_FILL,
  buildStateData, emptyState, fillFor, fmtSigned, mapNotes, trackerView, collectLinks,
  type MapView, type StateDatum, type LinkView,
} from "@/lib/map-logic";

const SMALL = new Set(["RI", "DE", "CT", "NJ", "MD", "DC", "VT", "NH", "MA", "HI"]);

function Patterns() {
  const hatch = (id: string, rot: number, color: string, w = 1.6, gap = 6) => (
    <pattern id={id} patternUnits="userSpaceOnUse" width={gap} height={gap} patternTransform={`rotate(${rot})`}>
      <line x1="0" y1="0" x2="0" y2={gap} stroke={color} strokeWidth={w} />
    </pattern>
  );
  return (
    <defs>
      {hatch("pat-leadD", 45, "hsl(214 82% 30%)", 2)}
      {hatch("pat-leadR", -45, "hsl(12 84% 32%)", 2)}
      {hatch("pat-nodata", 45, "hsl(220 10% 58%)", 1.2, 5)}
      {hatch("pat-neutral", 90, "hsl(220 10% 55%)", 1.2, 5)}
      {hatch("pat-confMed", 45, "hsl(0 0% 100% / .55)", 1.4, 7)}
      <pattern id="pat-confLow" patternUnits="userSpaceOnUse" width="6" height="6">
        <path d="M0 0L6 6M6 0L0 6" stroke="hsl(0 0% 100% / .7)" strokeWidth="1.2" />
      </pattern>
      <pattern id="pat-dots" patternUnits="userSpaceOnUse" width="6" height="6">
        <circle cx="3" cy="3" r="1" fill="hsl(220 10% 50%)" />
      </pattern>
    </defs>
  );
}

function Swatch({ fill, pattern, opacity = 1, className }: { fill: string; pattern?: string | null; opacity?: number; className?: string }) {
  return (
    <svg viewBox="0 0 16 12" className={cn("h-3 w-4 shrink-0 rounded-[2px] border border-foreground/20", className)} aria-hidden>
      <rect width="16" height="12" fill={fill} fillOpacity={opacity} />
      {pattern && <rect width="16" height="12" fill={`url(#pat-${pattern})`} />}
    </svg>
  );
}

function LegendItem({ children, ...s }: { children: ReactNode; fill: string; pattern?: string | null; opacity?: number }) {
  return <li className="flex items-center gap-1.5"><Swatch {...s} /><span>{children}</span></li>;
}

function DivergingScale({ steps, clip, left, right, unit }: { steps: number[]; clip: number; left: string; right: string; unit: string }) {
  const labels = steps.map((b, i) => `${i === 0 ? "<" : `${steps[i - 1]}\u2013`}${b}`);
  return (
    <div className="space-y-1.5">
      <div className="grid grid-cols-9 overflow-hidden rounded-sm border border-foreground/20" aria-hidden>
        {[...SCALE.R].reverse().map((c, i) => <span key={`r${i}`} className="h-3" style={{ background: c }} />)}
        <span className="h-3" style={{ background: SCALE.even }} />
        {SCALE.D.map((c, i) => <span key={`d${i}`} className="h-3" style={{ background: c }} />)}
      </div>
      <div className="grid grid-cols-9 text-center font-mono text-[10px] text-muted-foreground tabnum" aria-hidden>
        {[...labels].reverse().map((l) => <span key={`rl${l}`}>R {l}</span>)}<span>0</span>{labels.map((l) => <span key={`dl${l}`}>D {l}</span>)}
      </div>
      <p className="flex justify-between gap-4 text-xs"><span>&larr; {left}</span><span className="text-right">{right} &rarr;</span></p>
      <p className="text-xs text-muted-foreground">Equal scale on both sides, in {unit}. Values above {clip} use the darkest step and are marked "beyond scale" in details.</p>
    </div>
  );
}

function Legend({ view }: { view: MapView }) {
  const base = (
    <>
      <LegendItem fill={NO_DATA_FILL} pattern="nodata">No data yet</LegendItem>
      <LegendItem fill={NO_RACE_FILL}>No tracked race</LegendItem>
    </>
  );
  return (
    <div className="space-y-2 text-xs" data-testid="map-legend">
      {view === "status" && (
        <ul className="flex flex-wrap gap-x-4 gap-y-1.5">
          <LegendItem fill={SCALE.D[3]}>Called D (solid)</LegendItem>
          <LegendItem fill={SCALE.R[3]}>Called R (solid)</LegendItem>
          <LegendItem fill={SCALE.D[1]} pattern="leadD">D leading, not called</LegendItem>
          <LegendItem fill={SCALE.R[1]} pattern="leadR">R leading, not called</LegendItem>
          <LegendItem fill="hsl(220 14% 97%)" pattern="dots">Not yet reporting</LegendItem>
          {base}
        </ul>
      )}
      {(view === "current" || view === "projected") && (
        <>
          {view === "projected" && <p className="font-semibold" data-testid="text-projection-disclaimer">{PROJECTION_DISCLAIMER}</p>}
          <DivergingScale steps={MARGIN_STEPS} clip={MARGIN_CLIP} unit="points of margin (D minus R)" left="Republican ahead" right="Democrat ahead" />
          <ul className="flex flex-wrap gap-x-4 gap-y-1.5">{base}</ul>
        </>
      )}
      {view === "miss" && (
        <>
          <p className="font-semibold" data-testid="text-miss-legend">{MISS_LEGEND}</p>
          <DivergingScale steps={MISS_STEPS} clip={MISS_CLIP} unit="points (result minus polling average)" left="Republican did better than polls" right="Democrat did better than polls" />
          <ul className="flex flex-wrap gap-x-4 gap-y-1.5"><LegendItem fill={SCALE.even}>Exactly matched polls (0.0)</LegendItem>{base}</ul>
        </>
      )}
      {view === "early" && (
        <ul className="flex flex-wrap gap-x-4 gap-y-1.5">
          <LegendItem fill={SCALE.D[2]}>Leans D, high</LegendItem>
          <LegendItem fill={SCALE.D[2]} opacity={0.7} pattern="confMed">Leans D, medium</LegendItem>
          <LegendItem fill={SCALE.D[2]} opacity={0.45} pattern="confLow">Leans D, low / unstated</LegendItem>
          <LegendItem fill="hsl(220 10% 92%)" pattern="neutral">Neutral</LegendItem>
          <LegendItem fill={SCALE.R[2]} opacity={0.45} pattern="confLow">Leans R, low / unstated</LegendItem>
          <LegendItem fill={SCALE.R[2]} opacity={0.7} pattern="confMed">Leans R, medium</LegendItem>
          <LegendItem fill={SCALE.R[2]}>Leans R, high</LegendItem>
          <LegendItem fill={NO_DATA_FILL} pattern="nodata">No data yet (early-vote signal)</LegendItem>
          <LegendItem fill={NO_RACE_FILL}>No tracked race</LegendItem>
        </ul>
      )}
      <ul className="flex flex-wrap gap-x-4 gap-y-1.5 border-t border-border pt-2">
        <li className="flex items-center gap-1.5"><svg viewBox="0 0 16 12" className="h-3 w-4" aria-hidden><rect x="1.5" y="1.5" width="13" height="9" fill="none" stroke="hsl(var(--foreground))" strokeWidth="3" /></svg>Key race (thick outline)</li>
        <li className="flex items-center gap-1.5"><svg viewBox="0 0 16 12" className="h-3 w-4" aria-hidden><rect x="1.5" y="1.5" width="13" height="9" fill="none" stroke="hsl(var(--foreground))" strokeWidth="1.5" strokeDasharray="3 2" /></svg>On watch (dashed outline)</li>
      </ul>
    </div>
  );
}

function Figures({ value, depth = 0 }: { value: unknown; depth?: number }): ReactNode {
  if (value === null || value === undefined) return <span className="text-muted-foreground">&ndash;</span>;
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") return <span className="tabnum font-mono">{String(value)}</span>;
  if (depth > 5) return <span className="text-muted-foreground">(nested)</span>;
  if (Array.isArray(value)) {
    if (!value.length) return <span className="text-muted-foreground">none</span>;
    return <ul className="list-disc space-y-0.5 pl-4">{value.map((v, i) => <li key={i}><Figures value={v} depth={depth + 1} /></li>)}</ul>;
  }
  const entries = Object.entries(value as Record<string, unknown>);
  if (!entries.length) return <span className="text-muted-foreground">none</span>;
  return (
    <dl className={cn("grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5", depth > 0 && "border-l border-border pl-2")}>
      {entries.map(([k, v]) => (
        <div key={k} className="contents">
          <dt className="text-muted-foreground">{k.replace(/_/g, " ")}</dt>
          <dd className="min-w-0 break-words"><Figures value={v} depth={depth + 1} /></dd>
        </div>
      ))}
    </dl>
  );
}

function Links({ title, links, id }: { title: string; links: LinkView[]; id: string }) {
  if (!links.length) return null;
  return (
    <div>
      <p className="eyebrow mb-1">{title}</p>
      <ul className="flex flex-wrap gap-x-3 gap-y-1">{links.map((l, i) => <li key={l.url}><SourceLink href={l.url} testId={`link-map-${id}-${i}`}>{l.label}</SourceLink></li>)}</ul>
    </div>
  );
}

function Row({ k, children, strong }: { k: string; children: ReactNode; strong?: boolean }) {
  return (
    <div className={cn("flex items-baseline justify-between gap-3 border-b border-dashed border-border py-1.5 last:border-0", strong && "bg-muted/60 -mx-2 px-2")}>
      <dt className="text-xs text-muted-foreground">{k}</dt>
      <dd className="text-right text-sm">{children}</dd>
    </div>
  );
}

const val = (v: number | null) => <span className="tabnum font-mono font-semibold">{v === null ? "No data yet" : fmtSigned(v)}</span>;

function Details({ d, view, pinned, onClose }: { d: StateDatum | null; view: MapView; pinned: boolean; onClose: () => void }) {
  if (!d) {
    return (
      <div className="grid h-full min-h-40 place-items-center rounded-md border border-dashed border-border p-4 text-center text-sm text-muted-foreground" data-testid="map-detail-empty">
        <p>Hover, tap, or choose a state to see reported results and estimates side by side.</p>
      </div>
    );
  }
  const spec = fillFor(d, view);
  const callNeedsCaveat = d.status === "called_unknown";
  return (
    <div className="space-y-3" data-testid={`map-detail-${d.abbr}`}>
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="eyebrow">{d.abbr}{d.key ? " · Key race" : ""}{d.watch ? " · Watch" : ""}</p>
          <h3 className="text-lg font-bold tracking-tight">{d.name}</h3>
          <p className="mt-0.5 flex items-center gap-1.5 text-xs"><Swatch fill={spec.fill} pattern={spec.pattern} opacity={spec.opacity} />{spec.label}</p>
        </div>
        {pinned && (
          <button type="button" onClick={onClose} aria-label="Close state details" data-testid="button-map-close"
            className="rounded-md border border-border p-1 hover:bg-muted focus-visible:outline-2 focus-visible:outline-ring"><X className="h-4 w-4" aria-hidden /></button>
        )}
      </div>
      {!d.hasRace ? (
        <p className="text-sm text-muted-foreground">No tracked race in this feed. Nothing is shown here by design.</p>
      ) : (
        <>
          {d.candidates.length > 0 && (
            <ul className="space-y-1 text-sm">{d.candidates.map((c) => <li key={c.name} className="flex items-center gap-2"><PartyChip party={c.party} />{c.name}</li>)}</ul>
          )}
          <section aria-label="Call" className="rounded-md border border-foreground/25 p-2.5">
            <p className="eyebrow">Reported: call</p>
            <p className="mt-0.5 text-sm font-semibold">{STATUS_LABEL[d.status]}</p>
            {(d.call.by || d.call.time || d.call.status) ? (
              <p className="text-sm">{d.call.status && <span className="capitalize">{d.call.status}</span>}{d.call.by && <> by <strong data-testid={`text-map-caller-${d.abbr}`}>{d.call.by}</strong></>}{d.call.time && <span className="tabnum font-mono text-muted-foreground"> · {d.call.time} MT</span>}</p>
            ) : (
              <p className="text-xs text-muted-foreground">No call source supplied.</p>
            )}
            {callNeedsCaveat && <p className="mt-1 text-xs text-muted-foreground">Marked called, but no winner was supplied. No winner is shown.</p>}
          </section>
          <dl>
            <Row k="Current margin (reported)" strong={view === "current"}>{val(d.current)}</Row>
            <Row k="Projected margin (estimate)" strong={view === "projected"}>{val(d.projected)}</Row>
            <Row k="Polling average" >{val(d.pollAvg)}</Row>
            <Row k="Polling miss" strong={view === "miss"}>
              {d.miss === null ? val(null) : <span className="tabnum font-mono font-semibold">{d.miss > 0 ? `+${d.miss.toFixed(1)} D beat polls` : d.miss < 0 ? `${d.miss.toFixed(1)} R beat polls` : "0.0 matched"}</span>}
            </Row>
            <Row k="Early-vote signal" strong={view === "early"}>
              {d.lean ? `${d.lean === "neutral" ? "Neutral" : `Leans ${d.lean}`} · ${d.conf ? `${d.conf} confidence` : "confidence not stated"}` : <span className="text-muted-foreground">{d.leanRaw ? `Unrecognized: ${d.leanRaw}` : "No signal"}</span>}
            </Row>
          </dl>
          {view === "projected" && <p className="text-xs font-semibold">{PROJECTION_DISCLAIMER}</p>}
          {(view === "miss" || d.miss !== null) && (
            <p className="text-xs text-muted-foreground">{d.missDef ?? DEFAULT_MISS_DEF}{d.missComputed && " Computed here from current margin and polling average."}</p>
          )}
          {d.early && (view === "early" || d.early.figures !== undefined) && (
            <section aria-label="Early-vote figures" className="space-y-1.5 text-xs">
              <p className="eyebrow">Early vote{d.early.asOf ? ` · as of ${d.early.asOf} MT` : ""}</p>
              {d.early.basis && <p><span className="text-muted-foreground">Basis: </span>{d.early.basis}</p>}
              {d.early.figures !== undefined && <Figures value={d.early.figures} />}
            </section>
          )}
          <div className="space-y-2">
            <Links title="Call sources" links={d.links.call} id={`${d.abbr}-call`} />
            <Links title="Race sources" links={d.links.race} id={`${d.abbr}-race`} />
            <Links title="Polling sources" links={d.links.polls} id={`${d.abbr}-polls`} />
            <Links title="Early-vote sources" links={d.links.early} id={`${d.abbr}-early`} />
          </div>
        </>
      )}
    </div>
  );
}

export function StateMap({ races, earlyVote, notes }: { races: unknown; earlyVote: unknown; notes: unknown }) {
  const [view, setView] = useState<MapView>("status");
  const [hover, setHover] = useState<string | null>(null);
  const [pinned, setPinned] = useState<string | null>(null);
  const radios = useRef<(HTMLButtonElement | null)[]>([]);
  const data = useMemo(() => buildStateData(races, earlyVote), [races, earlyVote]);
  const get = (a: string) => data.get(a) ?? emptyState(a);
  const activeAbbr = pinned ?? hover;
  const active = activeAbbr ? get(activeAbbr) : null;
  const ev = (earlyVote && typeof earlyVote === "object" ? earlyVote : {}) as Record<string, unknown>;
  const tracker = trackerView(ev.tracker);
  const trackerLinks = collectLinks(ev.tracker, (ev.tracker as Record<string, unknown> | null)?.sources);
  const caveats = (Array.isArray(ev.general_caveats) ? ev.general_caveats : []).map(str).filter((s): s is string => !!s);
  const notesList = mapNotes(notes);
  const outlined = STATE_SHAPES.filter((s) => data.get(s.abbr)?.key || data.get(s.abbr)?.watch);

  const onRadioKey = (e: KeyboardEvent, i: number) => {
    const n = MAP_VIEWS.length;
    const next = e.key === "ArrowRight" || e.key === "ArrowDown" ? (i + 1) % n : e.key === "ArrowLeft" || e.key === "ArrowUp" ? (i - 1 + n) % n : e.key === "Home" ? 0 : e.key === "End" ? n - 1 : -1;
    if (next < 0) return;
    e.preventDefault();
    setView(MAP_VIEWS[next].id);
    radios.current[next]?.focus();
  };
  const onStateKey = (e: KeyboardEvent, abbr: string) => {
    if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setPinned((p) => (p === abbr ? null : abbr)); }
    if (e.key === "Escape") { setPinned(null); setHover(null); }
  };

  return (
    <Panel id="map" kicker="Senate · by state" title="State map" className="mb-5"
      aside={<span className="font-mono text-[11px] text-muted-foreground">Reported results vs. independent estimates</span>}>
      <div onKeyDown={(e) => { if (e.key === "Escape") { setPinned(null); setHover(null); } }}>
        <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div role="radiogroup" aria-label="Map view" className="grid grid-cols-2 gap-1 rounded-lg border border-border bg-muted/50 p-1 sm:inline-flex sm:flex-wrap">
            {MAP_VIEWS.map((v, i) => {
              const on = v.id === view;
              return (
                <button key={v.id} ref={(el) => { radios.current[i] = el; }} type="button" role="radio" aria-checked={on} tabIndex={on ? 0 : -1}
                  onClick={() => setView(v.id)} onKeyDown={(e) => onRadioKey(e, i)} data-testid={`radio-map-view-${v.id}`}
                  className={cn("min-h-9 rounded-md px-3 py-1.5 text-xs font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-ring",
                    on ? "bg-foreground text-background" : "text-muted-foreground hover:bg-card hover:text-foreground", i === 4 && "col-span-2 sm:col-span-1")}>
                  {v.label}
                </button>
              );
            })}
          </div>
          <label className="flex items-center gap-2 text-xs">
            <span className="eyebrow">State</span>
            <select value={pinned ?? ""} onChange={(e) => setPinned(e.target.value || null)} data-testid="select-map-state"
              className="min-h-9 flex-1 rounded-md border border-input bg-card px-2 py-1.5 text-sm focus-visible:outline-2 focus-visible:outline-ring md:w-56">
              <option value="">Choose a state...</option>
              {STATE_SHAPES.map((s) => { const d = get(s.abbr); return <option key={s.abbr} value={s.abbr}>{d.name}{s.abbr === "DC" ? " (district)" : ""}{d.hasRace ? "" : " - no tracked race"}</option>; })}
            </select>
          </label>
        </div>

        <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_19rem]">
          <figure className="min-w-0">
            <svg viewBox={VIEWBOX} className="h-auto w-full" role="group" aria-label={`US state map, ${MAP_VIEWS.find((v) => v.id === view)!.label} view`} data-testid="svg-state-map">
              <Patterns />
              <g>
                {STATE_SHAPES.map((s) => {
                  const d = get(s.abbr);
                  const f = fillFor(d, view);
                  const sel = activeAbbr === s.abbr;
                  return (
                    <g key={s.abbr} role="button" tabIndex={0} aria-pressed={pinned === s.abbr}
                      aria-label={`${d.name}: ${f.label}${d.key ? ", key race" : ""}${d.watch ? ", on watch" : ""}`}
                      data-testid={`map-state-${s.abbr}`}
                      className="map-state cursor-pointer outline-none"
                      onMouseEnter={() => setHover(s.abbr)} onFocus={() => setHover(s.abbr)}
                      onClick={() => setPinned((p) => (p === s.abbr ? null : s.abbr))} onKeyDown={(e) => onStateKey(e, s.abbr)}>
                      <path d={s.d} fill="hsl(var(--card))" />
                      <path d={s.d} fill={f.fill} fillOpacity={f.opacity} />
                      {f.pattern && <path d={s.d} fill={`url(#pat-${f.pattern})`} />}
                      <path d={s.d} fill="none" className="map-focus" stroke="hsl(var(--foreground))" strokeWidth={sel ? 2.5 : 0} />
                    </g>
                  );
                })}
              </g>
              <path d={BORDERS} fill="none" stroke="hsl(var(--card))" strokeWidth={0.9} strokeLinejoin="round" pointerEvents="none" />
              <g pointerEvents="none">
                {outlined.map((s) => {
                  const d = data.get(s.abbr)!;
                  return (
                    <g key={`o-${s.abbr}`}>
                      {d.key && <path d={s.d} fill="none" stroke="hsl(var(--foreground))" strokeWidth={3.5} strokeLinejoin="round" />}
                      {d.watch && <path d={s.d} fill="none" stroke={d.key ? "hsl(var(--card))" : "hsl(var(--foreground))"} strokeWidth={d.key ? 1.4 : 2} strokeDasharray="5 3.5" strokeLinejoin="round" />}
                    </g>
                  );
                })}
                {STATE_SHAPES.filter((s) => !SMALL.has(s.abbr) && s.area > 900).map((s) => {
                  const d = data.get(s.abbr);
                  if (!d) return null;
                  const f = fillFor(d, view);
                  const dark = /(36%|38%|52%)\)$/.test(f.fill) && f.opacity > 0.6;
                  return (
                    <text key={`t-${s.abbr}`} x={s.cx} y={s.cy} textAnchor="middle" dominantBaseline="central"
                      className="font-mono text-[13px] font-bold" fill={dark ? "hsl(var(--card))" : "hsl(var(--foreground))"}
                      stroke={dark ? "none" : "hsl(var(--card))"} strokeWidth={3} paintOrder="stroke">{s.abbr}</text>
                  );
                })}
              </g>
            </svg>
            <figcaption className="mt-1 text-[11px] text-muted-foreground">Small states and DC are easiest to reach with the state selector. Insets: Alaska and Hawaii not to scale.</figcaption>
          </figure>

          <aside aria-live="polite" aria-label="State details" className="rounded-lg border border-border bg-background/60 p-3 lg:sticky lg:top-4 lg:self-start" data-testid="map-detail">
            <Details d={active} view={view} pinned={!!pinned} onClose={() => { setPinned(null); setHover(null); }} />
          </aside>
        </div>

        <div className="mt-4 rounded-md border border-border p-3"><Legend view={view} /></div>

        {view === "early" && (
          <section aria-label="Early-vote caveats" className="mt-3 space-y-2 rounded-md border border-foreground/30 bg-muted/40 p-3 text-xs" data-testid="map-early-caveats">
            <p className="font-semibold">{EARLY_BASELINE_CAVEAT}</p>
            {caveats.length > 0 && <ul className="list-disc space-y-1 pl-4">{caveats.map((c, i) => <li key={i}>{c}</li>)}</ul>}
            <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-muted-foreground">
              {tracker.label && <span>Tracker: {tracker.label}</span>}
              {ev.compiled_mt != null && str(ev.compiled_mt) && <span className="tabnum font-mono">Compiled {fmtStampMT(ev.compiled_mt) ?? str(ev.compiled_mt)}{/MT$/.test(fmtStampMT(ev.compiled_mt) ?? "") ? "" : " MT"}</span>}
              {trackerLinks.map((l, i) => <SourceLink key={l.url} href={l.url} testId={`link-early-tracker-${i}`}>{l.label}</SourceLink>)}
            </p>
          </section>
        )}

        {notesList.length > 0 && (
          <ul className="mt-3 space-y-1 text-xs text-muted-foreground" data-testid="map-notes">
            {notesList.map((n, i) => <li key={i} className="border-l-2 border-border pl-2">{n}</li>)}
          </ul>
        )}
        <p className="mt-3 text-[10px] text-muted-foreground">Boundaries: U.S. Census Bureau cartographic boundary data (public domain) via us-atlas (ISC). Bundled locally.</p>
      </div>
    </Panel>
  );
}
