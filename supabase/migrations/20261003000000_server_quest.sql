-- LAMP: The Server Quest — core schema.
-- Players authenticate with Supabase anonymous auth; players.id = auth.users.id.
-- Clients may only READ their own rows. Every write goes through Next.js API routes
-- that use the service-role key, so scores, unlocks and validation results cannot be forged.

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------- tables

create table public.players (
  id uuid primary key references auth.users (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 40),
  gender text not null check (gender in ('male', 'female')),
  current_level integer not null default 1 check (current_level >= 1),
  current_location text not null default 'home' check (char_length(current_location) <= 40),
  completed_missions text[] not null default '{}',
  score integer not null default 0 check (score >= 0),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now()
);

create table public.missions (
  id text primary key,
  company text not null,
  level integer not null,
  title text not null,
  description text not null,
  difficulty text not null,
  instructions jsonb not null default '{}'::jsonb,
  expected_submission_type text[] not null default '{}',
  created_at timestamptz not null default now()
);

create table public.game_progress (
  id uuid primary key default gen_random_uuid(),
  player_id uuid not null references public.players (id) on delete cascade,
  milestone text not null check (char_length(milestone) <= 80),
  level integer not null,
  location text not null,
  status text not null default 'completed' check (status in ('in_progress', 'completed')),
  metadata jsonb not null default '{}'::jsonb,
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  unique (player_id, milestone)
);

create table public.submissions (
  id uuid primary key default gen_random_uuid(),
  player_id uuid not null references public.players (id) on delete cascade,
  mission_id text not null references public.missions (id),
  attempt integer not null check (attempt >= 1),
  file_name text check (char_length(file_name) <= 200),
  -- Storage object path inside the private bucket (never a public URL). Signed URLs are issued on demand.
  file_url text,
  file_size integer check (file_size >= 0),
  mime_type text,
  submission_text text check (char_length(submission_text) <= 100000),
  status text not null default 'checking' check (status in ('checking', 'passed', 'needs_improvement', 'error')),
  score integer check (score between 0 and 100),
  feedback jsonb not null default '{}'::jsonb,
  submitted_at timestamptz not null default now(),
  checked_at timestamptz,
  unique (player_id, mission_id, attempt)
);

create table public.procedures (
  id uuid primary key default gen_random_uuid(),
  player_id uuid not null references public.players (id) on delete cascade,
  mission_id text not null references public.missions (id),
  attempt integer not null check (attempt >= 1),
  format text not null check (format in ('text', 'markdown', 'pdf', 'txt')),
  procedure_text text check (char_length(procedure_text) <= 100000),
  file_url text,
  file_name text check (char_length(file_name) <= 200),
  status text not null default 'checking' check (status in ('checking', 'accepted', 'needs_improvement', 'error')),
  score integer check (score between 0 and 100),
  feedback jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  reviewed_at timestamptz,
  unique (player_id, mission_id, attempt)
);

create table public.achievements (
  id uuid primary key default gen_random_uuid(),
  player_id uuid not null references public.players (id) on delete cascade,
  achievement_key text not null,
  achievement_name text not null,
  description text not null,
  unlocked_at timestamptz not null default now(),
  unique (player_id, achievement_key)
);

create table public.hint_unlocks (
  player_id uuid not null references public.players (id) on delete cascade,
  mission_id text not null references public.missions (id),
  hint_index integer not null check (hint_index >= 0),
  unlocked_at timestamptz not null default now(),
  primary key (player_id, mission_id, hint_index)
);

create table public.score_events (
  id uuid primary key default gen_random_uuid(),
  player_id uuid not null references public.players (id) on delete cascade,
  mission_id text references public.missions (id),
  reason text not null,
  delta integer not null,
  created_at timestamptz not null default now()
);

create index game_progress_player_idx on public.game_progress (player_id);
create index submissions_player_mission_idx on public.submissions (player_id, mission_id, submitted_at desc);
create index procedures_player_mission_idx on public.procedures (player_id, mission_id, created_at desc);
create index achievements_player_idx on public.achievements (player_id);
create index score_events_player_idx on public.score_events (player_id, created_at desc);

