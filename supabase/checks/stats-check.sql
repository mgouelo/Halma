-- Vérifications de la migration player_stats (statistiques et classements).
-- À lancer après auth-stub.sql et les migrations : voir scripts/check-db.sh.
-- Chaque vérification lève une exception en cas d'échec.

\set ON_ERROR_STOP on
\o /dev/null

-- Exécute `statement` et vérifie qu'il échoue avec le message ou le SQLSTATE `expected`.
create function pg_temp.expect_error(statement text, expected text)
returns void
language plpgsql
as $$
begin
  execute statement;
  raise exception 'aurait dû échouer (%) : %', expected, statement;
exception when others then
  if sqlerrm like 'aurait dû échouer%' then
    raise;
  end if;
  if sqlerrm <> expected and sqlstate <> expected then
    raise exception 'erreur inattendue pour « % » : % (%), attendu %', statement, sqlerrm, sqlstate, expected;
  end if;
end;
$$;

-- Partie finie, écrite directement (comme par l'Edge Function) : humains aux
-- premières places, puis les IA ; renvoie l'identifiant de la partie.
create function pg_temp.finished_game(humans uuid[], ais text[], winner int, reason text)
returns uuid
language plpgsql
as $$
declare
  room uuid;
  game uuid;
  i int;
  n_humans int := coalesce(array_length(humans, 1), 0);
begin
  insert into public.rooms (code, host_id, status) values (public.generate_room_code(), humans[1], 'playing')
    returning id into room;
  for i in 1 .. n_humans loop
    insert into public.room_players (room_id, seat, user_id, player_index) values (room, i - 1, humans[i], i - 1);
  end loop;
  for i in 1 .. coalesce(array_length(ais, 1), 0) loop
    insert into public.room_players (room_id, seat, ai_level, player_index)
      values (room, n_humans + i - 1, ais[i], n_humans + i - 1);
  end loop;
  insert into public.games (room_id, state) values (room, '{}') returning id into game;
  update public.games set status = 'finished', winner = finished_game.winner, end_reason = reason where id = game;
  return game;
end;
$$;

create function pg_temp.stats(who uuid)
returns public.player_stats
language sql
as $$ select * from public.player_stats where user_id = who $$;

-- Joueurs : Hugo, Iris, Jules (e-mail) et un invité.
insert into auth.users (id, email, raw_user_meta_data) values
  ('a2000000-0000-0000-0000-000000000001', 'hugo@example.com', '{"pseudo": "Hugo"}'),
  ('b2000000-0000-0000-0000-000000000002', 'iris@example.com', '{"pseudo": "Iris"}'),
  ('c2000000-0000-0000-0000-000000000003', 'jules@example.com', '{"pseudo": "Jules"}');
insert into auth.users (id, is_anonymous) values ('d2000000-0000-0000-0000-000000000004', true);

create temporary table ids (name text primary key, id uuid);
grant all on ids to authenticated, service_role;

-- Droits ------------------------------------------------------------------------

-- Non connecté : rien.
set role anon;
select pg_temp.expect_error('select * from public.player_stats', '42501');
select pg_temp.expect_error('select * from public.record_daily_login()', '42501');
select pg_temp.expect_error('select * from public.get_leaderboards()', '42501');
reset role;

-- Connecté : aucune écriture, aucune fonction interne.
set role authenticated;
set request.jwt.claim.sub = 'a2000000-0000-0000-0000-000000000001';
select pg_temp.expect_error($$insert into public.player_stats (user_id, wins) values ('a2000000-0000-0000-0000-000000000001', 99)$$, '42501');
select pg_temp.expect_error($$update public.player_stats set wins = 99$$, '42501');
select pg_temp.expect_error($$delete from public.player_stats$$, '42501');
select pg_temp.expect_error($$select * from public.stats_wins$$, '42501');
select pg_temp.expect_error($$insert into public.stats_wins (game_id, user_id) values (gen_random_uuid(), 'a2000000-0000-0000-0000-000000000001')$$, '42501');
select pg_temp.expect_error($$select public.record_game_win(gen_random_uuid())$$, '42501');
select pg_temp.expect_error($$select public.advance_login_streak('a2000000-0000-0000-0000-000000000001', '2030-01-01')$$, '42501');
-- Aucune variante de record_daily_login n'accepte de date.
select pg_temp.expect_error($$select * from public.record_daily_login('2030-01-01')$$, '42883');
reset role;

-- Série de connexion -----------------------------------------------------------

do $$
declare
  hugo constant uuid := 'a2000000-0000-0000-0000-000000000001';
  s public.player_stats;
begin
  s := public.advance_login_streak(hugo, '2026-12-29');
  assert s.current_streak = 1 and s.best_streak = 1, 'première connexion : série 1';
  s := public.advance_login_streak(hugo, '2026-12-29');
  assert s.current_streak = 1, 'même jour : rien ne change';
  s := public.advance_login_streak(hugo, '2026-12-30');
  assert s.current_streak = 2 and s.best_streak = 2, 'jour suivant : série + 1';
  s := public.advance_login_streak(hugo, '2026-12-31');
  s := public.advance_login_streak(hugo, '2027-01-01');
  assert s.current_streak = 4 and s.best_streak = 4, 'le changement d’année ne casse pas la série';
  s := public.advance_login_streak(hugo, '2026-12-31');
  assert s.current_streak = 4 and s.last_login_day = '2027-01-01', 'un jour antérieur ne change rien';
  s := public.advance_login_streak(hugo, '2027-01-03');
  assert s.current_streak = 1 and s.best_streak = 4, 'un jour manqué : retour à 1, la meilleure série reste';
  s := public.advance_login_streak(hugo, '2027-01-04');
  assert s.current_streak = 2 and s.best_streak = 4, 'la série repart';
  assert s.best_streak_at is not null, 'date de la meilleure série';
end $$;

-- Connexion du jour par l'application : le jour vient du serveur (Europe/Paris).
reset role;
delete from public.player_stats where user_id = 'a2000000-0000-0000-0000-000000000001';
set role authenticated;
set request.jwt.claim.sub = 'a2000000-0000-0000-0000-000000000001';
do $$
begin
  assert (select current_streak from public.record_daily_login()) = 1, 'première connexion du jour';
  assert (select current_streak from public.record_daily_login()) = 1, 'deuxième ouverture le même jour : rien';
  assert (select last_login_day from public.player_stats) = (now() at time zone 'Europe/Paris')::date,
    'jour calendaire de Paris';
  assert (select count(*) from public.player_stats) = 1, 'Hugo ne lit que ses statistiques';
end $$;
reset role;
-- Hier à Paris : la connexion d'aujourd'hui prolonge la série.
update public.player_stats
  set last_login_day = (now() at time zone 'Europe/Paris')::date - 1, current_streak = 6, best_streak = 6
  where user_id = 'a2000000-0000-0000-0000-000000000001';
set role authenticated;
do $$
begin
  assert (select (current_streak, best_streak) = (7, 7) from public.record_daily_login()), 'série prolongée';
end $$;
-- Un invité a aussi sa série.
set request.jwt.claim.sub = 'd2000000-0000-0000-0000-000000000004';
do $$
begin
  assert (select current_streak from public.record_daily_login()) = 1, 'série de l’invité';
end $$;
reset role;

-- Parties lancées ----------------------------------------------------------------

set role authenticated;
set request.jwt.claim.sub = 'a2000000-0000-0000-0000-000000000001';
insert into ids select 'room', public.create_room();
select public.add_ai((select id from ids where name = 'room'), 'hard');
reset role;
do $$
declare room_code text := (select code from public.rooms where id = (select id from ids where name = 'room'));
begin
  set role authenticated;
  perform set_config('request.jwt.claim.sub', 'b2000000-0000-0000-0000-000000000002', false);
  perform public.join_room(room_code);
  reset role;
end $$;
set role service_role;
select public.begin_game(
  (select id from ids where name = 'room'), 'a2000000-0000-0000-0000-000000000001', '{"players": [{}, {}, {}]}');
reset role;
do $$
begin
  assert (pg_temp.stats('a2000000-0000-0000-0000-000000000001')).games_started = 1, 'partie lancée pour l’hôte';
  assert (pg_temp.stats('b2000000-0000-0000-0000-000000000002')).games_started = 1, 'partie lancée pour Iris';
  assert (pg_temp.stats('c2000000-0000-0000-0000-000000000003')) is null, 'Jules n’était pas dans la room';
  assert (select count(*) from public.player_stats s join public.room_players rp on rp.user_id = s.user_id
          where rp.room_id = (select id from ids where name = 'room') and s.games_started > 0) = 2,
    'une ligne par humain de la room';
end $$;
-- Relancer la même room est refusé : pas de double comptage.
set role service_role;
select pg_temp.expect_error($$select public.begin_game((select id from ids where name = 'room'), 'a2000000-0000-0000-0000-000000000001', '{"players": [{}, {}, {}]}')$$, 'room_started');
reset role;
do $$
begin
  assert (pg_temp.stats('a2000000-0000-0000-0000-000000000001')).games_started = 1, 'toujours une seule partie lancée';
end $$;

-- Victoires --------------------------------------------------------------------

-- La partie lancée ci-dessus (Hugo, IA difficile, Iris) : Iris (joueur 2) gagne.
insert into ids select 'game', id from public.games where room_id = (select id from ids where name = 'room');
set role service_role;
do $$
begin
  assert not public.record_game_win((select id from ids where name = 'game')), 'partie en cours : rien';
end $$;
update public.games set status = 'finished', winner = 2, end_reason = 'win'
  where id = (select id from ids where name = 'game');
do $$
begin
  assert public.record_game_win((select id from ids where name = 'game')), 'victoire comptée';
  assert not public.record_game_win((select id from ids where name = 'game')), 'une seule fois par partie';
end $$;
reset role;
do $$
declare s public.player_stats := pg_temp.stats('b2000000-0000-0000-0000-000000000002');
begin
  assert s.wins = 1 and s.wins_hard = 1 and s.wins_easy = 0 and s.wins_medium = 0, 'victoire contre une IA difficile';
  assert (pg_temp.stats('a2000000-0000-0000-0000-000000000001')).wins = 0, 'le perdant ne gagne rien';
end $$;

-- Niveau de l'IA la plus forte, parties sans IA, fins qui ne comptent pas.
do $$
declare
  hugo constant uuid := 'a2000000-0000-0000-0000-000000000001';
  iris constant uuid := 'b2000000-0000-0000-0000-000000000002';
  jules constant uuid := 'c2000000-0000-0000-0000-000000000003';
  s public.player_stats;
begin
  assert public.record_game_win(pg_temp.finished_game(array[hugo], array['easy', 'medium', 'easy'], 0, 'win')),
    'Hugo bat trois IA';
  assert public.record_game_win(pg_temp.finished_game(array[hugo, jules], array['easy'], 0, 'win')),
    'Hugo bat Jules et une IA facile';
  assert public.record_game_win(pg_temp.finished_game(array[hugo, jules], array[]::text[], 0, 'win')),
    'Hugo bat Jules sans IA';
  s := pg_temp.stats(hugo);
  assert s.wins = 3, 'toutes victoires confondues : 3';
  assert s.wins_medium = 1, 'rangée selon l’IA la plus forte (moyenne)';
  assert s.wins_easy = 1, 'IA facile';
  assert s.wins_hard = 0, 'aucune IA difficile battue';

  assert not public.record_game_win(pg_temp.finished_game(array[jules], array['easy'], 1, 'win')),
    'une IA qui gagne ne compte pour personne';
  assert not public.record_game_win(pg_temp.finished_game(array[jules, iris], array[]::text[], 0, 'forfeit')),
    'victoire par forfait : ne compte pas';
  assert not public.record_game_win(pg_temp.finished_game(array[jules], array['hard'], null, 'abandoned')),
    'partie abandonnée : ne compte pas';
  assert not public.record_game_win(gen_random_uuid()), 'partie inconnue';
  assert (pg_temp.stats(jules)) is null or (pg_temp.stats(jules)).wins = 0, 'Jules n’a aucune victoire';
end $$;

-- Classements ----------------------------------------------------------------------

-- Égalité : Jules et Iris ont chacun une victoire ; Iris l'a obtenue la première.
do $$
begin
  perform public.record_game_win(
    pg_temp.finished_game(array['c2000000-0000-0000-0000-000000000003'::uuid], array['hard'], 0, 'win'));
end $$;
update public.player_stats set wins_at = '2026-01-01' where user_id = 'b2000000-0000-0000-0000-000000000002';
update public.player_stats set wins_at = '2026-02-01' where user_id = 'c2000000-0000-0000-0000-000000000003';

-- La fonction ne renvoie que pseudo, avatar, score, rang (et la ligne du joueur).
do $$
begin
  assert pg_get_function_result('public.get_leaderboards()'::regprocedure)
    = 'TABLE(board text, rank integer, pseudo text, avatar text, score integer, is_me boolean)',
    'colonnes du classement';
end $$;

set role authenticated;
set request.jwt.claim.sub = 'c2000000-0000-0000-0000-000000000003';
do $$
declare
  rows text;
begin
  select string_agg(format('%s:%s=%s', rank, pseudo, score), ' ' order by rank) into rows
    from public.get_leaderboards() where board = 'wins';
  assert rows = '1:Hugo=3 2:Iris=1 3:Jules=1', format('ordre des victoires : %s', rows);
  select string_agg(format('%s:%s=%s', rank, pseudo, score), ' ' order by rank) into rows
    from public.get_leaderboards() where board = 'wins_hard';
  assert rows = '1:Iris=1 2:Jules=1', format('hall des pros : %s', rows);
  assert (select is_me from public.get_leaderboards() where board = 'wins' and pseudo = 'Jules'), 'ligne de Jules';
  assert (select count(*) from public.get_leaderboards() where is_me and pseudo <> 'Jules') = 0, 'une seule ligne à moi';
  -- Pas encore de score : ligne sans rang, score 0.
  assert (select (rank is null and score = 0 and is_me) from public.get_leaderboards() where board = 'wins_easy' and is_me),
    'Jules sans victoire contre une IA facile';
  assert (select count(distinct board) from public.get_leaderboards()) = 6, 'six classements';
  -- Avatar par défaut : l'identifiant sert de graine.
  assert (select avatar from public.get_leaderboards() where board = 'wins' and pseudo = 'Hugo')
    = 'a2000000-0000-0000-0000-000000000001', 'graine de l’avatar par défaut';
end $$;
-- Un invité lit aussi les classements.
set request.jwt.claim.sub = 'd2000000-0000-0000-0000-000000000004';
do $$
begin
  assert (select score from public.get_leaderboards() where board = 'best_streak' and is_me) = 1,
    'série de l’invité classée';
end $$;
reset role;

-- Top 50 : 60 joueurs avec plus de parties lancées que Jules (les autres en ont moins).
insert into auth.users (id, email, raw_user_meta_data)
  select gen_random_uuid(), format('p%s@example.com', i), jsonb_build_object('pseudo', format('Joueur%s', i))
  from generate_series(1, 60) as i;
insert into public.player_stats (user_id, games_started, games_started_at)
  select p.id, 10 + substr(p.pseudo, 7)::int, now()
  from public.profiles p where p.pseudo like 'Joueur%'
  on conflict (user_id) do update set games_started = excluded.games_started;
update public.player_stats set games_started = 2 where user_id = 'c2000000-0000-0000-0000-000000000003';
set role authenticated;
set request.jwt.claim.sub = 'c2000000-0000-0000-0000-000000000003';
do $$
begin
  assert (select count(*) from public.get_leaderboards() where board = 'games_started' and rank <= 50) = 50,
    'les 50 premiers';
  assert (select max(rank) from public.get_leaderboards() where board = 'games_started' and not is_me) = 50,
    'personne d’autre après le 50e';
  assert (select rank = 61 and score = 2 from public.get_leaderboards() where board = 'games_started' and is_me),
    'Jules voit son rang hors du top 50';
  assert (select pseudo from public.get_leaderboards() where board = 'games_started' and rank = 1) = 'Joueur60',
    'le meilleur en tête';
end $$;
reset role;

-- Nettoyage : supprimer les comptes supprime leurs statistiques.
delete from auth.users where email like 'p%@example.com'
  or id in ('a2000000-0000-0000-0000-000000000001', 'b2000000-0000-0000-0000-000000000002',
            'c2000000-0000-0000-0000-000000000003', 'd2000000-0000-0000-0000-000000000004');
do $$
begin
  assert not exists (select 1 from public.player_stats s left join public.profiles p on p.id = s.user_id
                     where p.id is null or p.pseudo in ('Hugo', 'Iris', 'Jules') or p.pseudo like 'Joueur%'),
    'statistiques supprimées avec les comptes';
end $$;

\o
\echo 'stats : toutes les vérifications sont passées.'
