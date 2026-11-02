// Pure, unit-testable decisions for the state map. Never invents values.
import { firstNum, firstStr, num, rec, safeUrl, str, partyOf, type Party, type Rec } from "@/lib/election";

export type MapView = "status" | "current" | "projected" | "miss" | "early";
export const MAP_VIEWS: { id: MapView; label: string; short: string }[] = [
  { id: "status", label: "Senate status", short: "Status" },
  { id: "current", label: "Current margin", short: "Current" },
  { id: "projected", label: "Projected margin", short: "Projected" },
  { id: "miss", label: "Polling miss", short: "Poll miss" },
  { id: "early", label: "Early-vote signal", short: "Early vote" },
];
export const PROJECTION_DISCLAIMER = "Independent model projection - not a call";
export const MISS_LEGEND = "Right/blue side: Democrat did better than polls; left/red side: Republican did better than polls";
export const EARLY_BASELINE_CAVEAT = "Early voting is not vote totals or a call. Early-vote signals describe who has returned ballots, not how those ballots were cast.";
export const DEFAULT_MISS_DEF = "Result margin minus polling average (D minus R). Positive means the Democrat outperformed polls.";

export const STATE_NAMES: Record<string, string> = {
  AL: "Alabama", AK: "Alaska", AZ: "Arizona", AR: "Arkansas", CA: "California", CO: "Colorado", CT: "Connecticut", DE: "Delaware",
  DC: "District of Columbia", FL: "Florida", GA: "Georgia", HI: "Hawaii", ID: "Idaho", IL: "Illinois", IN: "Indiana", IA: "Iowa",
  KS: "Kansas", KY: "Kentucky", LA: "Louisiana", ME: "Maine", MD: "Maryland", MA: "Massachusetts", MI: "Michigan", MN: "Minnesota",
  MS: "Mississippi", MO: "Missouri", MT: "Montana", NE: "Nebraska", NV: "Nevada", NH: "New Hampshire", NJ: "New Jersey",
  NM: "New Mexico", NY: "New York", NC: "North Carolina", ND: "North Dakota", OH: "Ohio", OK: "Oklahoma", OR: "Oregon",
  PA: "Pennsylvania", RI: "Rhode Island", SC: "South Carolina", SD: "South Dakota", TN: "Tennessee", TX: "Texas", UT: "Utah",
  VT: "Vermont", VA: "Virginia", WA: "Washington", WV: "West Virginia", WI: "Wisconsin", WY: "Wyoming",
};
export const FIPS_TO_ABBR: Record<string, string> = {
  "01": "AL", "02": "AK", "04": "AZ", "05": "AR", "06": "CA", "08": "CO", "09": "CT", "10": "DE", "11": "DC", "12": "FL", "13": "GA",
  "15": "HI", "16": "ID", "17": "IL", "18": "IN", "19": "IA", "20": "KS", "21": "KY", "22": "LA", "23": "ME", "24": "MD", "25": "MA",
  "26": "MI", "27": "MN", "28": "MS", "29": "MO", "30": "MT", "31": "NE", "32": "NV", "33": "NH", "34": "NJ", "35": "NM", "36": "NY",
  "37": "NC", "38": "ND", "39": "OH", "40": "OK", "41": "OR", "42": "PA", "44": "RI", "45": "SC", "46": "SD", "47": "TN", "48": "TX",
  "49": "UT", "50": "VT", "51": "VA", "53": "WA", "54": "WV", "55": "WI", "56": "WY",
};
const NAME_TO_ABBR = Object.fromEntries(Object.entries(STATE_NAMES).map(([a, n]) => [n.toLowerCase(), a]));

export function normalizeState(v: unknown): string | null {
  const s = str(v);
  if (!s) return null;
  const up = s.toUpperCase();
  if (STATE_NAMES[up]) return up;
  const byName = NAME_TO_ABBR[s.toLowerCase().replace(/\s+/g, " ").replace(/^state of /, "")];
  if (byName) return byName;
  if (/^washington,?\s*d\.?c\.?$/i.test(s) || /^d\.?c\.?$/i.test(s)) return "DC";
  return null;
}

/** Explicit-null aware field read: "absent" means key not present (or undefined). */
const has = (o: Rec, k: string) => Object.prototype.hasOwnProperty.call(o, k) && o[k] !== undefined;

