-- ============================================================================
-- VerificaVE — database schema (Neon / Postgres)
-- Crowdsourced earthquake-information verification for Venezuela.
--
-- Pipeline: connectors -> raw_items -> augment -> embed -> dedup -> reports
--           reports -> crowd verification (one signed vote per device)
--
-- Apply with:  npm run db:migrate   (runs this file against DATABASE_URL)
-- Idempotent: safe to run more than once.
-- ============================================================================

create extension if not exists pgcrypto;   -- gen_random_uuid()
create extension if not exists vector;      -- embeddings / semantic dedup
create extension if not exists pg_trgm;     -- trigram dedup fallback

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------
do $$ begin create type source_type as enum ('x','rss','news','manual','other'); exception when duplicate_object then null; end $$;
do $$ begin create type item_status as enum ('pending','processed','rejected','duplicate'); exception when duplicate_object then null; end $$;
do $$ begin create type report_status as enum ('unverified','verifying','verified','disputed','false'); exception when duplicate_object then null; end $$;
do $$ begin create type report_category as enum ('damage','casualty','rescue','infrastructure','utilities','aid','shelter','transport','rumor','official','other'); exception when duplicate_object then null; end $$;
do $$ begin create type vote_type as enum ('confirm','dispute','unsure'); exception when duplicate_object then null; end $$;

