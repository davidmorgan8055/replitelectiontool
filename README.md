# Election Night 2026 — nonpartisan results tracker

Static site (no build step): `index.html`, `styles.css`, `app.js`, `data.json`.
Live: https://davidmorgan8055.github.io/election-night-2026-data/

## Data feed
`data.json` is the single source of truth. The page re-fetches it every 60 seconds (`data.json?t=<timestamp>`) and re-renders. Updates are committed straight to this file on `main`, so the commit history is a public, versioned record of every change.

Key fields: `updated_at` (MT), `status_note`, `races[]` (candidates, `polling_avg` + sources, `margin_2022`, `margin_2024`, `poll_close_mt`, `current_margin`, `pct_in`, `projected_margin`, `projection_confidence`, `call {status, by, time_mt}`), `seat_tracker`, `calls_log[]`, `alerts[]`, `early_vote`, `notes`. Margins are Democrat minus Republican, in points. Live fields are `null` until results arrive.

Rules: a race is shown as called only when AP or a network decision desk calls it. Projections are an independent model, not calls. Prediction-market figures, if shown, are trader odds. Map: us-atlas (public domain) + d3 via jsDelivr.

## Import into Replit (no Agent needed)
1. Replit → **Create App** → **Import from GitHub** → pick `davidmorgan8055/election-night-2026-data`.
2. Skip/decline any Agent setup. Deploy → **Static** deployment, public directory `/` (repo root), no build command.
3. The static deploy serves a snapshot; for live data either redeploy, or simply use the GitHub Pages URL above (it updates on every push).

## Local preview
`python3 -m http.server 8000` then open http://localhost:8000

## Running on Replit
Import this repo (Create App > Import from GitHub). The included `.replit` file serves it as a plain static site: press Run to preview, or Deploy > Static to publish. There's no build step and no packages to install. Live numbers come from `data.json`, which is updated automatically in this repo; a static Replit deploy shows new data only after you re-pull and redeploy.
