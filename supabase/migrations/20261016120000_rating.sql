-- Points (MMR) des parties en ligne classées, et nouveaux classements.
--
-- - player_stats.mmr : points du joueur, 0 au départ, plancher -999. Les
--   comptes existants repartent de 0 (pas de calcul rétroactif).
-- - rating_games : une ligne par partie dont le classement a été décidé
--   (classée ou non, et pourquoi) ; rating_events : une ligne par partie
--   classée et par joueur humain (avant, après, variation), clé unique
--   (partie, joueur).
-- - record_game_rating : appelée par l'Edge Function game-action (rôle
--   service_role) à la fin d'une partie, comme record_game_win. Les montants
--   sont calculés en TypeScript (src/online/rating.ts) ; la fonction les
--   applique une seule fois par partie, revérifie ce qu'elle peut vérifier
--   elle-même (au moins 2 humains, au moins 10 coups joués par des humains,
--   joueurs de la partie, plafond quotidien par paire de joueurs) et verrouille
--   les lignes des joueurs : deux parties qui finissent en même temps ne se
--   marchent pas dessus (variation calculée sur des points périmés : refusée
--   avec « rating_conflict », l'Edge Function relit et recommence).
-- - Les clients ne peuvent rien écrire ; ils lisent le résultat d'une partie
--   avec get_game_rating et leur rang avec get_my_rating.
-- - Classements : « Points », « Victoires », « Série ». Les classements par
--   niveau d'IA quittent get_leaderboards (leurs colonnes restent).

-- Constantes partagées avec src/online/rating.ts --------------------------------

create function public.rating_floor() returns int language sql immutable as $$ select -999 $$;
create function public.rating_min_human_moves() returns int language sql immutable as $$ select 10 $$;
create function public.rating_max_pair_games_per_day() returns int language sql immutable as $$ select 3 $$;

revoke all on function public.rating_floor(), public.rating_min_human_moves(), public.rating_max_pair_games_per_day()
  from public, anon, authenticated;

-- Points ---------------------------------------------------------------------

alter table public.player_stats
  add column mmr integer not null default 0,
  -- Date à laquelle les points ont atteint leur valeur actuelle (départage).
  add column mmr_at timestamptz,
  -- Parties classées jouées : on n'apparaît au classement des points qu'après la première.
  add column ranked_games integer not null default 0,
  add constraint player_stats_mmr_floor check (mmr >= -999),
  add constraint player_stats_ranked_games check (ranked_games >= 0);

comment on column public.player_stats.mmr is 'Points (MMR) des parties en ligne classées ; 0 au départ, plancher -999.';

create table public.rating_games (
  game_id uuid primary key references public.games (id) on delete cascade,
  ranked boolean not null,
  -- Raison d'une partie non classée (codes de src/online/rating.ts).
  reason text,
  -- Jour de Paris de la décision (plafond quotidien par paire de joueurs).
  paris_day date not null default (now() at time zone 'Europe/Paris')::date,
  decided_at timestamptz not null default now(),
  constraint rating_games_reason check (ranked = (reason is null))
);

comment on table public.rating_games is 'Parties en ligne finies dont le classement (points) a été décidé, une fois chacune.';

create table public.rating_events (
  game_id uuid not null references public.rating_games (game_id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  rating_before integer not null,
  rating_after integer not null,
  delta integer not null,
  created_at timestamptz not null default now(),
  primary key (game_id, user_id),
  constraint rating_events_delta check (delta = rating_after - rating_before),
  constraint rating_events_floor check (rating_after >= -999)
);

create index rating_events_user on public.rating_events (user_id);

comment on table public.rating_events is 'Variation des points de chaque joueur humain d''une partie classée (avant, après, delta).';

-- Row Level Security : aucune écriture par les clients ; chacun lit ses propres variations.
alter table public.rating_games enable row level security;
alter table public.rating_events enable row level security;

create policy "Chacun lit ses variations de points"
  on public.rating_events for select
  to authenticated
  using ((select auth.uid()) = user_id);

revoke all on public.rating_games, public.rating_events from anon, authenticated;
grant select on public.rating_events to authenticated;
grant select, insert, update, delete on public.rating_games, public.rating_events to service_role;

-- Appliquer le résultat d'une partie ----------------------------------------------
-- p_changes : [{ "user_id": …, "before": …, "delta": … }, …], une entrée par
-- humain de la partie (variation 0 comprise), ou [] si l'Edge Function juge la
-- partie non classée (p_reason dit pourquoi).
-- Renvoie « ranked », « unranked » ou « already » (déjà décidé : rien ne change).

create function public.record_game_rating(p_game uuid, p_changes jsonb, p_reason text default null)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  g public.games;
  humans uuid[];
  human_indexes int[];
  human_moves int;
  change jsonb;
  locked public.player_stats;
  pair_games int;
  today date := (now() at time zone 'Europe/Paris')::date;
begin
  select * into g from public.games where id = p_game for update;
  if not found or g.status <> 'finished' then
    raise exception 'game_not_finished';
  end if;
  if exists (select 1 from public.rating_games where game_id = p_game) then
    return 'already';
  end if;

  -- Partie jugée non classée par l'Edge Function (moins de 2 humains, aucun humain restant…).
  if p_changes is null or jsonb_array_length(p_changes) = 0 then
    insert into public.rating_games (game_id, ranked, reason) values (p_game, false, coalesce(p_reason, 'unranked'));
    return 'unranked';
  end if;

  -- Humains de la partie au lancement.
  select coalesce(array_agg(user_id order by user_id), '{}'), coalesce(array_agg(player_index), '{}')
    into humans, human_indexes
    from public.room_players
    where room_id = g.room_id and user_id is not null and player_index is not null;
  if cardinality(humans) < 2 then
    insert into public.rating_games (game_id, ranked, reason) values (p_game, false, 'not_enough_humans');
    return 'unranked';
  end if;

  -- Coups joués par des humains (les coups d'IA ne comptent pas).
  select count(*) into human_moves
    from jsonb_array_elements(g.state -> 'history') as h (entry)
    where (h.entry ->> 'player')::int = any (human_indexes);
  if human_moves < public.rating_min_human_moves() then
    insert into public.rating_games (game_id, ranked, reason) values (p_game, false, 'too_few_human_moves');
    return 'unranked';
  end if;

  -- Les variations portent exactement sur les humains de la partie.
  if (select coalesce(array_agg((c ->> 'user_id')::uuid order by (c ->> 'user_id')::uuid), '{}')
        from jsonb_array_elements(p_changes) as c) <> humans then
    raise exception 'bad_request';
  end if;

  -- Verrou des lignes des joueurs, toujours dans le même ordre (pas d'interblocage).
  insert into public.player_stats (user_id) select unnest(humans) on conflict (user_id) do nothing;
  perform 1 from public.player_stats where user_id = any (humans) order by user_id for update;

  -- Plafond : au plus 3 parties classées par jour (Paris) entre deux mêmes comptes.
  select coalesce(max(n), 0) into pair_games from (
    select count(*) as n
      from public.rating_events a
      join public.rating_events b on b.game_id = a.game_id and b.user_id > a.user_id
      join public.rating_games rg on rg.game_id = a.game_id and rg.ranked and rg.paris_day = today
      where a.user_id = any (humans) and b.user_id = any (humans)
      group by a.user_id, b.user_id
  ) pairs;
  if pair_games >= public.rating_max_pair_games_per_day() then
    insert into public.rating_games (game_id, ranked, reason) values (p_game, false, 'pair_daily_limit');
    return 'unranked';
  end if;

  -- Variations calculées sur les points actuels ? Sinon, l'Edge Function relit et recommence.
  for change in select * from jsonb_array_elements(p_changes) loop
    select * into locked from public.player_stats where user_id = (change ->> 'user_id')::uuid;
    if locked.mmr <> (change ->> 'before')::int then
      raise exception 'rating_conflict';
    end if;
  end loop;

  insert into public.rating_games (game_id, ranked, paris_day) values (p_game, true, today);
  for change in select * from jsonb_array_elements(p_changes) loop
    with updated as (
      update public.player_stats set
          mmr = greatest(public.rating_floor(), mmr + (change ->> 'delta')::int),
          mmr_at = case when (change ->> 'delta')::int <> 0 then now() else coalesce(mmr_at, now()) end,
          ranked_games = ranked_games + 1
        where user_id = (change ->> 'user_id')::uuid
        returning user_id, (change ->> 'before')::int as before, mmr as after
    )
    insert into public.rating_events (game_id, user_id, rating_before, rating_after, delta)
      select p_game, u.user_id, u.before, u.after, u.after - u.before from updated u;
  end loop;
  return 'ranked';
end;
$$;

revoke all on function public.record_game_rating(uuid, jsonb, text) from public, anon, authenticated;
grant execute on function public.record_game_rating(uuid, jsonb, text) to service_role;

-- Lire le résultat d'une partie (écran de fin) ---------------------------------------
-- status : « pending » (pas encore décidé), « ranked » ou « unranked ».
-- delta et rating_after : la variation du joueur connecté (null hors partie classée).

create function public.get_game_rating(p_game uuid)
returns table (status text, delta int, rating_after int)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  me uuid := public.require_player();
  rg public.rating_games;
  ev public.rating_events;
begin
  -- Seuls les joueurs de la partie y ont accès.
  if not exists (
    select 1 from public.games gm join public.room_players rp on rp.room_id = gm.room_id
    where gm.id = p_game and rp.user_id = me
  ) then
    raise exception 'room_not_found';
  end if;
  select * into rg from public.rating_games where game_id = p_game;
  if not found then
    return query select 'pending'::text, null::int, null::int;
    return;
  end if;
  if not rg.ranked then
    return query select 'unranked'::text, null::int, null::int;
    return;
  end if;
  select * into ev from public.rating_events where game_id = p_game and user_id = me;
  if not found then
    return query select 'unranked'::text, null::int, null::int;
    return;
  end if;
  return query select 'ranked'::text, ev.delta, ev.rating_after;
end;
$$;

revoke all on function public.get_game_rating(uuid) from public, anon;
grant execute on function public.get_game_rating(uuid) to authenticated;

-- Points et rang du joueur connecté (profil) ---------------------------------------
-- rank : null pour un invité (exclu des classements) ou avant la première partie classée.

create function public.points_ranking()
returns table (user_id uuid, rank int)
language sql
stable
security definer
set search_path = ''
as $$
  select s.user_id, row_number() over (
      order by s.mmr desc, s.mmr_at asc nulls last, lower(p.pseudo), p.pseudo, p.id
    )::int
    from public.player_stats s
    join public.profiles p on p.id = s.user_id
    join auth.users u on u.id = s.user_id and not u.is_anonymous
    where s.ranked_games > 0;
$$;

revoke all on function public.points_ranking() from public, anon, authenticated;

create function public.get_my_rating()
returns table (mmr int, rank int, ranked_games int)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  me uuid := public.require_player();
begin
  return query
    select coalesce(s.mmr, 0), r.rank, coalesce(s.ranked_games, 0)
    from (select me as id) m
    left join public.player_stats s on s.user_id = m.id
    left join public.points_ranking() r on r.user_id = m.id;
end;
$$;

revoke all on function public.get_my_rating() from public, anon;
grant execute on function public.get_my_rating() to authenticated;

-- Classements : Points, Victoires, Série --------------------------------------------
-- Même signature et mêmes colonnes qu'avant. Les points peuvent être négatifs :
-- on figure au classement des points dès sa première partie classée.

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
  if exists (select 1 from auth.users u where u.id = me and u.is_anonymous) then
    raise exception 'guest_not_ranked';
  end if;

  return query
  with boards (board) as (
    values ('points'), ('wins'), ('best_streak')
  ),
  scores as (
    select p.id, p.pseudo, coalesce(p.avatar, p.id::text) as avatar, b.board, b.score, b.reached_at
    from public.player_stats s
    join public.profiles p on p.id = s.user_id
    -- Invités exclus : seuls les comptes e-mail sont classés.
    join auth.users u on u.id = s.user_id and not u.is_anonymous
    cross join lateral (values
      ('points', s.mmr, s.mmr_at, s.ranked_games > 0),
      ('wins', s.wins, s.wins_at, s.wins > 0),
      ('best_streak', s.best_streak, s.best_streak_at, s.best_streak > 0)
    ) as b (board, score, reached_at, listed)
    where b.listed
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
  -- Pas encore dans ce classement : ligne du joueur sans rang.
  select b.board, null::int, p.pseudo, coalesce(p.avatar, p.id::text),
      case when b.board = 'points' then coalesce((select s.mmr from public.player_stats s where s.user_id = me), 0) else 0 end,
      true
    from boards b
    join public.profiles p on p.id = me
    where not exists (select 1 from ranked r where r.board = b.board and r.id = me)
  order by 1, 2 nulls last;
end;
$$;

revoke all on function public.get_leaderboards() from public, anon;
grant execute on function public.get_leaderboards() to authenticated;
