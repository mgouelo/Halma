-- Statistiques des joueurs et classements publics.
--
-- Intégrité (le classement est public) :
-- - les clients ne peuvent RIEN écrire dans player_stats ni dans stats_wins ;
-- - « parties lancées » est compté par begin_game (appelée par l'Edge Function
--   game-action quand l'hôte lance une partie en ligne) : +1 pour chaque humain ;
-- - les victoires sont comptées par record_game_win, appelée par l'Edge
--   Function après l'écriture d'une partie finie. La fonction relit la partie
--   elle-même : seule une fin « win » d'un joueur humain compte, une seule fois
--   par partie (table stats_wins) ;
-- - la série de connexion est tenue par record_daily_login, appelée par
--   l'application à l'ouverture : le jour vient de l'horloge du serveur
--   (fuseau Europe/Paris), jamais du client ;
-- - les classements se lisent avec get_leaderboards (joueurs connectés,
--   invités compris) : pseudo, avatar, score et rang seulement.
--
-- Les parties locales (hors ligne) ne comptent pas : elles se jouent sur
-- l'appareil, le serveur ne peut pas les vérifier.

-- Statistiques ---------------------------------------------------------------

create table public.player_stats (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  -- Victoires en ligne, toutes confondues.
  wins integer not null default 0,
  -- Victoires dans une partie avec au moins une IA, rangées selon l'IA la plus forte.
  wins_easy integer not null default 0,
  wins_medium integer not null default 0,
  wins_hard integer not null default 0,
  -- Parties en ligne lancées (le joueur était dans la room au lancement).
  games_started integer not null default 0,
  -- Série de jours de connexion consécutifs (jour calendaire, Europe/Paris).
  current_streak integer not null default 0,
  best_streak integer not null default 0,
  last_login_day date,
  -- Date à laquelle chaque score a atteint sa valeur actuelle : à score égal,
  -- le premier arrivé est devant.
  wins_at timestamptz,
  wins_easy_at timestamptz,
  wins_medium_at timestamptz,
  wins_hard_at timestamptz,
  games_started_at timestamptz,
  best_streak_at timestamptz,
  updated_at timestamptz not null default now(),
  constraint player_stats_non_negative check (
    wins >= 0 and wins_easy >= 0 and wins_medium >= 0 and wins_hard >= 0
    and games_started >= 0 and current_streak >= 0 and best_streak >= current_streak
  ),
  constraint player_stats_ai_wins check (wins_easy + wins_medium + wins_hard <= wins)
);

comment on table public.player_stats is
  'Statistiques publiques de chaque joueur (classements), écrites uniquement par des fonctions serveur.';

-- Victoires déjà comptées : une ligne par partie (idempotence).
create table public.stats_wins (
  game_id uuid primary key references public.games (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  -- Niveau de l'IA la plus forte de la partie, ou null sans IA.
  ai_level text,
  recorded_at timestamptz not null default now(),
  constraint stats_wins_ai_level check (ai_level in ('easy', 'medium', 'hard'))
);

comment on table public.stats_wins is 'Victoires en ligne déjà comptées dans player_stats (une par partie).';

create trigger player_stats_touch before update on public.player_stats
  for each row execute function public.touch_updated_at();

-- Row Level Security ------------------------------------------------------

alter table public.player_stats enable row level security;
alter table public.stats_wins enable row level security;

-- Chacun lit ses propres statistiques (profil) ; les autres ne se lisent
-- qu'à travers get_leaderboards.
create policy "Chacun lit ses statistiques"
  on public.player_stats for select
  to authenticated
  using ((select auth.uid()) = user_id);

-- Aucune politique d'écriture, et aucun droit d'écriture pour les clients.
revoke all on public.player_stats, public.stats_wins from anon, authenticated;
grant select on public.player_stats to authenticated;
grant select, insert, update, delete on public.player_stats, public.stats_wins to service_role;

-- Parties lancées ------------------------------------------------------------
-- begin_game (migration rooms) compte désormais une partie lancée pour chaque
-- joueur humain, dans la même transaction que le lancement.

create or replace function public.begin_game(p_room uuid, p_host uuid, p_state jsonb)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  r public.rooms;
  participants int;
  game_id uuid;
begin
  select * into r from public.rooms where id = p_room for update;
  if not found then
    raise exception 'room_not_found';
  end if;
  if r.host_id <> p_host then
    raise exception 'not_host';
  end if;
  if r.status <> 'waiting' then
    raise exception 'room_started';
  end if;
  select count(*) into participants from public.room_players where room_id = p_room;
  if participants < 2 or participants > 6 then
    raise exception 'not_enough_players';
  end if;
  if jsonb_array_length(p_state -> 'players') <> participants then
    raise exception 'bad_request';
  end if;

  update public.room_players rp set player_index = ranked.idx
    from (
      select id, (row_number() over (order by seat) - 1)::smallint as idx
      from public.room_players where room_id = p_room
    ) ranked
    where rp.id = ranked.id;
  insert into public.games (room_id, state) values (p_room, p_state) returning id into game_id;
  update public.rooms set status = 'playing' where id = p_room;

  -- Statistiques : une partie lancée de plus pour chaque humain de la room.
  -- Une room ne se lance qu'une fois (statut vérifié ci-dessus, ligne verrouillée).
  insert into public.player_stats as s (user_id, games_started, games_started_at)
    select user_id, 1, now() from public.room_players where room_id = p_room and user_id is not null
    on conflict (user_id) do update set games_started = s.games_started + 1, games_started_at = now();
  return game_id;
end;
$$;

revoke all on function public.begin_game(uuid, uuid, jsonb) from public, anon, authenticated;
grant execute on function public.begin_game(uuid, uuid, jsonb) to service_role;

-- Victoires ------------------------------------------------------------------

-- Rang d'un niveau d'IA (plus grand = plus fort), pour trouver l'IA la plus forte.
create function public.ai_level_rank(level text)
returns int
language sql
immutable
set search_path = ''
as $$
  select case level when 'easy' then 1 when 'medium' then 2 when 'hard' then 3 end;
$$;

revoke all on function public.ai_level_rank(text) from public, anon, authenticated;

-- Compte la victoire d'une partie en ligne finie. Tout est relu dans la base :
-- - la partie doit être finie avec end_reason = 'win' (pas un forfait ni un abandon) ;
-- - le vainqueur doit être un joueur humain (une IA qui gagne ne compte pour personne) ;
-- - la victoire est rangée selon l'IA la plus forte de la partie, s'il y en a une.
-- Idempotent : une partie n'est comptée qu'une fois (clé primaire de stats_wins),
-- même si l'Edge Function rappelle la fonction. Renvoie vrai si la victoire
-- vient d'être comptée.
create function public.record_game_win(p_game uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  g public.games;
  winner_id uuid;
  level text;
begin
  select * into g from public.games where id = p_game;
  if not found or g.status <> 'finished' or g.end_reason is distinct from 'win' or g.winner is null
     or g.winner = any (g.forfeited) then
    return false;
  end if;
  select user_id into winner_id from public.room_players
    where room_id = g.room_id and player_index = g.winner;
  if winner_id is null then
    return false;
  end if;
  select ai_level into level from public.room_players
    where room_id = g.room_id and ai_level is not null and player_index is not null
    order by public.ai_level_rank(ai_level) desc
    limit 1;

  insert into public.stats_wins (game_id, user_id, ai_level) values (p_game, winner_id, level)
    on conflict (game_id) do nothing;
  if not found then
    return false;
  end if;

  insert into public.player_stats (user_id) values (winner_id)
    on conflict (user_id) do nothing;
  update public.player_stats set
      wins = wins + 1,
      wins_at = now(),
      wins_easy = wins_easy + coalesce(level = 'easy', false)::int,
      wins_easy_at = case when level = 'easy' then now() else wins_easy_at end,
      wins_medium = wins_medium + coalesce(level = 'medium', false)::int,
      wins_medium_at = case when level = 'medium' then now() else wins_medium_at end,
      wins_hard = wins_hard + coalesce(level = 'hard', false)::int,
      wins_hard_at = case when level = 'hard' then now() else wins_hard_at end
    where user_id = winner_id;
  return true;
end;
$$;

revoke all on function public.record_game_win(uuid) from public, anon, authenticated;
grant execute on function public.record_game_win(uuid) to service_role;

-- Série de connexion -----------------------------------------------------------

-- Fait avancer la série de `p_user` pour le jour `p_day` :
-- - même jour que la dernière connexion : rien ;
-- - jour suivant : série + 1 ;
-- - plus d'un jour manqué (ou première connexion) : la série repart à 1.
-- La meilleure série suit. Interne : les clients passent par
-- record_daily_login, qui fixe le jour lui-même (aucune date venant du client).
create function public.advance_login_streak(p_user uuid, p_day date)
returns public.player_stats
language plpgsql
security definer
set search_path = ''
as $$
declare
  s public.player_stats;
  next_streak int;
begin
  insert into public.player_stats (user_id) values (p_user) on conflict (user_id) do nothing;
  select * into s from public.player_stats where user_id = p_user for update;
  -- Même jour, ou jour antérieur (horloge qui recule) : rien ne change.
  if s.last_login_day is not null and p_day <= s.last_login_day then
    return s;
  end if;
  if s.last_login_day = p_day - 1 then
    next_streak := s.current_streak + 1;
  else
    next_streak := 1;
  end if;
  update public.player_stats set
      current_streak = next_streak,
      last_login_day = p_day,
      best_streak = greatest(best_streak, next_streak),
      best_streak_at = case when next_streak > best_streak then now() else best_streak_at end
    where user_id = p_user
    returning * into s;
  return s;
end;
$$;

revoke all on function public.advance_login_streak(uuid, date) from public, anon, authenticated;

-- Connexion du jour, appelée à l'ouverture de l'application par un joueur
-- connecté (invités compris). Renvoie la série actuelle et la meilleure.
create function public.record_daily_login()
returns table (current_streak int, best_streak int)
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := public.require_player();
  s public.player_stats;
begin
  s := public.advance_login_streak(me, (now() at time zone 'Europe/Paris')::date);
  return query select s.current_streak, s.best_streak;
end;
$$;

revoke all on function public.record_daily_login() from public, anon;
grant execute on function public.record_daily_login() to authenticated;

-- Classements -----------------------------------------------------------------

-- Les six classements : les 50 premiers de chacun, plus la ligne du joueur
-- connecté s'il est plus loin (ou s'il n'a pas encore de score : rang null,
-- score 0). Seuls les scores positifs sont classés. À score égal, le premier
-- à l'avoir atteint passe devant, puis l'ordre alphabétique des pseudos.
--
-- Colonnes : pseudo, avatar (profiles.avatar, ou à défaut l'identifiant qui
-- sert de graine à l'avatar par défaut), score, rang, et is_me pour la ligne
-- du joueur. Rien d'autre n'est révélé.
create function public.get_leaderboards()
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
    values ('wins'), ('wins_easy'), ('wins_medium'), ('wins_hard'), ('games_started'), ('best_streak')
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
      ('games_started', s.games_started, s.games_started_at),
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
