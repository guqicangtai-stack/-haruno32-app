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
