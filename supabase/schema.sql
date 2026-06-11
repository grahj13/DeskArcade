-- DeskArcade leaderboard schema
-- Run this in Supabase → SQL Editor after creating your project.

create table if not exists public.game_leaderboard_entries (
  id bigint generated always as identity primary key,
  game_slug text not null,
  board_key text not null default 'default',
  initials text not null check (initials ~ '^[A-Z0-9]{3}$'),
  score bigint not null check (score >= 0),
  created_at timestamptz not null default now()
);

create index if not exists idx_leaderboard_game_board_score_desc
  on public.game_leaderboard_entries (game_slug, board_key, score desc);

create index if not exists idx_leaderboard_game_board_score_asc
  on public.game_leaderboard_entries (game_slug, board_key, score asc);

alter table public.game_leaderboard_entries enable row level security;

-- Anyone can read the public hall of fame
create policy "leaderboard_public_read"
  on public.game_leaderboard_entries
  for select
  to anon, authenticated
  using (true);

-- Inserts only through the RPC function (security definer)
revoke insert, update, delete on public.game_leaderboard_entries from anon, authenticated;

-- Returns whether a score qualifies for the top 10
create or replace function public.leaderboard_qualifies(
  p_game_slug text,
  p_board_key text default 'default',
  p_score bigint default 0,
  p_higher_is_better boolean default true
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  entry_count int;
  cutoff bigint;
begin
  if p_game_slug is null or length(trim(p_game_slug)) = 0 then
    return false;
  end if;

  select count(*)::int into entry_count
  from game_leaderboard_entries
  where game_slug = p_game_slug and board_key = coalesce(p_board_key, 'default');

  if entry_count < 10 then
    return true;
  end if;

  if p_higher_is_better then
    select min(score) into cutoff
    from (
      select score
      from game_leaderboard_entries
      where game_slug = p_game_slug and board_key = coalesce(p_board_key, 'default')
      order by score desc
      limit 10
    ) top10;
    return p_score > cutoff;
  else
    select max(score) into cutoff
    from (
      select score
      from game_leaderboard_entries
      where game_slug = p_game_slug and board_key = coalesce(p_board_key, 'default')
      order by score asc
      limit 10
    ) top10;
    return p_score < cutoff;
  end if;
end;
$$;

-- Submit a score with 3-character arcade initials
create or replace function public.submit_leaderboard_score(
  p_game_slug text,
  p_board_key text default 'default',
  p_initials text default '',
  p_score bigint default 0,
  p_higher_is_better boolean default true
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  clean_initials text;
begin
  clean_initials := upper(trim(coalesce(p_initials, '')));

  if clean_initials !~ '^[A-Z0-9]{3}$' then
    return jsonb_build_object('ok', false, 'error', 'invalid_initials');
  end if;

  if p_score is null or p_score < 0 then
    return jsonb_build_object('ok', false, 'error', 'invalid_score');
  end if;

  if not public.leaderboard_qualifies(p_game_slug, p_board_key, p_score, p_higher_is_better) then
    return jsonb_build_object('ok', false, 'qualified', false);
  end if;

  insert into game_leaderboard_entries (game_slug, board_key, initials, score)
  values (p_game_slug, coalesce(p_board_key, 'default'), clean_initials, p_score);

  return jsonb_build_object('ok', true, 'qualified', true);
end;
$$;

grant execute on function public.leaderboard_qualifies(text, text, bigint, boolean) to anon, authenticated;
grant execute on function public.submit_leaderboard_score(text, text, text, bigint, boolean) to anon, authenticated;
