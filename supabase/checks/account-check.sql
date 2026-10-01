-- Vérifications des migrations account_deletion_and_limits et cleanup_abandoned_rooms :
-- suppression de compte (rooms, parties, statistiques, classements), limites
-- d'abus, nettoyage des rooms abandonnées.
-- À lancer après auth-stub.sql et les migrations : voir scripts/check-db.sh.

\set ON_ERROR_STOP on
\o /dev/null

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

-- Joue en tant que `who` (rôle authenticated).
create function pg_temp.as_user(who uuid)
returns void
language plpgsql
as $$
begin
  perform set_config('role', 'authenticated', false);
  perform set_config('request.jwt.claim.sub', who::text, false);
end;
$$;

-- Code d'une room, lu hors RLS (le joueur ne le connaît que parce qu'on le lui donne).
create function pg_temp.code_of(room uuid)
returns text
language sql
security definer
as $$ select code from public.rooms where id = room $$;
grant execute on function pg_temp.code_of(uuid) to authenticated;

-- Kim, Léa, Max, Nour, Oscar.
insert into auth.users (id, email, raw_user_meta_data) values
  ('a3000000-0000-0000-0000-000000000001', 'kim@example.com', '{"pseudo": "Kimmy"}'),
  ('b3000000-0000-0000-0000-000000000002', 'lea@example.com', '{"pseudo": "Leane"}'),
  ('c3000000-0000-0000-0000-000000000003', 'max@example.com', '{"pseudo": "Maxou"}'),
  ('d3000000-0000-0000-0000-000000000004', 'nour@example.com', '{"pseudo": "Nour"}'),
  ('e3000000-0000-0000-0000-000000000005', 'oscar@example.com', '{"pseudo": "Oscar"}');

create temporary table ids (name text primary key, id uuid);
grant all on ids to authenticated, service_role;

-- 1. L'hôte supprime son compte en pleine partie ----------------------------------

select pg_temp.as_user('a3000000-0000-0000-0000-000000000001');
insert into ids select 'game_room', public.create_room();
select public.add_ai((select id from ids where name = 'game_room'), 'hard');
select pg_temp.as_user('b3000000-0000-0000-0000-000000000002');
select public.join_room(pg_temp.code_of((select id from ids where name = 'game_room')));
select pg_temp.as_user('c3000000-0000-0000-0000-000000000003');
select public.join_room(pg_temp.code_of((select id from ids where name = 'game_room')));
reset role;
set role service_role;
select public.begin_game(
  (select id from ids where name = 'game_room'), 'a3000000-0000-0000-0000-000000000001', '{"players": [{}, {}, {}, {}]}');
reset role;
-- Kim a des statistiques et figure dans les classements.
update public.player_stats set wins = 5, wins_at = now() where user_id = 'a3000000-0000-0000-0000-000000000001';
select pg_temp.as_user('b3000000-0000-0000-0000-000000000002');
do $$
begin
  assert exists (select 1 from public.get_leaderboards() where board = 'wins' and pseudo = 'Kimmy'), 'Kim est classée';
end $$;
reset role;

-- Les clients ne peuvent pas appeler la préparation eux-mêmes.
select pg_temp.as_user('b3000000-0000-0000-0000-000000000002');
select pg_temp.expect_error($$select public.prepare_account_deletion('a3000000-0000-0000-0000-000000000001')$$, '42501');
reset role;

delete from auth.users where id = 'a3000000-0000-0000-0000-000000000001';

do $$
declare
  room uuid := (select id from ids where name = 'game_room');
