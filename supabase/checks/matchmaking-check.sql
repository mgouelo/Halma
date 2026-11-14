-- Vérifications de la migration matchmaking.
-- À lancer après auth-stub.sql et les migrations : voir scripts/check-db.sh.
-- Chaque vérification lève une exception en cas d'échec.

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

-- Joueur n (1 à 12) : a5000000-0000-0000-0000-0000000000nn.
create function pg_temp.u(n int) returns uuid language sql as $$
  select ('a5000000-0000-0000-0000-' || lpad(n::text, 12, '0'))::uuid
$$;

-- Agit comme le joueur n.
create function pg_temp.as_u(n int) returns void language sql as $$
  select set_config('request.jwt.claim.sub', pg_temp.u(n)::text, false);
$$;

-- État de recherche du joueur n (appelé avec ses droits).
create function pg_temp.status(n int) returns record language plpgsql as $$
declare
  r record;
begin
  perform pg_temp.as_u(n);
  select * into r from public.get_matchmaking_status();
  return r;
end;
$$;

insert into auth.users (id, email, raw_user_meta_data)
  select pg_temp.u(i), format('mm%s@example.com', i), jsonb_build_object('pseudo', format('Chercheur%s', lpad(i::text, 2, '0')))
  from generate_series(1, 12) i;
-- Le joueur 12 est un invité : le matchmaking lui est ouvert.
update auth.users set is_anonymous = true, email = null where id = pg_temp.u(12);

-- Aucune écriture directe ------------------------------------------------------------------

set role authenticated;
select pg_temp.as_u(1);
select pg_temp.expect_error(format('insert into public.matchmaking_queue (user_id) values (%L)', pg_temp.u(1)), '42501');
select pg_temp.expect_error($$update public.matchmaking_queue set last_seen_at = now()$$, '42501');
select pg_temp.expect_error($$delete from public.matchmaking_queue$$, '42501');
select pg_temp.expect_error(format('insert into public.rooms (code, host_id, matchmaking, starts_at) values (%L, %L, true, now())',
  'ABCDEF', pg_temp.u(1)), '42501');
select pg_temp.expect_error($$select public.matchmaking_run()$$, '42501');
reset role;
set role anon;
select pg_temp.expect_error($$select * from public.join_matchmaking()$$, '42501');
reset role;

-- Appariement de 2 joueurs, puis arrivée d'un 3e pendant le compte à rebours -------------------

set role authenticated;
do $$
declare
  r record;
  room uuid;
begin
  perform pg_temp.as_u(1);
  select * into r from public.join_matchmaking();
  assert r.status = 'searching', format('seul en file : %s', r.status);
  -- Rappel : idempotent.
  select * into r from public.join_matchmaking();
  assert r.status = 'searching', 'toujours en file';

  -- L'invité (joueur 12) arrive : appariés.
  perform pg_temp.as_u(12);
  select * into r from public.join_matchmaking();
  assert r.status = 'matched' and r.players = 2, format('appariés : %s', r);
  assert r.starts_at between r.server_now + interval '14 seconds' and r.server_now + interval '15 seconds',
    format('départ prévu 15 s plus tard (heure serveur) : %s / %s', r.starts_at, r.server_now);
  room := r.room_id;

  r := pg_temp.status(1);
  assert r.status = 'matched' and r.room_id = room, 'le premier est dans la même room';
  -- Chacun ne lit que sa place dans la file (vide maintenant).
  assert (select count(*) from public.matchmaking_queue) = 0, 'file vide';

  perform pg_temp.as_u(3);
  select * into r from public.join_matchmaking();
  assert r.status = 'matched' and r.room_id = room and r.players = 3, format('3e joueur dans la même room : %s', r);
  perform set_config('halma.mm_room', room::text, false);
end $$;
reset role;

do $$
declare
  room uuid := current_setting('halma.mm_room')::uuid;
begin
  assert (select matchmaking and status = 'waiting' from public.rooms where id = room), 'room de matchmaking en attente';
  assert (select array_agg(user_id order by seat) from public.room_players where room_id = room)
    = array[pg_temp.u(1), pg_temp.u(12), pg_temp.u(3)], 'places dans l’ordre d’arrivée';
  assert not exists (select 1 from public.room_players where room_id = room and ai_level is not null), 'pas d’IA';
