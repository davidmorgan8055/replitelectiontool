import { useMemo } from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";
import { useGetElectionData, getGetElectionDataQueryKey } from "@workspace/api-client-react";
import { buildFeed, buildRaces, fmtClockMT, fmtStampMT, rec } from "@/lib/election";
import { SenatePanel, HousePanel } from "@/components/desk/chambers";
import { RaceRow } from "@/components/desk/race-row";
import { Feed, Methodology, PollClosings } from "@/components/desk/side-panels";
import { Panel } from "@/components/desk/primitives";
import { StateMap } from "@/components/desk/map/state-map";

export default function Home() {
  const q = useGetElectionData({
    query: {
      queryKey: getGetElectionDataQueryKey(),
      refetchInterval: 60000,
      refetchIntervalInBackground: true,
      placeholderData: (prev) => prev,
    },
    request: { cache: "no-store", credentials: "omit" },
  });
  const data = q.data;
  const st = rec(data?.seat_tracker);
  const races = useMemo(() => buildRaces(data?.races), [data]);
  const alerts = useMemo(() => buildFeed(data?.alerts), [data]);
  const calls = useMemo(() => buildFeed(data?.calls_log), [data]);
  const notes = (Array.isArray(data?.notes) ? data!.notes : []).filter((n): n is string => typeof n === "string" && n.trim() !== "");
  const updated = fmtStampMT(data?.updated_at);
  const checked = data && q.dataUpdatedAt ? fmtClockMT(q.dataUpdatedAt) : "\u2013";

  return (
    <div className="min-h-[100dvh]">
      <a href="#races" className="sr-only focus:not-sr-only focus:absolute focus:left-3 focus:top-3 focus:z-50 focus:rounded focus:bg-card focus:px-3 focus:py-2">Skip to key races</a>
      <div className="h-1 w-full bg-foreground" aria-hidden />
      <main className="mx-auto max-w-7xl px-4 pb-12 pt-6 sm:px-6 lg:px-8">
        <header className="mb-6 grid gap-4 border-b border-foreground/80 pb-5 md:grid-cols-[1fr_auto] md:items-end">
          <div>
            <p className="eyebrow">Tuesday, November 3, 2026 · U.S. midterm elections</p>
            <h1 className="mt-1 text-3xl font-bold tracking-tight sm:text-5xl" data-testid="text-title">Election Night 2026 Tracker</h1>
            {data?.status_note && <p className="mt-2 max-w-2xl text-sm sm:text-base" data-testid="text-status-note">{data.status_note}</p>}
          </div>
          <div className="space-y-1 text-xs md:text-right" aria-live="polite">
            <p className="flex items-center gap-2 md:justify-end" data-testid="text-last-checked">
              <span className={q.isError ? "h-2 w-2 rounded-full bg-muted-foreground" : "live-dot h-2 w-2 rounded-full bg-foreground"} aria-hidden />
              <span className="tabnum font-mono">Auto-refreshing every 60s · last checked {checked} MT</span>
              {q.isFetching && <RefreshCw className="h-3 w-3 animate-spin text-muted-foreground" aria-label="Refreshing" />}
            </p>
            <p className="tabnum font-mono text-muted-foreground" data-testid="text-updated-at">Data updated {updated ?? "\u2013"}</p>
          </div>
        </header>

        {q.isError && (
          <div role="alert" className="mb-6 flex flex-wrap items-center gap-3 rounded-lg border border-foreground/30 bg-card px-4 py-3 text-sm" data-testid="status-fetch-error">
            <AlertTriangle className="h-4 w-4" aria-hidden />
            <span className="flex-1">Could not reach the data feed. {data ? "Showing the last successfully loaded data." : "No data loaded yet."} Retrying automatically.</span>
            <button type="button" onClick={() => q.refetch()} data-testid="button-retry"
              className="rounded-md border border-border px-3 py-1 font-medium hover:bg-muted focus-visible:outline-2 focus-visible:outline-ring">Retry now</button>
          </div>
        )}

        {q.isLoading ? (
          <div className="grid gap-5 lg:grid-cols-2" aria-busy="true">
            {[0, 1, 2, 3].map((i) => <div key={i} className="h-48 animate-pulse rounded-lg bg-muted" />)}
          </div>
        ) : (
          <>
            <StateMap races={data?.races} earlyVote={data?.early_vote} notes={data?.map_notes} />
            <div className="grid gap-5 lg:grid-cols-2">
              <SenatePanel data={st.senate} />
              <HousePanel data={st.house} />
            </div>

            <div className="mt-5 grid gap-5 lg:grid-cols-[minmax(0,1fr)_20rem]">
              <Panel id="races" kicker="Senate · D minus R" title="Key races" className="overflow-hidden [&>div]:p-0">
                <div className="hidden grid-cols-[3.25rem_minmax(10rem,1.4fr)_minmax(8rem,1fr)_minmax(9rem,1.1fr)_minmax(7rem,.8fr)_2rem] gap-x-3 border-b border-border bg-muted/40 px-5 py-2 eyebrow lg:grid">
                  <span>State</span><span>Candidates</span><span>Current margin</span><span>Projection</span><span>Call</span><span className="sr-only">Details</span>
                </div>
                <ul>{races.map((r, i) => <RaceRow key={`${r.state}-${i}`} race={r} />)}</ul>
              </Panel>
              <div className="space-y-5">
                <PollClosings data={data?.poll_closings_mt} />
                <Feed id="alerts" title="Latest alerts" items={alerts} empty="No alerts yet" />
                <Feed id="calls" title="Calls log" items={calls} empty="No calls yet" />
              </div>
            </div>
          </>
        )}
        <Methodology notes={notes} />
      </main>
    </div>
  );
}
