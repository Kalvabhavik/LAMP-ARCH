-- The leaderboard is readable by authenticated players, but only server-side security-definer
-- triggers maintain it. Clients cannot insert, update, or delete leaderboard rows.

create table public.leaderboard (
  player_id uuid primary key references public.players(id) on delete cascade,
  player_name text not null,
  total_points integer not null default 0,
  quest_score integer not null default 0,
  training_xp integer not null default 0,
  achievements_count integer not null default 0,
  updated_at timestamptz not null default now()
);

create index leaderboard_total_points_updated_at_idx
  on public.leaderboard (total_points desc, updated_at asc);

create or replace function public.refresh_leaderboard(p_player uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.leaderboard (
    player_id, player_name, total_points, quest_score, training_xp, achievements_count, updated_at
  )
  select
    p.id,
    p.name,
    p.score + xp.training_xp,
    p.score,
    xp.training_xp,
    (select count(*)::integer from public.achievements a where a.player_id = p.id),
    now()
  from public.players p
  cross join lateral (
    select case
      when jsonb_typeof(p.metadata->'training'->'xp') = 'number'
        then (p.metadata->'training'->>'xp')::numeric::integer
      else 0
    end as training_xp
  ) xp
  where p.id = p_player
  on conflict (player_id) do update set
    player_name = excluded.player_name,
    total_points = excluded.total_points,
    quest_score = excluded.quest_score,
    training_xp = excluded.training_xp,
    achievements_count = excluded.achievements_count,
    updated_at = now();
end;
$$;

create or replace function public.refresh_leaderboard_after_player_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.refresh_leaderboard(new.id);
  return new;
end;
$$;

create trigger leaderboard_after_player_change
after insert or update of name, score, metadata on public.players
for each row execute function public.refresh_leaderboard_after_player_change();

create or replace function public.refresh_leaderboard_after_achievement_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'DELETE' then
    perform public.refresh_leaderboard(old.player_id);
    return old;
  end if;
  perform public.refresh_leaderboard(new.player_id);
  return new;
end;
$$;

create trigger leaderboard_after_achievement_change
after insert or delete on public.achievements
for each row execute function public.refresh_leaderboard_after_achievement_change();

revoke all on function public.refresh_leaderboard(uuid) from public, anon, authenticated;
revoke all on function public.refresh_leaderboard_after_player_change() from public, anon, authenticated;
revoke all on function public.refresh_leaderboard_after_achievement_change() from public, anon, authenticated;

select public.refresh_leaderboard(p.id) from public.players p;

alter table public.leaderboard enable row level security;
revoke insert, update, delete, truncate on public.leaderboard from anon, authenticated;
grant select on public.leaderboard to authenticated, service_role;

create policy "leaderboard: public read" on public.leaderboard
  for select to authenticated using (true);
