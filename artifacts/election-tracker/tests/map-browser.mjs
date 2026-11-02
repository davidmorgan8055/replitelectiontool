// Dependency-free browser interaction checks via Chromium's DevTools protocol.
// Start headless Chromium with --remote-debugging-port=9223 before running.
// All election fixtures are intercepted in this browser only, never stored.
import assert from "node:assert/strict";
import { once } from "node:events";

const debug = process.env.CDP_URL ?? "http://127.0.0.1:9223";
const app = process.env.MAP_TEST_URL ?? "http://localhost:80/";
const target = await (await fetch(`${debug}/json/new?about:blank`, { method: "PUT" })).json();
const ws = new WebSocket(target.webSocketDebuggerUrl);
await once(ws, "open");
let id = 0;
const pending = new Map();
const browserErrors = [];
const requests = [];
let fixture = {
  updated_at: "2026-11-04T03:01:00Z",
  status_note: "Browser test fixture",
  races: [
    {
      state: "TX", candidates: [{ name: "Test Democrat", party: "D" }, { name: "Test Republican", party: "R" }],
      map: { status: "called", leader: "D", current_margin: 2.4, projected_margin: 1.6, polling_miss: 3.4, early_vote_signal: "leans D", early_vote_confidence: "medium", key: true, watch: true },
      call: { status: "called", by: "AP", time_mt: "20:01", source_url: "https://example.org/call" },
      polling_avg: { margin_dem_minus_rep: -1, sources: [{ name: "Poll input", url: "https://example.org/poll" }] },
      source_url: "https://example.org/race",
    },
    {
      state: "ME", candidates: [{ name: "Other test candidate", party: "R" }],
      map: { status: "leading", leader: "R", current_margin: -3.2, projected_margin: null, polling_miss: -2, early_vote_signal: "leans R", early_vote_confidence: "low", watch: true },
    },
    { state: "NC", map: { status: "not_reporting", current_margin: null, polling_miss: null, early_vote_signal: null } },
  ],
  early_vote: {
    compiled_mt: "20:00", tracker: { name: "Test tracker", url: "https://example.org/tracker" },
    general_caveats: ["Test caveat: party registration is not a vote."],
    states: { TX: { figures: { returned_ballots: 12345, by_party: { D: 6000, R: 6000 } }, signal: "leans D", confidence: "medium", basis: "Test registration data", as_of_mt: "19:50", sources: [{ name: "State source", url: "https://example.org/early" }] } },
  },
  map_notes: ["Test map note."],
};

