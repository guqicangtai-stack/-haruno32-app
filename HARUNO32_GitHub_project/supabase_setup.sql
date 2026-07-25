-- Supabase SQL Editor で一度だけ実行してください。

create table if not exists public.daily_records (
  id uuid primary key,
  record_date date not null,
  house text not null,
  work text not null,
  vigor integer not null check (vigor between 1 and 5),
  notes text not null,
  analysis text not null default '',
  photos jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

alter table public.daily_records enable row level security;

-- 個人利用の試作版ポリシーです。
-- URLを知る人が操作できるため、公開URLを他人へ共有しないでください。
create policy "allow anon select"
on public.daily_records for select to anon using (true);

create policy "allow anon insert"
on public.daily_records for insert to anon with check (true);

create policy "allow anon update"
on public.daily_records for update to anon using (true) with check (true);

insert into storage.buckets (id, name, public)
values ('daily-photos', 'daily-photos', true)
on conflict (id) do update set public = true;

create policy "allow anon photo upload"
on storage.objects for insert to anon
with check (bucket_id = 'daily-photos');

create policy "allow public photo view"
on storage.objects for select to public
using (bucket_id = 'daily-photos');


-- HARUNO32 v10: 収穫・灌水・施肥実績
create table if not exists public.cultivation_operations (
  id uuid primary key,
  operation_date date not null,
  house text not null,
  harvest_kg numeric not null default 0,
  irrigation_minutes numeric not null default 0,
  irrigation_count integer not null default 0,
  nitrogen_amount numeric not null default 0,
  fertilizer_note text not null default '',
  decision_note text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.cultivation_operations enable row level security;

drop policy if exists "allow anon operations select" on public.cultivation_operations;
drop policy if exists "allow anon operations insert" on public.cultivation_operations;
drop policy if exists "allow anon operations update" on public.cultivation_operations;
drop policy if exists "allow anon operations delete" on public.cultivation_operations;

create policy "allow anon operations select"
on public.cultivation_operations for select to anon using (true);

create policy "allow anon operations insert"
on public.cultivation_operations for insert to anon with check (true);

create policy "allow anon operations update"
on public.cultivation_operations for update to anon using (true) with check (true);

create policy "allow anon operations delete"
on public.cultivation_operations for delete to anon using (true);


-- HARUNO32 v12: 意思決定ログ
create table if not exists public.decision_logs (
  id uuid primary key,
  decision_date date not null,
  house text not null,
  action_text text not null default '',
  reason_text text not null default '',
  result_text text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.decision_logs enable row level security;
drop policy if exists "allow anon decisions select" on public.decision_logs;
drop policy if exists "allow anon decisions insert" on public.decision_logs;
drop policy if exists "allow anon decisions update" on public.decision_logs;
drop policy if exists "allow anon decisions delete" on public.decision_logs;
create policy "allow anon decisions select" on public.decision_logs for select to anon using (true);
create policy "allow anon decisions insert" on public.decision_logs for insert to anon with check (true);
create policy "allow anon decisions update" on public.decision_logs for update to anon using (true) with check (true);
create policy "allow anon decisions delete" on public.decision_logs for delete to anon using (true);


-- v14 防除記録
create table if not exists public.pest_control_records (
  id uuid primary key,
  spray_date date not null,
  house text not null,
  pesticide_type text not null,
  target_pest text not null,
  product_name text not null,
  active_ingredient text default '',
  mode_group text not null,
  dilution numeric,
  spray_volume_l numeric,
  preharvest_days integer,
  label_max_uses integer,
  memo text default '',
  created_at timestamptz default now()
);
alter table public.pest_control_records enable row level security;
drop policy if exists "public pest read" on public.pest_control_records;
drop policy if exists "public pest insert" on public.pest_control_records;
create policy "public pest read" on public.pest_control_records for select using (true);
create policy "public pest insert" on public.pest_control_records for insert with check (true);


-- v15 栽培学習ノート
create table if not exists public.cultivation_learning_notes (
  id uuid primary key,
  note_date date not null,
  house text not null,
  learning_text text not null,
  evidence_text text default '',
  created_at timestamptz default now()
);
alter table public.cultivation_learning_notes enable row level security;
drop policy if exists "public learning read" on public.cultivation_learning_notes;
drop policy if exists "public learning insert" on public.cultivation_learning_notes;
create policy "public learning read" on public.cultivation_learning_notes for select using (true);
create policy "public learning insert" on public.cultivation_learning_notes for insert with check (true);

-- v15 失敗・異常データベース
create table if not exists public.cultivation_failure_records (
  id uuid primary key,
  event_date date not null,
  house text not null,
  event_text text not null,
  cause_text text default '',
  response_text text default '',
  created_at timestamptz default now()
);
alter table public.cultivation_failure_records enable row level security;
drop policy if exists "public failure read" on public.cultivation_failure_records;
drop policy if exists "public failure insert" on public.cultivation_failure_records;
create policy "public failure read" on public.cultivation_failure_records for select using (true);
create policy "public failure insert" on public.cultivation_failure_records for insert with check (true);
