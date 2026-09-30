-- Classements : le classement « Parties lancées » est retiré. Il en reste cinq :
-- victoires (toutes confondues), halls des débutants, des confirmés et des pros,
-- et série de connexion (la plus haute atteinte).
--
-- Le nombre de parties lancées reste compté (player_stats.games_started et
-- games_started_at, incrémentés par begin_game) et reste lisible par chaque
-- joueur pour lui-même (profil) : seule get_leaderboards change. Même
-- signature et mêmes colonnes de sortie qu'avant.

create or replace function public.get_leaderboards()
returns table (board text, rank int, pseudo text, avatar text, score int, is_me boolean)
language plpgsql
stable
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  me uuid := public.require_player();
begin
  return query
  with boards (board) as (
    values ('wins'), ('wins_easy'), ('wins_medium'), ('wins_hard'), ('best_streak')
  ),
  scores as (
    select p.id, p.pseudo, coalesce(p.avatar, p.id::text) as avatar, b.board, b.score, b.reached_at
    from public.player_stats s
    join public.profiles p on p.id = s.user_id
    cross join lateral (values
      ('wins', s.wins, s.wins_at),
      ('wins_easy', s.wins_easy, s.wins_easy_at),
      ('wins_medium', s.wins_medium, s.wins_medium_at),
      ('wins_hard', s.wins_hard, s.wins_hard_at),
      ('best_streak', s.best_streak, s.best_streak_at)
    ) as b (board, score, reached_at)
    where b.score > 0
  ),
  ranked as (
    select sc.*, row_number() over (
      partition by sc.board
      order by sc.score desc, sc.reached_at asc nulls last, lower(sc.pseudo), sc.pseudo, sc.id
    )::int as position
    from scores sc
  )
  select r.board, r.position, r.pseudo, r.avatar, r.score, r.id = me
    from ranked r
    where r.position <= 50 or r.id = me
  union all
  -- Pas encore de score dans ce classement : ligne du joueur sans rang.
  select b.board, null::int, p.pseudo, coalesce(p.avatar, p.id::text), 0, true
    from boards b
    join public.profiles p on p.id = me
    where not exists (select 1 from ranked r where r.board = b.board and r.id = me)
  order by 1, 2 nulls last;
end;
$$;

revoke all on function public.get_leaderboards() from public, anon;
grant execute on function public.get_leaderboards() to authenticated;