end $$;

-- Départ avant l'heure refusé (Edge Function, rôle service) ; pas d'IA ni de réglages.
select pg_temp.expect_error(
  format('select public.begin_game(%L, %L, %L)', current_setting('halma.mm_room'), pg_temp.u(1), '{"players": [1, 2, 3]}'),
  'start_too_early');
select pg_temp.expect_error(
  format('select public.begin_game(%L, %L, %L)', current_setting('halma.mm_room'), pg_temp.u(9), '{"players": [1, 2, 3]}'),
  'not_in_game');
set role authenticated;
select pg_temp.as_u(1);
select pg_temp.expect_error(format('select public.add_ai(%L, %L)', current_setting('halma.mm_room'), 'easy'), 'not_host');
select pg_temp.expect_error(format('select public.set_room_settings(%L, %L)', current_setting('halma.mm_room'),
  '{"touch_move": true}'), 'not_host');
-- En room de matchmaking : pas de room classique en parallèle.
select pg_temp.expect_error($$select public.create_room()$$, 'already_in_room');
reset role;

-- Départs pendant le compte à rebours : la room reste à 2, puis est dissoute à 1 ----------------

set role authenticated;
do $$
declare
  room uuid := current_setting('halma.mm_room')::uuid;
  r record;
begin
  perform pg_temp.as_u(3);
  perform public.leave_matchmaking();
  r := pg_temp.status(3);
  assert r.status = 'idle', 'le 3e est sorti';
  r := pg_temp.status(1);
  assert r.status = 'matched' and r.players = 2, 'la room reste à 2';

  -- Le joueur 1 (hôte nominal) quitte par leave_room : pas de fermeture pour les autres.
  perform pg_temp.as_u(1);
  perform public.leave_room(room);
  r := pg_temp.status(12);
  assert r.status = 'searching', format('seul restant : remis en file (%s)', r.status);
  assert not exists (select 1 from public.rooms where id = room), 'room dissoute';

  -- Le joueur 1 revient : apparié avec le 12, qui garde son rang.
  perform pg_temp.as_u(1);
  select * into r from public.join_matchmaking();
  assert r.status = 'matched' and r.players = 2, 'nouvel appariement';
  perform set_config('halma.mm_room', r.room_id::text, false);
  assert (select user_id from public.room_players where room_id = r.room_id and seat = 0) = pg_temp.u(12),
    'le joueur remis en file passe devant';
end $$;
reset role;

-- Lancement à l'heure prévue, une seule fois -----------------------------------------------------

update public.rooms set starts_at = clock_timestamp() - interval '1 second' where id = current_setting('halma.mm_room')::uuid;
do $$
begin
  assert public.begin_game(current_setting('halma.mm_room')::uuid, pg_temp.u(1), '{"players": [1, 2]}') is not null,
    'lancée par n’importe quel joueur à l’heure prévue';
end $$;
select pg_temp.expect_error(
  format('select public.begin_game(%L, %L, %L)', current_setting('halma.mm_room'), pg_temp.u(12), '{"players": [1, 2]}'),
  'room_started');
set role authenticated;
do $$
declare
  r record;
begin
  r := pg_temp.status(12);
  assert r.status = 'started' and r.room_id = current_setting('halma.mm_room')::uuid, format('partie lancée : %s', r);
end $$;
-- Un joueur dans une room active ne peut pas chercher de partie.
select pg_temp.as_u(1);
select pg_temp.expect_error($$select * from public.join_matchmaking()$$, 'already_in_room');
reset role;

-- Joueurs sans signe de vie ----------------------------------------------------------------------

set role authenticated;
do $$
declare
  r record;
begin
  -- En file : le 4 n'a plus donné signe de vie depuis 30 s, le 5 arrive et reste seul.
  perform pg_temp.as_u(4);
  perform public.join_matchmaking();
end $$;
reset role;
update public.matchmaking_queue set last_seen_at = clock_timestamp() - interval '30 seconds' where user_id = pg_temp.u(4);
set role authenticated;
do $$
declare
  r record;