function send(method, params = {}) {
  return new Promise((resolve, reject) => {
    const n = ++id;
    pending.set(n, { resolve, reject });
    ws.send(JSON.stringify({ id: n, method, params }));
  });
}
ws.addEventListener("message", ({ data }) => {
  const m = JSON.parse(data);
  if (m.id) {
    const p = pending.get(m.id);
    if (p) { pending.delete(m.id); m.error ? p.reject(new Error(m.error.message)) : p.resolve(m.result); }
  } else if (m.method === "Fetch.requestPaused") {
    send("Fetch.fulfillRequest", {
      requestId: m.params.requestId, responseCode: 200,
      responseHeaders: [{ name: "Content-Type", value: "application/json" }, { name: "Cache-Control", value: "no-store" }],
      body: Buffer.from(JSON.stringify(fixture)).toString("base64"),
    }).catch(console.error);
  } else if (m.method === "Runtime.exceptionThrown") browserErrors.push(m.params.exceptionDetails.text);
  else if (m.method === "Network.requestWillBeSent") requests.push(m.params.request.url);
});
async function evaluate(expression) {
  const r = await send("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true });
  if (r.exceptionDetails) throw new Error(JSON.stringify(r.exceptionDetails));
  return r.result.value;
}
async function waitFor(expression, message) {
  const deadline = Date.now() + 10000;
  while (Date.now() < deadline) {
    if (await evaluate(`Boolean(${expression})`)) return;
    await new Promise((r) => setTimeout(r, 60));
  }
  throw new Error(`Timed out: ${message}`);
}
const click = (testId) => evaluate(`document.querySelector('[data-testid="${testId}"]').dispatchEvent(new MouseEvent('click',{bubbles:true}))`);

try {
  await send("Page.enable");
  await send("Runtime.enable");
  await send("Network.enable");
  await send("Fetch.enable", { patterns: [{ urlPattern: "*/api/data*", requestStage: "Request" }] });
  await send("Page.addScriptToEvaluateOnNewDocument", {
    source: `window.__pollIntervals=[]; const original=window.setInterval; window.setInterval=function(fn,ms,...args){window.__pollIntervals.push(ms);return original.call(this,fn,ms===60000?300:ms,...args)};`,
  });
  await send("Page.navigate", { url: app });
  await waitFor(`document.querySelector('[data-testid="map-state-TX"]')`, "map loads");
  assert.equal(await evaluate(`document.querySelectorAll('[data-testid^="map-state-"]').length`), 51);
  assert.match(await evaluate(`document.querySelector('[data-testid="map-state-TX"]').getAttribute('aria-label')`), /Called: Democrat.*key race.*on watch/);
  assert.match(await evaluate(`document.querySelector('[data-testid="map-state-ME"]').getAttribute('aria-label')`), /Republican leading/);
  assert.match(await evaluate(`document.querySelector('[data-testid="map-state-NC"]').getAttribute('aria-label')`), /Not yet reporting/);
  assert.match(await evaluate(`document.querySelector('[data-testid="map-state-CA"]').getAttribute('aria-label')`), /No tracked race/);

  await click("map-state-TX");
  assert.equal(await evaluate(`document.querySelector('[data-testid="text-map-caller-TX"]').textContent`), "AP");
  assert.ok(await evaluate(`document.querySelector('[data-testid="map-detail-TX"]').textContent.includes('Test Democrat')`));
  assert.equal(await evaluate(`document.querySelector('[data-testid="link-map-TX-call-0"]').href`), "https://example.org/call");
  await click("radio-map-view-current");
  assert.match(await evaluate(`document.querySelector('[data-testid="map-state-TX"]').getAttribute('aria-label')`), /D\+2.4/);
  assert.match(await evaluate(`document.querySelector('[data-testid="map-state-ME"]').getAttribute('aria-label')`), /R\+3.2/);
  await click("radio-map-view-projected");
  assert.equal(await evaluate(`document.querySelector('[data-testid="text-projection-disclaimer"]').textContent`), "Independent model projection - not a call");
  assert.match(await evaluate(`document.querySelector('[data-testid="map-state-ME"]').getAttribute('aria-label')`), /No data yet/);
  await click("radio-map-view-miss");
  assert.match(await evaluate(`document.querySelector('[data-testid="text-miss-legend"]').textContent`), /^Right\/blue side: Democrat did better than polls; left\/red side: Republican did better than polls$/);
  assert.match(await evaluate(`document.querySelector('[data-testid="map-state-TX"]').getAttribute('aria-label')`), /Democrat beat polls by 3.4/);
  assert.match(await evaluate(`document.querySelector('[data-testid="map-state-ME"]').getAttribute('aria-label')`), /Republican beat polls by 2.0/);

  await click("radio-map-view-early");
  assert.ok(await evaluate(`document.querySelector('[data-testid="map-early-caveats"]').textContent.includes('Test caveat')`));
  assert.ok(await evaluate(`document.querySelector('[data-testid="map-detail-TX"]').textContent.includes('12345')`));
  assert.ok(await evaluate(`document.querySelector('[data-testid="map-detail-TX"]').textContent.includes('Test registration data')`));
  assert.equal(await evaluate(`document.querySelector('[data-testid="link-map-TX-early-0"]').href`), "https://example.org/early");
  assert.match(await evaluate(`document.querySelector('[data-testid="map-state-TX"]').getAttribute('aria-label')`), /medium confidence/);
  assert.match(await evaluate(`document.querySelector('[data-testid="map-state-ME"]').getAttribute('aria-label')`), /low confidence/);
  assert.ok(await evaluate(`document.querySelector('[data-testid="map-notes"]').textContent.includes('Test map note')`));

  // Arrow-key view selection and Escape dismissal use real browser key events.
  await evaluate(`document.querySelector('[data-testid="radio-map-view-early"]').focus()`);
  await send("Input.dispatchKeyEvent", { type: "keyDown", key: "ArrowLeft", code: "ArrowLeft" });
  assert.equal(await evaluate(`document.querySelector('[data-testid="radio-map-view-miss"]').getAttribute('aria-checked')`), "true");
  await send("Input.dispatchKeyEvent", { type: "keyDown", key: "Escape", code: "Escape" });
  assert.ok(await evaluate(`!!document.querySelector('[data-testid="map-detail-empty"]')`));
  await evaluate(`document.querySelector('[data-testid="map-state-ME"]').focus()`);
  await send("Input.dispatchKeyEvent", { type: "keyDown", key: "Enter", code: "Enter" });
  assert.equal(await evaluate(`document.querySelector('[data-testid="map-state-ME"]').getAttribute('aria-pressed')`), "true");

  // Verify a later poll re-renders the map; interval is accelerated only here.
  assert.ok(await evaluate(`window.__pollIntervals.includes(60000)`));
  fixture.races[1].map.current_margin = 8.8;
  await click("radio-map-view-current");
  await waitFor(`document.querySelector('[data-testid="map-state-ME"]').getAttribute('aria-label').includes('D+8.8')`, "poll updates map without reload");

  await send("Emulation.setDeviceMetricsOverride", { width: 375, height: 812, deviceScaleFactor: 1, mobile: true });
  await send("Emulation.setTouchEmulationEnabled", { enabled: true });
  await evaluate(`document.querySelector('[data-testid="select-map-state"]').value='RI';document.querySelector('[data-testid="select-map-state"]').dispatchEvent(new Event('change',{bubbles:true}))`);
  assert.ok(await evaluate(`!!document.querySelector('[data-testid="map-detail-RI"]')`));
  assert.ok(await evaluate(`document.documentElement.scrollWidth <= window.innerWidth`), "mobile page has no horizontal overflow");
  await click("button-map-close");
  await evaluate(`document.querySelector('[data-testid="svg-state-map"]').scrollIntoView({block:'center'})`);
  const point = await evaluate(`(()=>{const r=document.querySelector('[data-testid="map-state-TX"]').getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2}})()`);
  await send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x: point.x, y: point.y }] });
  await send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  await waitFor(`document.querySelector('[data-testid="map-state-TX"]').getAttribute('aria-pressed')==='true'`, "mobile tap pins Texas");
  assert.equal(await evaluate(`document.querySelector('[data-testid="link-github"]').getAttribute('target')`), "_blank");
  assert.equal(await evaluate(`document.querySelector('[data-testid="link-github"]').href`), "https://github.com/davidmorgan8055/election-night-2026-data");
  assert.deepEqual(browserErrors, []);
  assert.equal(requests.filter((url) => /^https?:/.test(url) && new URL(url).origin !== new URL(app).origin).length, 0, "map makes no external requests");
  console.log("PASS: five views, live refresh, nulls, sources, calls, caveats, keyboard controls, mobile tap/selector, no overflow, local-only geometry, and GitHub footer.");
} finally {
  await fetch(`${debug}/json/close/${target.id}`).catch(() => {});
  ws.close();
}