-- ---------------------------------------------------------------- triggers / functions

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger players_touch_updated_at
before update on public.players
for each row execute function public.touch_updated_at();

-- Atomic score change + audit row. Only callable by the service role.
create or replace function public.award_score(p_player uuid, p_delta integer, p_reason text, p_mission text default null)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  new_score integer;
begin
  update public.players
     set score = greatest(0, score + p_delta)
   where id = p_player
  returning score into new_score;

  if new_score is null then
    raise exception 'player % not found', p_player;
  end if;

  insert into public.score_events (player_id, mission_id, reason, delta)
  values (p_player, p_mission, p_reason, p_delta);

  return new_score;
end;
$$;

revoke all on function public.award_score(uuid, integer, text, text) from public, anon, authenticated;
grant execute on function public.award_score(uuid, integer, text, text) to service_role;

-- ---------------------------------------------------------------- row level security

alter table public.players enable row level security;
alter table public.missions enable row level security;
alter table public.game_progress enable row level security;
alter table public.submissions enable row level security;
alter table public.procedures enable row level security;
alter table public.achievements enable row level security;
alter table public.hint_unlocks enable row level security;
alter table public.score_events enable row level security;

-- Clients never write directly; the service role bypasses RLS.
revoke insert, update, delete, truncate on
  public.players, public.missions, public.game_progress, public.submissions,
  public.procedures, public.achievements, public.hint_unlocks, public.score_events
from anon, authenticated;

grant select on
  public.players, public.game_progress, public.submissions,
  public.procedures, public.achievements, public.hint_unlocks, public.score_events
to authenticated;
grant select on public.missions to anon, authenticated;

create policy "players: read own row" on public.players
  for select to authenticated using ((select auth.uid()) = id);

create policy "missions: public catalog" on public.missions
  for select to anon, authenticated using (true);

create policy "game_progress: read own" on public.game_progress
  for select to authenticated using ((select auth.uid()) = player_id);

create policy "submissions: read own" on public.submissions
  for select to authenticated using ((select auth.uid()) = player_id);

create policy "procedures: read own" on public.procedures
  for select to authenticated using ((select auth.uid()) = player_id);

create policy "achievements: read own" on public.achievements
  for select to authenticated using ((select auth.uid()) = player_id);

create policy "hint_unlocks: read own" on public.hint_unlocks
  for select to authenticated using ((select auth.uid()) = player_id);

create policy "score_events: read own" on public.score_events
  for select to authenticated using ((select auth.uid()) = player_id);

-- ---------------------------------------------------------------- storage

-- Private bucket; objects are written only by the server (service role) under <player_id>/<mission_id>/...
insert into storage.buckets (id, name, public, file_size_limit)
values ('submissions', 'submissions', false, 10485760)
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit;

create policy "submissions bucket: read own folder" on storage.objects
  for select to authenticated
  using (bucket_id = 'submissions' and (storage.foldername(name))[1] = (select auth.uid())::text);

-- ---------------------------------------------------------------- mission catalog
-- Full mission content and validation rules live in src/content/quest/missions/*.ts.
-- These rows exist for referential integrity and as a queryable catalog.

insert into public.missions (id, company, level, title, description, difficulty, instructions, expected_submission_type)
values
  ('BF-001', 'byteforge', 1, 'Deploy a Student Portal',
   'Build a basic LAMP environment and a PHP page that lists students from MySQL through Apache.',
   'Beginner', '{"source": "src/content/quest/missions/bf-001.ts"}'::jsonb,
   array['.zip', '.txt', '.md', '.pdf', '.docx', '.php', '.sql', '.sh', '.conf']),
  ('NC-001', 'nexacore', 2, 'Production LAMP Deployment',
   'Deploy a PHP application with authentication on a hardened production LAMP server.',
   'Advanced', '{"source": "src/content/quest/missions/nc-001.ts"}'::jsonb,
   array['.zip', '.txt', '.md', '.pdf', '.docx', '.php', '.sql', '.sh', '.conf', '.ini'])
on conflict (id) do update set
  company = excluded.company,
  level = excluded.level,
  title = excluded.title,
  description = excluded.description,
  difficulty = excluded.difficulty,
  instructions = excluded.instructions,
  expected_submission_type = excluded.expected_submission_type;