-- ---------------------------------------------------------------------------
-- sources: where information comes from (X accounts, RSS feeds, sites, manual)
-- ---------------------------------------------------------------------------
create table if not exists sources (
  id           uuid primary key default gen_random_uuid(),
  type         source_type not null default 'manual',
  name         text not null,
  url          text,
  handle       text,
  trust_weight real not null default 1.0,
  active       boolean not null default true,
  config       jsonb not null default '{}'::jsonb,
  created_at   timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- raw_items: ingested/submitted content, before augmentation + dedup
-- ---------------------------------------------------------------------------
create table if not exists raw_items (
  id           uuid primary key default gen_random_uuid(),
  source_id    uuid references sources(id) on delete set null,
  external_id  text,
  author       text,
  raw_text     text not null,
  raw_url      text,
  lang         text,
  media        jsonb not null default '[]'::jsonb,
  captured_at  timestamptz,
  submitted_by text,
  status       item_status not null default 'pending',
  report_id    uuid,
  similarity   real,
  created_at   timestamptz not null default now()
);
create unique index if not exists raw_items_source_external_udx
  on raw_items (source_id, external_id) where external_id is not null;
create index if not exists raw_items_status_idx on raw_items (status);
create index if not exists raw_items_report_idx on raw_items (report_id);

-- ---------------------------------------------------------------------------
-- reports: canonical, deduplicated event/claim. The unit users verify.
-- ---------------------------------------------------------------------------
create table if not exists reports (
  id             uuid primary key default gen_random_uuid(),
  title          text not null,
  summary        text,
  canonical_text text not null,
  category       report_category not null default 'other',
  status         report_status not null default 'unverified',
  status_locked  boolean not null default false,
  location_text  text,
  municipality   text,
  state          text,
  building_name  text,
  lat            double precision,
  lng            double precision,
  severity       smallint,
  occurred_at    timestamptz,
  embedding      vector(1536),
  report_count   int not null default 1,
  source_count   int not null default 1,
  confirm_count  int not null default 0,
  dispute_count  int not null default 0,
  unsure_count   int not null default 0,
  first_seen_at  timestamptz not null default now(),
  last_seen_at   timestamptz not null default now(),
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

-- is_demo: separates the seeded showcase feed (/demo) from the real crawled
-- feed (/). Idempotent so existing databases pick the columns up on re-migrate.
alter table reports   add column if not exists is_demo boolean not null default false;
alter table raw_items add column if not exists is_demo boolean not null default false;
create index if not exists reports_is_demo_idx on reports (is_demo, last_seen_at desc);
create index if not exists reports_category_idx on reports (category);
create index if not exists reports_status_idx on reports (status);
create index if not exists reports_last_seen_idx on reports (last_seen_at desc);
create index if not exists reports_state_idx on reports (state);
create index if not exists reports_canonical_trgm_idx
  on reports using gin (canonical_text gin_trgm_ops);
create index if not exists reports_embedding_idx
  on reports using hnsw (embedding vector_cosine_ops);

-- ---------------------------------------------------------------------------
-- report_items: links each raw item to its report (the corroboration trail)
-- ---------------------------------------------------------------------------
create table if not exists report_items (
  id          uuid primary key default gen_random_uuid(),
  report_id   uuid not null references reports(id) on delete cascade,
  raw_item_id uuid not null references raw_items(id) on delete cascade,
  similarity  real,
  created_at  timestamptz not null default now(),
  unique (raw_item_id)
);
create index if not exists report_items_report_idx on report_items (report_id);

-- ---------------------------------------------------------------------------
-- verifications: crowd votes. One per (report, device) via unique constraint.
-- ---------------------------------------------------------------------------
create table if not exists verifications (
  id           uuid primary key default gen_random_uuid(),
  report_id    uuid not null references reports(id) on delete cascade,
  voter_hash   text not null,
  vote         vote_type not null,
  comment      text,
  evidence_url text,
  created_at   timestamptz not null default now(),
  unique (report_id, voter_hash)
);
create index if not exists verifications_report_idx on verifications (report_id);

-- ===========================================================================
-- Functions
-- ===========================================================================

-- Semantic match: nearest reports by cosine similarity (embeddings configured)
create or replace function match_reports(
  query_embedding vector(1536),
  match_threshold float default 0.82,
  match_count int default 1
)
returns table (id uuid, similarity float)
language sql stable
as $$
  select r.id, 1 - (r.embedding <=> query_embedding) as similarity
  from reports r
  where r.embedding is not null
    and 1 - (r.embedding <=> query_embedding) >= match_threshold
  order by r.embedding <=> query_embedding
  limit match_count;
$$;

-- Trigram match: fallback when no embedding key is configured
create or replace function match_reports_trgm(
  query_text text,
  match_threshold float default 0.35,
  match_count int default 1
)
returns table (id uuid, similarity float)
language sql stable
as $$
  select r.id, similarity(r.canonical_text, query_text) as similarity
  from reports r
  where similarity(r.canonical_text, query_text) >= match_threshold
  order by similarity(r.canonical_text, query_text) desc
  limit match_count;
$$;

-- Recompute corroboration counts after attaching/detaching items
create or replace function recount_report(rid uuid)
returns void language sql
as $$
  update reports r set
    report_count = (select count(*) from report_items ri where ri.report_id = rid),
    source_count = (
      select count(distinct it.source_id)
      from report_items ri join raw_items it on it.id = ri.raw_item_id
      where ri.report_id = rid
    ),
    updated_at = now()
  where r.id = rid;
$$;

-- Maintain vote tallies + auto-status whenever a vote changes
create or replace function refresh_report_votes()
returns trigger language plpgsql
as $$
declare
  rid uuid;
  c int; d int; u int;
begin
  rid := coalesce(new.report_id, old.report_id);
  select
    count(*) filter (where vote = 'confirm'),
    count(*) filter (where vote = 'dispute'),
    count(*) filter (where vote = 'unsure')
    into c, d, u
  from verifications where report_id = rid;

  update reports r set
    confirm_count = c,
    dispute_count = d,
    unsure_count  = u,
    updated_at    = now(),
    status = case
      when r.status_locked then r.status
      when d >= 3 and d >= c then 'disputed'::report_status
      when c >= 5 and c >= d * 2 then 'verified'::report_status
      when (c + d) >= 1 then 'verifying'::report_status
      else 'unverified'::report_status
    end
  where r.id = rid;

  return null;
end;
$$;

drop trigger if exists trg_refresh_report_votes on verifications;
create trigger trg_refresh_report_votes
after insert or update or delete on verifications
for each row execute function refresh_report_votes();
