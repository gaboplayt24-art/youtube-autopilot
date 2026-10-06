create table if not exists public.pipeline_artifacts (
 key text primary key,
 value jsonb not null,
 updated_at timestamptz not null default now()
);
alter table public.pipeline_artifacts enable row level security;
-- Access with service-role credentials only; no anonymous client policies.