// ---------- Status ----------
export type StatusKind = "called_D" | "called_R" | "called_unknown" | "leading_D" | "leading_R" | "leading_unknown" | "not_reporting" | "unknown" | "no_race";
export function statusKind(map: Rec | null): StatusKind {
  if (!map) return "no_race";
  const s = str(map.status)?.toLowerCase();
  const l = str(map.leader)?.toUpperCase();
  const leader = l === "D" || l === "R" ? l : null;
  if (s === "called") return leader ? (`called_${leader}` as StatusKind) : "called_unknown";
  if (s === "leading") return leader ? (`leading_${leader}` as StatusKind) : "leading_unknown";
  if (s === "not_reporting") return "not_reporting";
  return "unknown";
}
export const STATUS_LABEL: Record<StatusKind, string> = {
  called_D: "Called: Democrat", called_R: "Called: Republican", called_unknown: "Marked called - winner not supplied",
  leading_D: "Democrat leading (not called)", leading_R: "Republican leading (not called)", leading_unknown: "Leading - leader not supplied",
  not_reporting: "Not yet reporting", unknown: "No data yet - status not supplied", no_race: "No tracked race",
};

// ---------- Margin scales ----------
export const MARGIN_CLIP = 20; // points; values beyond are drawn at the darkest step
export const MARGIN_STEPS = [1, 5, 10, 20]; // bin upper bounds (abs pts)
export const MISS_CLIP = 10;
export const MISS_STEPS = [1, 3, 6, 10];

export type Side = "D" | "R" | "even";
export interface Shade { side: Side; step: number; clipped: boolean } // step 0..3
export function shadeFor(v: number | null, steps: number[], clip: number): Shade | null {
  if (v === null) return null;
  if (v === 0) return { side: "even", step: 0, clipped: false };
  const a = Math.abs(v);
  let step = steps.findIndex((b) => a < b);
  if (step === -1) step = steps.length - 1;
  return { side: v > 0 ? "D" : "R", step, clipped: a > clip };
}

// ---------- Early vote ----------
export type Lean = "D" | "R" | "neutral";
export type Conf = "low" | "medium" | "high";
export function normalizeSignal(v: unknown): Lean | null {
  const s = str(v)?.toLowerCase().replace(/[\s_-]+/g, " ").trim();
  if (!s) return null;
  if (["neutral", "even", "tossup", "toss up", "none", "no lean"].includes(s)) return "neutral";
  const m = s.match(/^(?:leans? )?(d|dem|dems|democrat|democratic|r|rep|gop|republican)$/);
  if (!m) return null;
  return m[1].startsWith("d") ? "D" : "R";
}
export function normalizeConfidence(v: unknown): Conf | null {
  const s = str(v)?.toLowerCase();
  return s === "low" || s === "medium" || s === "high" ? s : null;
}

// ---------- Generic display helpers ----------
export interface LinkView { label: string; url: string }
export function collectLinks(...vals: unknown[]): LinkView[] {
  const out: LinkView[] = [];
  const seen = new Set<string>();
  const push = (label: string | null, url: string | null) => {
    if (!url || seen.has(url)) return;
    seen.add(url);
    out.push({ label: label ?? new URL(url).hostname, url });
  };
  const visit = (v: unknown) => {
    if (Array.isArray(v)) return v.forEach(visit);
    if (typeof v === "string") return push(null, safeUrl(v));
    const o = rec(v);
    push(firstStr(o, ["name", "label", "title"]), safeUrl(o.url ?? o.source_url ?? o.href));
  };
  vals.forEach(visit);
  return out;
}

export function trackerView(v: unknown): { label: string | null; url: string | null } {
  if (typeof v === "string") { const u = safeUrl(v); return { label: u ? null : str(v), url: u }; }
  const o = rec(v);
  return { label: firstStr(o, ["name", "label", "title"]), url: safeUrl(o.url ?? o.source_url) };
}

export function mapNotes(v: unknown): string[] {
  if (typeof v === "string") return v.trim() ? [v.trim()] : [];
  return (Array.isArray(v) ? v : []).map(str).filter((s): s is string => !!s);
}

