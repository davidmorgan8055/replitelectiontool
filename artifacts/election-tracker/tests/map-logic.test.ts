import assert from "node:assert/strict";
import { test } from "node:test";
import {
  buildStateData, emptyState, fillFor, normalizeState, normalizeSignal,
  normalizeConfidence, shadeFor, collectLinks, mapNotes,
  MARGIN_STEPS, MARGIN_CLIP, MISS_STEPS, MISS_CLIP,
  MISS_LEGEND, PROJECTION_DISCLAIMER,
} from "../src/lib/map-logic";
import { STATE_SHAPES } from "../src/components/desk/map/geometry";

test("local geometry includes all states, DC, and the AK/HI insets", () => {
  assert.equal(STATE_SHAPES.length, 51);
  for (const a of ["AK", "HI", "TX", "RI", "DC"]) {
    const shape = STATE_SHAPES.find((s) => s.abbr === a);
    assert.ok(shape?.d);
    assert.ok(Number.isFinite(shape.cx) && Number.isFinite(shape.cy));
  }
});

test("absent races are never inferred from legacy watch/default states", () => {
  assert.equal(buildStateData([], {}).size, 0);
  for (const view of ["status", "current", "projected", "miss", "early"] as const) {
    const f = fillFor(emptyState("NC"), view);
    assert.equal(f.label, "No tracked race");
    assert.equal(f.pattern, null);
  }
});

test("explicit map nulls stay missing, even with legacy and early-vote values", () => {
  const d = buildStateData([{
    state: "TX", current_margin: 12, projected_margin: 3,
    polling_avg: { margin_dem_minus_rep: 1 },
    map: { status: null, current_margin: null, projected_margin: null, polling_miss: null, early_vote_signal: null, early_vote_confidence: null },
  }], { states: { TX: { signal: "leans D", confidence: "high" } } }).get("TX")!;
  assert.equal(d.current, null);
  assert.equal(d.projected, null);
  assert.equal(d.miss, null);
  assert.equal(d.lean, null);
  assert.equal(d.conf, null);
  for (const view of ["status", "current", "projected", "miss", "early"] as const) {
    assert.equal(fillFor(d, view).pattern, "nodata");
  }
});

test("status keeps calls, leads, unknown winners and no reporting distinct", () => {
  for (const leader of ["D", "R"]) {
    const called = buildStateData([{ state: "ME", map: { status: "called", leader }, call: { status: "called", by: "AP", time_mt: "20:01" } }], {}).get("ME")!;
    const leading = buildStateData([{ state: "ME", map: { status: "leading", leader } }], {}).get("ME")!;
    assert.equal(called.status, `called_${leader}`);
    assert.equal(called.call.by, "AP");
    assert.equal(fillFor(called, "status").pattern, null);
    assert.match(fillFor(leading, "status").label, /not called/);
    assert.ok(fillFor(leading, "status").pattern);
  }
  const unknown = buildStateData([{ state: "ME", map: { status: "called", leader: null } }], {}).get("ME")!;
  assert.equal(unknown.status, "called_unknown");
  assert.equal(unknown.call.by, null);
  assert.equal(fillFor(unknown, "status").pattern, "nodata");
  const none = buildStateData([{ state: "ME", map: { status: "not_reporting" } }], {}).get("ME")!;
  assert.equal(fillFor(none, "status").pattern, "dots");
});

test("zero is even, never missing; equal magnitudes use equal steps", () => {
  for (const magnitude of [0.2, 1, 4.9, 5, 10, 20, 30]) {
    const d = shadeFor(magnitude, MARGIN_STEPS, MARGIN_CLIP)!;
    const r = shadeFor(-magnitude, MARGIN_STEPS, MARGIN_CLIP)!;
    assert.equal(d.step, r.step);
    assert.equal(d.clipped, r.clipped);
    assert.equal(d.side, "D");
    assert.equal(r.side, "R");
  }
  assert.equal(shadeFor(0, MARGIN_STEPS, MARGIN_CLIP)?.side, "even");
  assert.equal(shadeFor(null, MARGIN_STEPS, MARGIN_CLIP), null);
});

test("polling miss direction is result minus polls, with explicit null respected", () => {
  const states = buildStateData([
    { state: "TX", polling_avg: { margin_dem_minus_rep: -1.11 }, map: { current_margin: 1.23 } },
    { state: "ME", polling_avg: { margin_dem_minus_rep: 2 }, map: { current_margin: -2, polling_miss: null } },
    { state: "NC", map: { polling_miss: -4 } },
  ], {});
  assert.ok(Math.abs(states.get("TX")!.miss! - 2.34) < 1e-10);
  assert.equal(states.get("TX")!.missComputed, true);
  assert.match(fillFor(states.get("TX")!, "miss").label, /Democrat beat polls/);
  assert.equal(states.get("ME")!.miss, null);
  assert.match(fillFor(states.get("NC")!, "miss").label, /Republican beat polls/);
  assert.equal(shadeFor(6, MISS_STEPS, MISS_CLIP)!.step, shadeFor(-6, MISS_STEPS, MISS_CLIP)!.step);
  assert.equal(MISS_LEGEND, "Right/blue side: Democrat did better than polls; left/red side: Republican did better than polls");
  assert.equal(PROJECTION_DISCLAIMER, "Independent model projection - not a call");
});

test("early vote normalizes signals and confidence without inventing high confidence", () => {
  for (const value of ["D", "leans_D", "leans Dem", "Democratic"]) assert.equal(normalizeSignal(value), "D");
  for (const value of ["R", "leans_R", "leans Republican", "GOP"]) assert.equal(normalizeSignal(value), "R");
  assert.equal(normalizeSignal("neutral"), "neutral");
  assert.equal(normalizeSignal(null), null);
  assert.equal(normalizeConfidence("HIGH"), "high");
  assert.equal(normalizeConfidence("likely"), null);
  const d = buildStateData([{ state: "TX", map: {} }], { states: { Texas: { signal: "leans D", confidence: "medium", figures: { returned: 123 }, basis: "Test basis" } } }).get("TX")!;
  assert.equal(d.lean, "D");
  assert.equal(d.conf, "medium");
  assert.equal(fillFor(d, "early").opacity, 0.7);
  d.conf = null;
  assert.match(fillFor(d, "early").label, /confidence not stated/);
  assert.equal(fillFor(d, "early").opacity, 0.45);
});

test("key and watch require live flags, state names normalize, source links are safe", () => {
  assert.equal(normalizeState("North Carolina"), "NC");
  assert.equal(normalizeState("tx"), "TX");
  assert.equal(normalizeState("invalid"), null);
  const d = buildStateData([{ state: "NC", map: { key: true, watch: true }, source_url: "javascript:alert(1)", call: { source_url: "https://example.com/call" } }], {}).get("NC")!;
  assert.equal(d.key, true);
  assert.equal(d.watch, true);
  assert.deepEqual(d.links.race, []);
  assert.equal(d.links.call.length, 1);
  assert.equal(collectLinks([{ name: "Safe", url: "https://example.com" }, { url: "https://example.com" }, { url: "data:text/html,bad" }]).length, 1);
  assert.deepEqual(mapNotes("Owner note"), ["Owner note"]);
});