begin
  assert (select status from public.rooms where id = room) = 'playing', 'la partie des autres continue';
  assert (select host_id from public.rooms where id = room) = 'b3000000-0000-0000-0000-000000000002',
    'Léa (place suivante) devient hôte';
  assert (select user_id is null and ai_level is null and player_index = 0 from public.room_players
          where room_id = room and seat = 0), 'la place de Kim reste, « compte supprimé »';
  assert (select count(*) from public.room_players where room_id = room) = 4, 'quatre places, ordre du tour intact';
  assert exists (select 1 from public.games where room_id = room), 'la partie existe toujours';
  assert not exists (select 1 from public.profiles where pseudo = 'Kimmy'), 'profil supprimé';
  assert not exists (select 1 from public.player_stats where user_id = 'a3000000-0000-0000-0000-000000000001'),
    'statistiques supprimées';
end $$;

select pg_temp.as_user('b3000000-0000-0000-0000-000000000002');
do $$
begin
  assert (select count(*) from public.games) = 1, 'Léa lit toujours la partie';
  assert (select count(*) from public.room_players) = 4, 'et ses participants';
  assert not exists (select 1 from public.get_leaderboards() where pseudo = 'Kimmy'), 'Kim a quitté les classements';
end $$;
reset role;

-- La partie se termine : aucune victoire n'est comptée pour un compte supprimé.
update public.games set status = 'finished', winner = 0, end_reason = 'win'
  where room_id = (select id from ids where name = 'game_room');
set role service_role;
do $$
begin
  assert not public.record_game_win((select id from public.games where room_id = (select id from ids where name = 'game_room'))),
    'pas de victoire pour un compte supprimé';
end $$;
reset role;

-- 2. Salles d'attente ------------------------------------------------------------

-- Max crée une salle, Nour la rejoint puis supprime son compte : elle la quitte.
select pg_temp.as_user('c3000000-0000-0000-0000-000000000003');
insert into ids select 'waiting', public.create_room();
select pg_temp.as_user('d3000000-0000-0000-0000-000000000004');
select public.join_room(pg_temp.code_of((select id from ids where name = 'waiting')));
reset role;
delete from auth.users where id = 'd3000000-0000-0000-0000-000000000004';
do $$
begin
  assert (select count(*) from public.room_players where room_id = (select id from ids where name = 'waiting')) = 1,
    'Nour a quitté la salle d’attente (pas de place vide)';
  assert (select status from public.rooms where id = (select id from ids where name = 'waiting')) = 'waiting',
    'la salle de Max reste';
end $$;

-- Oscar, seul humain de sa salle (avec une IA), supprime son compte : la salle disparaît.
select pg_temp.as_user('e3000000-0000-0000-0000-000000000005');
insert into ids select 'alone', public.create_room();
select public.add_ai((select id from ids where name = 'alone'), 'easy');
reset role;

-- 3. Hôte seul humain d'une partie en cours : la room disparaît -------------------------

set role service_role;
select public.begin_game(
  (select id from ids where name = 'alone'), 'e3000000-0000-0000-0000-000000000005', '{"players": [{}, {}]}');
reset role;
delete from auth.users where id = 'e3000000-0000-0000-0000-000000000005';
do $$
begin
  assert not exists (select 1 from public.rooms where id = (select id from ids where name = 'alone')),
    'room sans autre humain supprimée, avec sa partie';
end $$;

-- Un participant reste soit humain, soit IA : jamais les deux.
do $$
begin
  insert into public.room_players (room_id, seat, user_id, ai_level)
    values ((select id from ids where name = 'waiting'), 4, 'c3000000-0000-0000-0000-000000000003', 'easy');
  raise exception 'un participant ne peut pas être humain et IA';
exception when check_violation or unique_violation then null;
end $$;

-- 4. Limites d'abus ------------------------------------------------------------------

select pg_temp.as_user('b3000000-0000-0000-0000-000000000002');
do $$
declare
  i int;
  good text := pg_temp.code_of((select id from ids where name = 'waiting'));
begin
  for i in 1 .. 10 loop
    assert public.join_room('ZZZZZ' || chr(64 + i)) is null, 'code inconnu : null';
  end loop;
  perform pg_temp.expect_error(format('select public.join_room(%L)', good), 'too_many_attempts');