// ---------- Per-state model ----------
export interface StateDatum {
  abbr: string;
  name: string;
  hasRace: boolean;
  status: StatusKind;
  candidates: { name: string; party: Party }[];
  current: number | null;
  projected: number | null;
  miss: number | null;
  missComputed: boolean;
  missDef: string | null;
  pollAvg: number | null;
  lean: Lean | null;
  leanRaw: string | null;
  conf: Conf | null;
  confRaw: string | null;
  key: boolean;
  watch: boolean;
  call: { status: string | null; by: string | null; time: string | null };
  early: { figures: unknown; basis: string | null; asOf: string | null } | null;
  links: { race: LinkView[]; call: LinkView[]; polls: LinkView[]; early: LinkView[] };
}

export function buildStateData(races: unknown, earlyVote: unknown): Map<string, StateDatum> {
  const evStates = rec(rec(earlyVote).states);
  const evByAbbr = new Map<string, Rec>();
  for (const [k, v] of Object.entries(evStates)) { const a = normalizeState(k); if (a && !evByAbbr.has(a)) evByAbbr.set(a, rec(v)); }
  const out = new Map<string, StateDatum>();
  for (const raw of Array.isArray(races) ? races : []) {
    const r = rec(raw);
    const abbr = normalizeState(r.state);
    if (!abbr || out.has(abbr)) continue;
    const m = has(r, "map") && r.map !== null ? rec(r.map) : {};
    const pa = rec(r.polling_avg);
    const c = rec(r.call);
    const ev = evByAbbr.get(abbr) ?? null;
    const current = num(m.current_margin);
    const pollAvg = firstNum(pa, ["margin_dem_minus_rep", "margin", "value"]);
    let miss = num(m.polling_miss);
    let missComputed = false;
    if (!has(m, "polling_miss") && current !== null && pollAvg !== null) {
      miss = current - pollAvg;
      missComputed = true;
    }
    const sigVal = has(m, "early_vote_signal") ? m.early_vote_signal : ev?.signal;
    const confVal = has(m, "early_vote_confidence") ? m.early_vote_confidence : ev?.confidence;
    out.set(abbr, {
      abbr,
      name: STATE_NAMES[abbr],
      hasRace: true,
      status: statusKind(m),
      candidates: (Array.isArray(r.candidates) ? r.candidates : []).map(rec).filter((x) => str(x.name)).map((x) => ({ name: str(x.name)!, party: partyOf(x.party) })),
      current,
      projected: num(m.projected_margin),
      miss,
      missComputed,
      missDef: str(m.polling_miss_def),
      pollAvg,
      lean: normalizeSignal(sigVal),
      leanRaw: str(sigVal),
      conf: normalizeConfidence(confVal),
      confRaw: str(confVal),
      key: m.key === true,
      watch: m.watch === true,
      call: { status: firstStr(c, ["status"]), by: firstStr(c, ["by", "source"]), time: firstStr(c, ["time_mt", "time"]) },
      early: ev ? { figures: ev.figures, basis: str(ev.basis), asOf: str(ev.as_of_mt) } : null,
      links: {
        race: collectLinks(r.sources, r.source_url),
        call: collectLinks(c.source_url, c.url),
        polls: collectLinks(pa.sources, pa.input_sources, pa.source_url),
        early: collectLinks(ev?.sources),
      },
    });
  }
  return out;
}

export function emptyState(abbr: string): StateDatum {
  return {
    abbr, name: STATE_NAMES[abbr] ?? abbr, hasRace: false, status: "no_race", candidates: [], current: null, projected: null,
    miss: null, missComputed: false, missDef: null, pollAvg: null, lean: null, leanRaw: null, conf: null, confRaw: null,
    key: false, watch: false, call: { status: null, by: null, time: null }, early: null, links: { race: [], call: [], polls: [], early: [] },
  };
}

// ---------- Fill decision (pure) ----------
export interface FillSpec { fill: string; pattern: string | null; opacity: number; label: string }
const BLUE = ["hsl(214 60% 86%)", "hsl(214 65% 70%)", "hsl(214 72% 52%)", "hsl(214 82% 36%)"];
const ORNG = ["hsl(18 80% 87%)", "hsl(18 82% 70%)", "hsl(16 82% 52%)", "hsl(12 84% 38%)"];
export const NO_RACE_FILL = "hsl(220 12% 88%)";
export const NO_DATA_FILL = "hsl(220 10% 78%)";
export const SCALE = { D: BLUE, R: ORNG, even: "hsl(220 10% 96%)" };

