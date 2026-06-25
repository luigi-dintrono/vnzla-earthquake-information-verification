# VerificaVE

**Crowdsourced earthquake-information verification for Venezuela.**

After an earthquake, information moves faster than facts. VerificaVE collects
reports from many sources (news/RSS today, X via a pluggable connector),
**augments** each one with structured data (location, time, building, severity),
**deduplicates** so the same event isn't counted twice (and so corroboration
across sources is visible), and lets the public **verify** what's true — all in a
fast, Spanish-first, mobile-friendly feed.

> ⚠️ Information here is community-gathered and **not officially confirmed**.
> Always cross-check before acting. In an emergency in Venezuela, call **171**.

---

## How it works

```
 Connectors                 Pipeline (augment → embed → dedup)            UI
┌───────────┐   raw_items   ┌────────────────────────────────┐    ┌──────────────┐
│  RSS/news │ ───────────►  │ Claude extracts: title, place,  │    │  Feed (es)   │
│  X (off)  │               │ lat/lng, building, severity     │    │  + filters   │
│  Manual   │               │ OpenAI embeds → pgvector match  │ ─► │  Report page │
└───────────┘               │  match → +1 source (corroborate)│    │  Verify      │
                            │  no match → new report          │    │  Submit      │
                            └────────────────────────────────┘    └──────────────┘
                                                                  one signed vote / device
```

- **Augmentation** uses **Claude** (`@anthropic-ai/sdk`). No key? It falls back to
  a Spanish-keyword heuristic + a built-in Venezuela gazetteer for coordinates.
- **Deduplication** embeds each item (`text-embedding-3-small`) and matches it
  against existing reports with **pgvector** cosine similarity. No OpenAI key? It
  falls back to Postgres **`pg_trgm`** trigram similarity. A same-state guard
  avoids merging the same _kind_ of event across different cities.
- **Corroboration** is the point: a match increments `report_count` /
  `source_count` ("reportado por N fuentes") instead of creating a duplicate.
- **Verification** is anonymous. The first vote mints a signed, HttpOnly cookie;
  the DB stores only a non-reversible `voterHash`, with a unique constraint on
  `(report_id, voter_hash)` so one device counts once per report.

## Tech stack

Next.js 16 (App Router, TS) · Supabase (Postgres + pgvector + pg_trgm + RLS +
Realtime) · Tailwind v4 · Anthropic SDK · OpenAI embeddings · `rss-parser` · Zod.

---

## Quickstart

### 1. Prerequisites
- Node 20+ and npm
- A Supabase project (free tier is fine) — https://supabase.com

### 2. Configure environment
```bash
cp .env.example .env.local
```
Fill in the Supabase values (required). API keys are optional — the app degrades
gracefully without them. Generate the secrets:
```bash
node -e "console.log('VERIFY_COOKIE_SECRET=' + require('crypto').randomBytes(32).toString('hex'))"
node -e "console.log('CRON_SECRET=' + require('crypto').randomBytes(24).toString('hex'))"
```

### 3. Create the schema
Open the Supabase **SQL Editor** and run the contents of
[`supabase/migrations/0001_init.sql`](supabase/migrations/0001_init.sql).
(Or, with the Supabase CLI linked: `supabase db push`.)

### 4. Install + seed demo data
```bash
npm install
npm run seed      # inserts realistic multi-source events + simulated verifications
```

### 5. Run
```bash
npm run dev
# http://localhost:3000
```

---

## Ingestion

Connectors live in `src/lib/ingest/connectors/` and all return the same
`RawItemInput[]`. Add a source row in the `sources` table (`type` = `rss` |
`news` | `x` | `manual`) and the crawler picks it up.

Run the pipeline manually:
```bash
npm run ingest    # crawl active sources → raw_items
npm run process   # augment + dedup pending raw_items → reports
```

In production, [`vercel.json`](vercel.json) schedules these as Vercel Cron
(`/api/cron/ingest` every 15 min, `/api/cron/process` every 5 min). Both routes
require `Authorization: Bearer $CRON_SECRET` (Vercel adds this automatically when
`CRON_SECRET` is set as an env var).

### Enabling X / Twitter
The X connector ships **disabled** on purpose — scraping X violates its ToS and
breaks constantly. To enable it legally:
1. Set `X_CONNECTOR_ENABLED=true`.
2. On the X source row, set `config.feedUrl` to a gateway **you** operate that
   returns an account's posts as RSS/Atom (the official paid X API behind a proxy,
   or a licensed bridge). Swapping in the official API means editing only
   `src/lib/ingest/connectors/x.ts`.

---

## Project structure

```
src/
  app/
    page.tsx                 Feed (filters, stats, realtime)
    report/[id]/page.tsx     Report detail (map, sources, verify, comments)
    submit/page.tsx          Public submission
    api/verify               Record a vote (cookie identity, anti-double-count)
    api/submit               Public report intake (+ inline processing)
    api/cron/{ingest,process}  Protected pipeline triggers
  lib/
    ingest/                  Connectors + crawl orchestration
    process/                 augment (Claude) · embed (OpenAI) · dedup engine
    geo/venezuela.ts         Gazetteer for grounding coordinates
    queries.ts               Read layer for the UI
    identity.ts              Signed anonymous voter cookie
    supabase/                admin · read · browser clients
  components/                Feed, badges, verify panel, filters, ...
supabase/migrations/         Postgres schema (pgvector, RPCs, triggers, RLS)
scripts/                     seed · run-ingest · run-process
```

## Deploy (Vercel + Supabase)
1. Push to GitHub and import the repo in Vercel.
2. Add all env vars from `.env.example` in the Vercel project settings.
3. Deploy. Cron is configured by `vercel.json`.

## Roadmap ideas
- Moderator console (lock status, merge/split reports, mark official `false`).
- Geographic map view of the whole feed.
- Reputation-weighted verification; abuse/Sybil mitigation.
- Image/EXIF and reverse-search for media evidence.

## License
Open source for civic use. Built to help people find reliable information.
