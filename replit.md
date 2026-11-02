# Election Night 2026 Tracker

A public, strictly nonpartisan decision desk for the November 3, 2026 U.S. Senate and House midterms.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port 5000)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- Required env: `DATABASE_URL` — Postgres connection string

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- API: Express 5
- DB: PostgreSQL + Drizzle ORM
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec)
- Build: esbuild (CJS bundle)

## Where things live

_Populate as you build — short repo map plus pointers to the source-of-truth file for DB schema, API contracts, theme files, etc._

## Architecture decisions

_Populate as you build — non-obvious choices a reader couldn't infer from the code (3-5 bullets)._

## Product

The owner publishes complete results JSON documents through the token-protected API. This app is a display, not an automatic election-data collector. Never invent candidates, results, poll-closing times, alerts, projections, or calls. Before the first update, show the awaiting-data state.

`GET /api/data` reads the singleton PostgreSQL JSON document without caching. `POST /api/data` atomically replaces it, preserving the submitted document including its `updated_at`; the response timestamp records the storage write. Use `Content-Type: application/json` and server-only `X-Update-Token`, matching the `ADMIN_UPDATE_TOKEN` Secret. The request limit is 1,048,576 bytes. Never include the token in frontend code, committed examples, or logs. The owner must save this Secret through the secure Secrets form before updates can succeed.

The frontend polls every 60 seconds. Document timestamps are displayed in America/Denver time, labeled MT. Submitted poll-close and call times are already MT.

## User preferences

- Strictly nonpartisan: slate/gray/white; blue only for Democratic markers and red only for Republican markers, with equal visual treatment.
- No sign-ups, login, analytics, ads, cookies, or visitor data collection.
- Calls only from AP or network decision desks. Model projections must always be labeled independently and are not calls.
- Results must persist in one shared PostgreSQL row, never an in-memory or file-based store, because Autoscale instances are stateless.
- Include “Data history on GitHub” linking to https://github.com/davidmorgan8055/election-night-2026-data in a new tab.
- The original interactive map must use locally bundled public-domain state geometry and only the live results document, never synthetic tracked races. Missing races mean “No tracked race”; missing values mean “No data yet,” not zero.
- Map views are Senate status, current margin, independent projected margin (not a call), polling miss, and early-vote signal. Polling miss is result minus polling average: positive means Democrats outperformed polling.
- For the map, use a labeled colorblind-friendly blue-to-orange/red diverging palette, equal scales for both parties, explicit uncertainty, key/watch outlines, and hover/tap/keyboard state details. Show the owner's map notes and early-vote caveats.

## Gotchas

_Populate as you build — sharp edges, "always run X before Y" rules._

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