export function fmtSigned(v: number): string { return v === 0 ? "Even" : `${v > 0 ? "D" : "R"}+${Math.abs(v).toFixed(1)}`; }

function marginFill(v: number | null, steps: number[], clip: number, prefix: string): FillSpec {
  const s = shadeFor(v, steps, clip);
  if (!s) return { fill: NO_DATA_FILL, pattern: "nodata", opacity: 1, label: "No data yet" };
  if (s.side === "even") return { fill: SCALE.even, pattern: null, opacity: 1, label: `${prefix}Even (0.0)` };
  return { fill: SCALE[s.side][s.step], pattern: null, opacity: 1, label: `${prefix}${fmtSigned(v!)}${s.clipped ? " (beyond scale)" : ""}` };
}

export function fillFor(d: StateDatum, view: MapView): FillSpec {
  if (!d.hasRace) return { fill: NO_RACE_FILL, pattern: null, opacity: 1, label: "No tracked race" };
  switch (view) {
    case "status": {
      const k = d.status;
      const f: Record<StatusKind, FillSpec> = {
        called_D: { fill: BLUE[3], pattern: null, opacity: 1, label: STATUS_LABEL.called_D },
        called_R: { fill: ORNG[3], pattern: null, opacity: 1, label: STATUS_LABEL.called_R },
        called_unknown: { fill: NO_DATA_FILL, pattern: "nodata", opacity: 1, label: STATUS_LABEL.called_unknown },
        leading_D: { fill: BLUE[1], pattern: "leadD", opacity: 1, label: STATUS_LABEL.leading_D },
        leading_R: { fill: ORNG[1], pattern: "leadR", opacity: 1, label: STATUS_LABEL.leading_R },
        leading_unknown: { fill: NO_DATA_FILL, pattern: "nodata", opacity: 1, label: STATUS_LABEL.leading_unknown },
        not_reporting: { fill: "hsl(220 14% 97%)", pattern: "dots", opacity: 1, label: STATUS_LABEL.not_reporting },
        unknown: { fill: NO_DATA_FILL, pattern: "nodata", opacity: 1, label: STATUS_LABEL.unknown },
        no_race: { fill: NO_RACE_FILL, pattern: null, opacity: 1, label: STATUS_LABEL.no_race },
      };
      return f[k];
    }
    case "current": return marginFill(d.current, MARGIN_STEPS, MARGIN_CLIP, "Current ");
    case "projected": return marginFill(d.projected, MARGIN_STEPS, MARGIN_CLIP, "Projected ");
    case "miss": {
      const s = shadeFor(d.miss, MISS_STEPS, MISS_CLIP);
      if (!s) return { fill: NO_DATA_FILL, pattern: "nodata", opacity: 1, label: "No data yet" };
      if (s.side === "even") return { fill: SCALE.even, pattern: null, opacity: 1, label: "Matched polls (0.0)" };
      const who = s.side === "D" ? "Democrat" : "Republican";
      return { fill: SCALE[s.side][s.step], pattern: null, opacity: 1, label: `${who} beat polls by ${Math.abs(d.miss!).toFixed(1)}${s.clipped ? " (beyond scale)" : ""}` };
    }
    case "early": {
      if (!d.lean) return { fill: NO_DATA_FILL, pattern: "nodata", opacity: 1, label: "No data yet - early-vote signal unavailable" };
      const opacity = d.conf === "high" ? 1 : d.conf === "medium" ? 0.7 : 0.45;
      const confTxt = d.conf ? `${d.conf} confidence` : "confidence not stated";
      if (d.lean === "neutral") return { fill: "hsl(220 10% 92%)", pattern: "neutral", opacity: 1, label: `Neutral, ${confTxt}` };
      return {
        fill: d.lean === "D" ? BLUE[2] : ORNG[2],
        pattern: d.conf === "high" ? null : d.conf === "medium" ? "confMed" : "confLow",
        opacity,
        label: `Leans ${d.lean === "D" ? "Democrat" : "Republican"}, ${confTxt}`,
      };
    }
  }
}
