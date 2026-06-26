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
- **Live feed** via lightweight client polling (refresh every ~30s + on focus).

## Tech stack

Next.js 16 (App Router, TS) · **Neon** Postgres (`pgvector` + `pg_trgm`) via the
`pg` driver · Tailwind v4 · Anthropic SDK · OpenAI embeddings · `rss-parser` · Zod.

The data layer is plain Postgres — any Postgres with `pgvector` + `pg_trgm`
works; Neon is just the default host.

---

## Quickstart (local)

### 1. Prerequisites
- Node 20+ and npm
- A Neon project (free tier is fine) — https://neon.tech

### 2. Configure environment
```bash
cp .env.example .env.local
```
Set `DATABASE_URL` to your Neon **pooled** connection string (Neon dashboard →
Connect → "Pooled connection"). API keys are optional — the app degrades
gracefully without them. Generate the secrets:
```bash
node -e "console.log('VERIFY_COOKIE_SECRET=' + require('crypto').randomBytes(32).toString('hex'))"
node -e "console.log('CRON_SECRET=' + require('crypto').randomBytes(24).toString('hex'))"
```

### 3. Install, migrate, seed
```bash
npm install
npm run db:migrate   # applies db/schema.sql (pgvector, pg_trgm, functions, triggers)
npm run seed         # realistic multi-source events + simulated verifications
```

### 4. Run
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

### Enabling X / Twitter
The X connector ships **disabled** on purpose — scraping X violates its ToS and
breaks constantly. To enable it legally: set `X_CONNECTOR_ENABLED=true` and, on
the X source row, set `config.feedUrl` to a gateway **you** operate that returns
the account's posts as RSS/Atom (official paid X API behind a proxy, or a
licensed bridge). Swapping in the official API touches only
`src/lib/ingest/connectors/x.ts`.

---

## Deploy to Vercel (+ Neon)

1. **Neon** — create your project and apply the schema. Either run
   `npm run db:migrate` locally against the production `DATABASE_URL`, or paste
   `db/schema.sql` into the Neon SQL editor. (Optional: `npm run seed`.)

2. **Push** the repo to GitHub (already wired to `origin`):
   ```bash
   git push
   ```

3. **Import** the repo at https://vercel.com/new — Next.js is auto-detected, no
   build settings needed.

4. **Environment variables** (Vercel → Project → Settings → Environment Variables),
   for Production (and Preview if you want):
   | Variable | Value |
   |---|---|
   | `DATABASE_URL` | Neon **pooled** connection string (`...-pooler...?sslmode=require`) |
   | `VERIFY_COOKIE_SECRET` | a 32-byte random hex |
   | `CRON_SECRET` | a random string (Vercel Cron sends it as a Bearer token) |
   | `ANTHROPIC_API_KEY` | optional — better field extraction |
   | `OPENAI_API_KEY` | optional — semantic dedup |
   | `ADMIN_SLUG` | secret URL segment for the admin panel at `/admin/<slug>` (unset ⇒ no admin page) |
   | `X_CONNECTOR_ENABLED` | `true` to crawl X accounts |
   | `X_FEED_GATEWAY` | X→RSS gateway base, e.g. a Nitter URL (`https://nitter.net`) or one with a `{handle}` placeholder |
   | `INGEST_WINDOW_HOURS` | optional — crawl look-back window (default `12`) |
   | `ANTHROPIC_MODEL`, `EMBEDDING_MODEL` | optional overrides |

   > Tip: the **Vercel ↔ Neon integration** (Vercel Marketplace) can set
   > `DATABASE_URL` for you automatically. Always use the **pooled** endpoint —
   > serverless functions open many short-lived connections.

5. **Deploy.** Done.

6. **Scheduling (free).** Vercel **Hobby** only allows once-a-day cron, so the
   pipeline is scheduled from **GitHub Actions** instead — see
   [`.github/workflows/cron.yml`](.github/workflows/cron.yml) (every 6 h).
   Add two repo secrets (Settings → Secrets and variables → Actions):
   | Secret | Value |
   |---|---|
   | `APP_URL` | your deployment URL, e.g. `https://your-app.vercel.app` (no trailing slash) |
   | `CRON_SECRET` | the **same** value you set in Vercel |
   - On **Vercel Pro** you can use native Vercel Cron instead — add a `vercel.json`
     with `{"crons":[{"path":"/api/cron/ingest","schedule":"*/15 * * * *"},{"path":"/api/cron/process","schedule":"*/5 * * * *"}]}`.

7. (Optional) Set the Vercel function **region** close to your Neon region to cut
   DB latency.

---

## Project structure

```
src/
  app/
    page.tsx                 Feed (filters, stats, auto-refresh)
    report/[id]/page.tsx     Report detail (map, sources, verify, comments)
    submit/page.tsx          Public submission
    api/verify               Record a vote (cookie identity, anti-double-count)
    api/submit               Public report intake (+ inline processing)
    api/cron/{ingest,process}  Protected pipeline triggers
  lib/
    db.ts                    pg pool + query helpers (Neon/Postgres)
    ingest/                  Connectors + crawl orchestration
    process/                 augment (Claude) · embed (OpenAI) · dedup engine
    geo/venezuela.ts         Gazetteer for grounding coordinates
    queries.ts               Read layer for the UI
    identity.ts              Signed anonymous voter cookie
  components/                Feed, badges, verify panel, filters, ...
db/schema.sql                Postgres schema (pgvector, pg_trgm, functions, triggers)
scripts/                     migrate · seed · run-ingest · run-process
.github/workflows/cron.yml   Free scheduler (hits the cron endpoints every 6 h)
```

## Roadmap ideas
- Moderator console (lock status, merge/split reports, mark official `false`).
- Geographic map view of the whole feed.
- Reputation-weighted verification; abuse/Sybil mitigation.
- Image/EXIF and reverse-search for media evidence.

## License
Open source for civic use. Built to help people find reliable information.
