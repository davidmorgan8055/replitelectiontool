// Normalization helpers. Never invent values: missing data stays null.

export type Party = "D" | "R" | "I" | "O";
export type Rec = Record<string, unknown>;

export const rec = (v: unknown): Rec =>
  v && typeof v === "object" && !Array.isArray(v) ? (v as Rec) : {};

export const num = (v: unknown): number | null => {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string" && v.trim() !== "" && Number.isFinite(Number(v))) return Number(v);
  return null;
};

export const str = (v: unknown): string | null => {
  if (typeof v === "string" && v.trim() !== "") return v.trim();
  if (typeof v === "number" && Number.isFinite(v)) return String(v);
  return null;
};

export const firstNum = (o: Rec, keys: string[]): number | null => {
  for (const k of keys) {
    const n = num(o[k]);
    if (n !== null) return n;
  }
  return null;
};

export const firstStr = (o: Rec, keys: string[]): string | null => {
  for (const k of keys) {
    const s = str(o[k]);
    if (s !== null) return s;
  }
  return null;
};

export function safeUrl(v: unknown): string | null {
  const s = str(v);
  if (!s) return null;
  try {
    const u = new URL(s);
    return u.protocol === "http:" || u.protocol === "https:" ? u.href : null;
  } catch {
    return null;
  }
}

export function partyOf(v: unknown): Party {
  const s = (str(v) ?? "").toUpperCase();
  if (s.startsWith("D")) return "D";
  if (s.startsWith("R") || s === "GOP") return "R";
  if (s.startsWith("I")) return "I";
  return "O";
}

/** Margin is Dem minus Rep. null renders as an en dash, never zero. */
export function fmtMargin(m: number | null): string {
  if (m === null) return "\u2013";
  if (m === 0) return "Even";
  return `${m > 0 ? "D" : "R"}+${Math.abs(m).toFixed(1)}`;
}

export const marginParty = (m: number | null): Party | null =>
  m === null || m === 0 ? null : m > 0 ? "D" : "R";

// ---------- Seat tracker ----------
export interface SeatCounts {
  dem: number | null;
  rep: number | null;
  sourceUrl: string | null;
  sourceLabel: string | null;
}

export function seatCounts(v: unknown): SeatCounts {
  const o = rec(v);
  const called = rec(o.called);
  let dem = firstNum(o, ["called_dem", "called_d", "dem_called", "d_called", "called_democrats"]);
  let rep = firstNum(o, ["called_rep", "called_r", "rep_called", "r_called", "called_republicans"]);
  if (dem === null) dem = firstNum(called, ["D", "d", "dem", "democrats"]);
  if (rep === null) rep = firstNum(called, ["R", "r", "rep", "republicans"]);
  if (dem === null) dem = firstNum(o, ["d", "D", "dem"]);
  if (rep === null) rep = firstNum(o, ["r", "R", "rep"]);
  return {
    dem,
    rep,
    sourceUrl: safeUrl(o.source_url ?? o.source ?? o.url),
    sourceLabel: firstStr(o, ["source_label", "source_name"]),
  };
}

// ---------- Races ----------
export const DEFAULT_STATES = ["AK", "IA", "KS", "ME", "MI", "OH", "TX", "NC", "SC"];
export const WATCH_STATES = new Set(["NC", "SC"]);

export interface Source { label: string; url: string | null }
export interface HistMargin { value: number | null; label: string | null }
export interface RaceView {
  state: string;
  candidates: { name: string; party: Party }[];
  current: number | null;
  pctIn: number | null;
  projected: number | null;
  confidence: string | null;
  pollingAvg: number | null;
  pollSources: Source[];
  m2022: HistMargin;
  m2024: HistMargin;
  pollClose: string | null;
  call: { status: string | null; by: string | null; time: string | null; party: Party | null };
  watch: boolean;
}

const hist = (v: unknown): HistMargin => {
  if (num(v) !== null) return { value: num(v), label: null };
  const o = rec(v);
  return {
    value: firstNum(o, ["value", "margin", "margin_dem_minus_rep"]),
    label: firstStr(o, ["race_label", "label", "race"]),
  };
};