end $$;
-- Les essais ne sont pas lisibles par les clients.
select pg_temp.expect_error('select * from public.room_join_failures', '42501');
reset role;
-- Dix minutes plus tard, c'est reparti.
update public.room_join_failures set attempted_at = now() - interval '11 minutes';
select pg_temp.as_user('b3000000-0000-0000-0000-000000000002');
do $$
begin
  assert public.join_room(pg_temp.code_of((select id from ids where name = 'waiting')))
    = (select id from ids where name = 'waiting'), 'Léa rejoint après l’attente';
end $$;
reset role;

-- Une seule room active par joueur (Max est déjà dans une salle d'attente) : voir aussi rooms-check.sql.
select pg_temp.as_user('c3000000-0000-0000-0000-000000000003');
select pg_temp.expect_error('select public.create_room()', 'already_in_room');
reset role;

-- 5. Nettoyage des rooms abandonnées ---------------------------------------------------

select pg_temp.as_user('c3000000-0000-0000-0000-000000000003');
select pg_temp.expect_error('select public.cleanup_abandoned_rooms()', '42501');
reset role;

-- Une ancienne salle d'attente de Max (créée avant la règle d'une seule room active), abandonnée.
insert into public.rooms (code, host_id) values ('ABCDEF', 'c3000000-0000-0000-0000-000000000003');
insert into public.room_players (room_id, seat, user_id)
  select id, 0, 'c3000000-0000-0000-0000-000000000003' from public.rooms where code = 'ABCDEF';
-- La salle d'attente de Max : signe de vie il y a 2 jours, sauf celui de Léa qui l'a rejointe.
update public.room_players set last_seen_at = now() - interval '2 days'
  where user_id = 'c3000000-0000-0000-0000-000000000003';
-- La partie de Léa et Max : aucun signe de vie depuis 8 jours.
update public.room_players set last_seen_at = now() - interval '8 days'
  where room_id = (select id from ids where name = 'game_room');
update public.rooms set status = 'playing' where id = (select id from ids where name = 'game_room');
-- Des essais de codes vieux de deux jours.
update public.room_join_failures set attempted_at = now() - interval '2 days';
set role service_role;
do $$
declare
  removed int := public.cleanup_abandoned_rooms();
begin
  assert removed = 2, format('1 salle d’attente abandonnée + 1 partie abandonnée (%s)', removed);
  assert not exists (select 1 from public.rooms where code = 'ABCDEF'), 'la salle d’attente abandonnée est supprimée';
  assert exists (select 1 from public.rooms where id = (select id from ids where name = 'waiting')),
    'la salle où Léa est active reste';
  assert not exists (select 1 from public.rooms where id = (select id from ids where name = 'game_room')),
    'la partie abandonnée est supprimée';
  assert (select count(*) from public.room_join_failures) = 0, 'vieux essais de codes effacés';
  assert public.cleanup_abandoned_rooms() = 0, 'rien de plus au deuxième passage';
end $$;
reset role;
-- Les statistiques déjà comptées restent.
do $$
begin
  assert (select games_started from public.player_stats where user_id = 'b3000000-0000-0000-0000-000000000002') = 1,
    'les parties lancées de Léa restent comptées';
end $$;

-- Rooms finies depuis plus de 30 jours.
update public.rooms set status = 'finished' where id = (select id from ids where name = 'waiting');
-- (trigger coupé : il remettrait updated_at à maintenant)
alter table public.rooms disable trigger rooms_touch;
update public.rooms set updated_at = now() - interval '31 days' where id = (select id from ids where name = 'waiting');
alter table public.rooms enable trigger rooms_touch;
set role service_role;
do $$
begin
  assert public.cleanup_abandoned_rooms() = 1, 'room finie depuis plus de 30 jours supprimée';
end $$;
reset role;

delete from auth.users where email in ('lea@example.com', 'max@example.com');

\o
\echo 'comptes et nettoyage : toutes les vérifications sont passées.'
