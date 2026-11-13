-- LIFE WORLD: минимальная общая база комнат.
-- Вставьте весь файл в Supabase → SQL Editor → New query → Run.
create table if not exists public.game_rooms (
  room_code text primary key,
  state jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.game_rooms enable row level security;

drop policy if exists "Room access by code" on public.game_rooms;
create policy "Room access by code"
on public.game_rooms
for all
to anon, authenticated
using (true)
with check (true);

alter publication supabase_realtime add table public.game_rooms;