function raceView(r: Rec, fallbackState: string): RaceView {
  const state = (str(r.state) ?? fallbackState).toUpperCase();
  const pa = rec(r.polling_avg);
  const srcRaw = Array.isArray(pa.sources) ? pa.sources : Array.isArray(pa.input_sources) ? pa.input_sources : [];
  const pollSources: Source[] = srcRaw
    .map((s): Source | null => {
      if (typeof s === "string") return { label: s, url: safeUrl(s) };
      const o = rec(s);
      const url = safeUrl(o.url ?? o.source_url);
      const label = firstStr(o, ["name", "label"]) ?? url;
      return label ? { label, url } : null;
    })
    .filter((s): s is Source => s !== null);
  const c = rec(r.call);
  const conf = r.projection_confidence;
  return {
    state,
    candidates: (Array.isArray(r.candidates) ? r.candidates : [])
      .map((x) => rec(x))
      .filter((x) => str(x.name))
      .map((x) => ({ name: str(x.name)!, party: partyOf(x.party) })),
    current: firstNum(r, ["current_margin", "current_margin_dem_minus_rep", "margin_dem_minus_rep"]),
    pctIn: num(r.pct_in),
    projected: firstNum(r, ["projected_margin", "projected_margin_dem_minus_rep"]),
    confidence: typeof conf === "number" ? (conf <= 1 ? `${Math.round(conf * 100)}%` : `${conf}%`) : str(conf),
    pollingAvg: firstNum(pa, ["margin_dem_minus_rep", "margin", "value"]),
    pollSources,
    m2022: hist(r.margin_2022),
    m2024: hist(r.margin_2024),
    pollClose: firstStr(r, ["poll_close_mt", "poll_closes_mt"]),
    call: {
      status: firstStr(c, ["status"]),
      by: firstStr(c, ["by", "source"]),
      time: firstStr(c, ["time_mt", "time"]),
      party: str(c.party ?? c.winner_party) ? partyOf(c.party ?? c.winner_party) : null,
    },
    watch: WATCH_STATES.has(state) || r.watch === true,
  };
}

export function buildRaces(races: unknown): RaceView[] {
  const list = (Array.isArray(races) ? races : []).map((r) => rec(r));
  const byState = new Map<string, Rec>();
  const extras: Rec[] = [];
  for (const r of list) {
    const s = str(r.state)?.toUpperCase();
    if (s && DEFAULT_STATES.includes(s) && !byState.has(s)) byState.set(s, r);
    else extras.push(r);
  }
  return [
    ...DEFAULT_STATES.map((s) => raceView(byState.get(s) ?? {}, s)),
    ...extras.map((r, i) => raceView(r, `Race ${i + 1}`)),
  ];
}

// ---------- Poll closings ----------
export function buildClosings(v: unknown) {
  const o = rec(v);
  const rows: { time: string; states: string[] }[] = [];
  for (const [k, val] of Object.entries(o)) {
    if (k === "source" || k === "source_url") continue;
    const states = Array.isArray(val)
      ? val.map(str).filter((s): s is string => !!s)
      : (str(val) ?? "").split(/[,;]\s*/).filter(Boolean);
    rows.push({ time: k, states });
  }
  return { rows, sourceUrl: safeUrl(o.source_url ?? o.source) };
}

// ---------- Feeds ----------
export interface FeedView { time: string | null; text: string; url: string | null }
export function buildFeed(v: unknown): FeedView[] {
  return (Array.isArray(v) ? v : [])
    .map((x) => {
      const o = rec(x);
      let text = firstStr(o, ["text", "message", "summary"]);
      if (!text) {
        const parts = [firstStr(o, ["state", "race"]), firstStr(o, ["status"]), firstStr(o, ["winner", "candidate"]), firstStr(o, ["by"]) && `by ${firstStr(o, ["by"])}`].filter(Boolean);
        text = parts.length ? parts.join(" \u00b7 ") : null;
      }
      return text ? { time: firstStr(o, ["time_mt", "time"]), text, url: safeUrl(o.source_url ?? o.url) } : null;
    })
    .filter((x): x is FeedView => x !== null);
}

// ---------- Time ----------
const TZ = "America/Denver";
export function fmtClockMT(ms: number): string {
  return new Intl.DateTimeFormat("en-US", { timeZone: TZ, hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false }).format(new Date(ms));
}
export function fmtStampMT(v: unknown): string | null {
  const s = str(v);
  if (!s) return null;
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return s;
  return new Intl.DateTimeFormat("en-US", { timeZone: TZ, month: "short", day: "numeric", hour: "numeric", minute: "2-digit", second: "2-digit" }).format(d) + " MT";
}