begin
  perform pg_temp.as_u(5);
  select * into r from public.join_matchmaking();
  assert r.status = 'searching', format('pas d’appariement avec un absent : %s', r.status);
  r := pg_temp.status(4);
  assert r.status = 'idle', 'l’absent est retiré de la file';
  -- Le 6 arrive : apparié avec le 5.
  perform pg_temp.as_u(6);
  select * into r from public.join_matchmaking();
  assert r.status = 'matched' and r.players = 2, '5 et 6 appariés';
  perform set_config('halma.mm_room', r.room_id::text, false);
  -- Un joueur en file ne peut pas créer de room.
  perform pg_temp.as_u(7);
  perform public.join_matchmaking();
end $$;
-- Le 7 a rejoint la room en compte à rebours (3 joueurs) ; il ne peut pas créer de room.
select pg_temp.as_u(7);
select pg_temp.expect_error($$select public.create_room()$$, 'already_in_room');
reset role;

-- En compte à rebours : le 5 ne donne plus signe de vie, le 6 envoie le sien : le 5 sort.
update public.room_players set last_seen_at = clock_timestamp() - interval '30 seconds' where user_id = pg_temp.u(5);
set role authenticated;
do $$
declare
  r record;
begin
  perform pg_temp.as_u(6);
  select * into r from public.matchmaking_heartbeat();
  assert r.status = 'matched' and r.players = 2, format('le 5 est retiré de la room : %s', r);
  r := pg_temp.status(5);
  assert r.status = 'idle', 'le 5 n’est plus nulle part';
end $$;
reset role;

-- Une recherche bloque la création et la jointure de rooms classiques.
set role authenticated;
select pg_temp.as_u(8);
select public.create_room();
select pg_temp.as_u(9);
select * from public.join_matchmaking();
reset role;
-- (Le 9 est entré dans la room en compte à rebours des joueurs 6 et 7 ; on le remet seul en file pour la suite.)
delete from public.room_players where user_id = pg_temp.u(9);
insert into public.matchmaking_queue (user_id) values (pg_temp.u(9));
update public.rooms set starts_at = clock_timestamp() - interval '1 second' where id = current_setting('halma.mm_room')::uuid;
select set_config('halma.classic_code', (select code from public.rooms where host_id = pg_temp.u(8) and not matchmaking), false);
select set_config('halma.mm_code', (select code from public.rooms where id = current_setting('halma.mm_room')::uuid), false);
set role authenticated;
select pg_temp.as_u(9);
select pg_temp.expect_error($$select public.create_room()$$, 'already_searching');
select pg_temp.expect_error(format('select public.join_room(%L)', current_setting('halma.classic_code')), 'already_searching');
-- Une room de matchmaking ne se rejoint pas par son code.
select pg_temp.as_u(10);
select pg_temp.expect_error(format('select public.join_room(%L)', current_setting('halma.mm_code')), 'room_not_found');
reset role;

-- Six joueurs au plus par room -------------------------------------------------------------------

delete from public.matchmaking_queue;
delete from public.rooms where matchmaking;
delete from public.rooms where host_id = pg_temp.u(8);
set role authenticated;
do $$
declare
  i int;
  r record;
begin
  for i in 1 .. 7 loop
    perform pg_temp.as_u(i + 2);
    perform public.join_matchmaking();
  end loop;
  r := pg_temp.status(3);
  assert r.status = 'matched' and r.players = 6, format('six joueurs : %s', r);
  r := pg_temp.status(9);
  assert r.status = 'searching', format('le 7e attend : %s', r.status);
end $$;
reset role;

-- Nettoyage : room de matchmaking jamais lancée, joueurs absents de la file.
update public.rooms set starts_at = now() - interval '11 minutes' where matchmaking;
update public.matchmaking_queue set last_seen_at = now() - interval '1 minute';
do $$
begin
  perform public.cleanup_abandoned_rooms();
  assert not exists (select 1 from public.rooms where matchmaking and status = 'waiting'), 'room de matchmaking abandonnée supprimée';
  assert not exists (select 1 from public.matchmaking_queue), 'file nettoyée';
end $$;

delete from public.rooms where host_id::text like 'a5000000-%';
delete from auth.users where id::text like 'a5000000-%';

\o
\echo 'matchmaking : toutes les vérifications sont passées.'
