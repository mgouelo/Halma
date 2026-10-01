-- Vérifications de la migration rooms (RLS, salle d'attente, lancement, fin).
-- À lancer après auth-stub.sql et les migrations : voir scripts/check-db.sh.
-- Chaque vérification lève une exception en cas d'échec.

\set ON_ERROR_STOP on
-- Les résultats des « select » intermédiaires ne sont pas affichés.
\o /dev/null

-- Exécute `statement` et vérifie qu'il échoue avec le message `expected`
-- (code d'erreur de la salle d'attente) ou le SQLSTATE `expected`.
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

-- Joueurs : Alice, Bob, Carol, Dave, Erin, Frank, Gina (e-mail) et un invité.
insert into auth.users (id, email, raw_user_meta_data) values
  ('a0000000-0000-0000-0000-000000000001', 'alice@example.com', '{"pseudo": "Alice"}'),
  ('b0000000-0000-0000-0000-000000000002', 'bob@example.com', '{"pseudo": "Bobby"}'),
  ('c0000000-0000-0000-0000-000000000003', 'carol@example.com', '{"pseudo": "Carol"}'),
  ('d0000000-0000-0000-0000-000000000004', 'dave@example.com', '{"pseudo": "Dave"}'),
  ('e0000000-0000-0000-0000-000000000005', 'erin@example.com', '{"pseudo": "Erin"}'),
  ('f0000000-0000-0000-0000-000000000006', 'frank@example.com', '{"pseudo": "Frank"}'),
  ('90000000-0000-0000-0000-000000000009', 'gina@example.com', '{"pseudo": "Gina"}');
insert into auth.users (id, is_anonymous) values ('10000000-0000-0000-0000-000000000010', true);

create temporary table ids (name text primary key, id uuid);
grant all on ids to authenticated, service_role;

-- Anonyme (pas connecté) : aucune fonction de salle d'attente.
set role anon;
select pg_temp.expect_error('select public.create_room()', '42501');
select pg_temp.expect_error('select * from public.rooms', '42501');
reset role;

-- Alice crée une room.
set role authenticated;
set request.jwt.claim.sub = 'a0000000-0000-0000-0000-000000000001';
insert into ids select 'room', public.create_room();
do $$
declare r public.rooms;
begin
  select * into r from public.rooms where id = (select id from ids where name = 'room');
  assert r.code ~ '^[A-HJKMNP-Z2-9]{6}$', 'code court sans caractères ambigus';
  assert r.host_id = 'a0000000-0000-0000-0000-000000000001', 'Alice est l’hôte';
  assert r.status = 'waiting', 'la room attend ses joueurs';
  assert (select seat from public.room_players where room_id = r.id and user_id = r.host_id) = 0,
    'l’hôte est à la place 0';
end $$;

-- Les clients ne peuvent rien écrire directement.
select pg_temp.expect_error($$insert into public.rooms (code, host_id) values ('ABCDEF', 'a0000000-0000-0000-0000-000000000001')$$, '42501');
select pg_temp.expect_error($$update public.rooms set status = 'playing'$$, '42501');
select pg_temp.expect_error($$delete from public.rooms$$, '42501');
select pg_temp.expect_error($$insert into public.room_players (room_id, seat, ai_level) select id, 3, 'easy' from ids where name = 'room'$$, '42501');
select pg_temp.expect_error($$update public.room_players set seat = 5$$, '42501');
select pg_temp.expect_error($$insert into public.games (room_id, state) select id, '{}' from ids where name = 'room'$$, '42501');
-- begin_game est réservé à l'Edge Function.
select pg_temp.expect_error($$select public.begin_game((select id from ids where name = 'room'), 'a0000000-0000-0000-0000-000000000001', '{"players": [{}, {}]}')$$, '42501');

-- Bob rejoint avec le code en minuscules, entouré d'espaces.
set request.jwt.claim.sub = 'b0000000-0000-0000-0000-000000000002';
do $$
declare
  room_code text;
begin
  -- Bob ne voit pas encore la room : il ne connaît que le code (donné par Alice).
  assert (select count(*) from public.rooms) = 0, 'un non-membre ne voit pas la room';
  reset role;
  select code into room_code from public.rooms where id = (select id from ids where name = 'room');
  set role authenticated;
  assert public.join_room('  ' || lower(room_code) || ' ') = (select id from ids where name = 'room'), 'Bob rejoint';
  assert public.join_room(room_code) = (select id from ids where name = 'room'), 'rejoindre deux fois ne change rien';
  assert (select count(*) from public.room_players where user_id = 'b0000000-0000-0000-0000-000000000002') = 1,
    'Bob n’a qu’une place';
  assert (select seat from public.room_players where user_id = 'b0000000-0000-0000-0000-000000000002') = 1,
    'Bob prend la place 1';
  assert (select count(*) from public.room_players) = 2, 'Bob voit les joueurs de la room';
end $$;
-- Code inconnu : null (l'essai est compté, voir account-check.sql pour la limite).
do $$
begin
  assert public.join_room('ZZZZZZ') is null, 'code inconnu : aucune room';
end $$;
-- Seul l'hôte gère les IA.
select pg_temp.expect_error($$select public.add_ai((select id from ids where name = 'room'), 'easy')$$, 'not_host');

-- Carol n'est pas dans la room : elle ne voit rien.
set request.jwt.claim.sub = 'c0000000-0000-0000-0000-000000000003';
do $$
begin
  assert (select count(*) from public.rooms) = 0, 'Carol ne voit pas la room';
  assert (select count(*) from public.room_players) = 0, 'Carol ne voit pas les joueurs';
end $$;
-- Son heartbeat sur la room ne touche à rien.
select public.heartbeat((select id from ids where name = 'room'));

-- Alice ajoute, règle et retire des IA.
set request.jwt.claim.sub = 'a0000000-0000-0000-0000-000000000001';
insert into ids select 'ai1', public.add_ai((select id from ids where name = 'room'), 'easy');
select pg_temp.expect_error($$select public.add_ai((select id from ids where name = 'room'), 'expert')$$, 'bad_request');
select public.set_ai_level((select id from ids where name = 'ai1'), 'hard');
do $$
begin
  assert (select ai_level from public.room_players where id = (select id from ids where name = 'ai1')) = 'hard',
    'le niveau de l’IA est modifié';
  assert (select seat from public.room_players where id = (select id from ids where name = 'ai1')) = 2,
    'l’IA prend la première place libre';
end $$;
-- On ne retire pas un humain avec remove_ai.
select pg_temp.expect_error(
  $$select public.remove_ai((select id from public.room_players where user_id = 'b0000000-0000-0000-0000-000000000002'))$$,
  'room_not_found');
select public.remove_ai((select id from ids where name = 'ai1'));
do $$
begin
  assert (select count(*) from public.room_players) = 2, 'l’IA est retirée';
end $$;

-- La room se remplit : 2 humains + 4 IA = 6 participants.
select public.add_ai((select id from ids where name = 'room'), 'medium') from generate_series(1, 4);
select pg_temp.expect_error($$select public.add_ai((select id from ids where name = 'room'), 'easy')$$, 'room_full');
reset role;
do $$
declare room_code text := (select code from public.rooms where id = (select id from ids where name = 'room'));
begin
  set role authenticated;
  perform set_config('request.jwt.claim.sub', 'c0000000-0000-0000-0000-000000000003', false);
  perform pg_temp.expect_error(format('select public.join_room(%L)', room_code), 'room_full');
  reset role;
end $$;

-- Une place libérée par une IA est reprise par Carol.
set role authenticated;
set request.jwt.claim.sub = 'a0000000-0000-0000-0000-000000000001';
select public.remove_ai((select id from public.room_players where seat = 3));
reset role;
do $$
declare room_code text := (select code from public.rooms where id = (select id from ids where name = 'room'));
begin
  set role authenticated;
  perform set_config('request.jwt.claim.sub', 'c0000000-0000-0000-0000-000000000003', false);
  perform public.join_room(room_code);
  assert (select seat from public.room_players where user_id = 'c0000000-0000-0000-0000-000000000003') = 3,
    'Carol prend la place libérée';
  reset role;
end $$;

-- Heartbeat : chacun ne met à jour que son propre signe de vie.
reset role;
update public.room_players set last_seen_at = now() - interval '1 hour';
set role authenticated;
set request.jwt.claim.sub = 'b0000000-0000-0000-0000-000000000002';
select public.heartbeat((select id from ids where name = 'room'));
do $$
begin
  assert (select last_seen_at > now() - interval '1 minute' from public.room_players
          where user_id = 'b0000000-0000-0000-0000-000000000002'), 'le signe de vie de Bob est à jour';
  assert (select last_seen_at < now() - interval '30 minutes' from public.room_players
          where user_id = 'a0000000-0000-0000-0000-000000000001'), 'celui d’Alice ne change pas';
end $$;

-- Un simple joueur quitte : la room reste ouverte pour les autres, l'hôte le reste.
set request.jwt.claim.sub = 'b0000000-0000-0000-0000-000000000002';
select public.leave_room((select id from ids where name = 'room'));
do $$
begin
  assert (select count(*) from public.rooms) = 0, 'Bob ne voit plus la room';
  assert (select count(*) from public.room_players) = 0, 'ni ses joueurs';
end $$;
set request.jwt.claim.sub = 'a0000000-0000-0000-0000-000000000001';
do $$
begin
  assert (select host_id from public.rooms) = 'a0000000-0000-0000-0000-000000000001', 'Alice reste hôte';
  assert (select count(*) from public.room_players) = 5, 'la room reste ouverte, sans la place de Bob';
  assert not exists (select 1 from public.room_players where user_id = 'b0000000-0000-0000-0000-000000000002'),
    'la place de Bob est libérée';
end $$;
-- Bob peut la rejoindre à nouveau (il reprend la place libre).
reset role;
do $$
declare room_code text := (select code from public.rooms where id = (select id from ids where name = 'room'));
begin
  set role authenticated;
  perform set_config('request.jwt.claim.sub', 'b0000000-0000-0000-0000-000000000002', false);
  perform public.join_room(room_code);
  assert (select seat from public.room_players where user_id = 'b0000000-0000-0000-0000-000000000002') = 1,
    'Bob reprend la place 1';
  reset role;
end $$;
set role authenticated;

-- Lancement par l'Edge Function (service_role).
reset role;
set role service_role;
select pg_temp.expect_error(
  $$select public.begin_game((select id from ids where name = 'room'), 'b0000000-0000-0000-0000-000000000002', '{"players": [{}, {}, {}, {}, {}, {}]}')$$,
  'not_host');
select pg_temp.expect_error(
  $$select public.begin_game((select id from ids where name = 'room'), 'a0000000-0000-0000-0000-000000000001', '{"players": [{}, {}]}')$$,
  'bad_request');
insert into ids select 'game', public.begin_game(
  (select id from ids where name = 'room'), 'a0000000-0000-0000-0000-000000000001',
  '{"players": [{}, {}, {}, {}, {}, {}], "turn": 0}');
reset role;
do $$
begin
  assert (select status from public.rooms where id = (select id from ids where name = 'room')) = 'playing',
    'la room est en jeu';
  assert (select array_agg(player_index order by seat) from public.room_players
          where room_id = (select id from ids where name = 'room')) = array[0, 1, 2, 3, 4, 5]::smallint[],
    'identifiants du moteur attribués dans l’ordre des places, sans trou';
end $$;

-- Pendant la partie : on ne rejoint plus, on ne quitte plus, l'hôte ne touche plus aux IA.
do $$
declare room_code text := (select code from public.rooms where id = (select id from ids where name = 'room'));
begin
  set role authenticated;
  perform set_config('request.jwt.claim.sub', 'd0000000-0000-0000-0000-000000000004', false);
  perform pg_temp.expect_error(format('select public.join_room(%L)', room_code), 'room_started');
  -- Un joueur de la partie peut « rejoindre » à nouveau (reprise après déconnexion).
  perform set_config('request.jwt.claim.sub', 'c0000000-0000-0000-0000-000000000003', false);
  assert public.join_room(room_code) = (select id from ids where name = 'room'), 'Carol reprend la partie';
  reset role;
end $$;
set role authenticated;
set request.jwt.claim.sub = 'a0000000-0000-0000-0000-000000000001';
select pg_temp.expect_error($$select public.leave_room((select id from ids where name = 'room'))$$, 'room_started');
select pg_temp.expect_error($$select public.add_ai((select id from ids where name = 'room'), 'easy')$$, 'room_started');

-- Les joueurs lisent la partie mais ne l'écrivent pas.
do $$
begin
  assert (select count(*) from public.games) = 1, 'Alice lit la partie';
end $$;
select pg_temp.expect_error($$update public.games set state = '{}'$$, '42501');
select pg_temp.expect_error($$update public.games set winner = 1, status = 'finished', end_reason = 'win'$$, '42501');
select pg_temp.expect_error($$delete from public.games$$, '42501');
set request.jwt.claim.sub = 'd0000000-0000-0000-0000-000000000004';
do $$
begin
  assert (select count(*) from public.games) = 0, 'Dave (hors de la room) ne lit pas la partie';
end $$;
reset role;

-- Fin de partie (écrite par l'Edge Function) : la room est finie aussi.
set role service_role;
update public.games set status = 'finished', winner = 1, end_reason = 'win', version = version + 1
  where id = (select id from ids where name = 'game');
reset role;
do $$
begin
  assert (select status from public.rooms where id = (select id from ids where name = 'room')) = 'finished',
    'la room suit la fin de partie';
end $$;

-- Une partie finie ne peut pas avoir de fin sans raison.
do $$
begin
  update public.games set end_reason = null where id = (select id from ids where name = 'game');
  raise exception 'une partie finie doit avoir une raison de fin';
exception when check_violation then null;
end $$;

-- Room finie : on peut la quitter (elle disparaît de sa liste).
set role authenticated;
set request.jwt.claim.sub = 'c0000000-0000-0000-0000-000000000003';
select public.leave_room((select id from ids where name = 'room'));
do $$
begin
  assert (select count(*) from public.rooms) = 0, 'Carol a quitté la room finie';
end $$;

-- Un invité peut créer une room ; l'hôte qui la quitte la supprime.
set request.jwt.claim.sub = '10000000-0000-0000-0000-000000000010';
insert into ids select 'guest_room', public.create_room();
select public.leave_room((select id from ids where name = 'guest_room'));
reset role;
do $$
begin
  assert not exists (select 1 from public.rooms where id = (select id from ids where name = 'guest_room')),
    'l’hôte qui quitte supprime la room';
end $$;
-- Une seule room active par joueur ------------------------------------------------------

-- Code d'une room, lu hors RLS (le joueur ne le connaît que parce qu'on le lui donne).
create function pg_temp.code_of(room uuid)
returns text
language sql
security definer
as $$ select code from public.rooms where id = room $$;
grant execute on function pg_temp.code_of(uuid) to authenticated;

-- Alice et Bob sortent d'une partie finie : ils ne sont dans aucune room active.
set role authenticated;
set request.jwt.claim.sub = 'a0000000-0000-0000-0000-000000000001';
do $$
begin
  assert not exists (select 1 from public.my_active_room()), 'une room finie n’est pas active';
end $$;
insert into ids select 'r1', public.create_room();
do $$
begin
  assert (select id from public.my_active_room()) = (select id from ids where name = 'r1'), 'my_active_room donne la room';
end $$;
-- Deuxième création refusée.
select pg_temp.expect_error('select public.create_room()', 'already_in_room');
-- Dave crée la sienne ; il ne peut pas en rejoindre une autre, Alice non plus.
set request.jwt.claim.sub = 'd0000000-0000-0000-0000-000000000004';
insert into ids select 'r2', public.create_room();
select pg_temp.expect_error(format('select public.join_room(%L)', pg_temp.code_of((select id from ids where name = 'r1'))), 'already_in_room');
set request.jwt.claim.sub = 'a0000000-0000-0000-0000-000000000001';
select pg_temp.expect_error(format('select public.join_room(%L)', pg_temp.code_of((select id from ids where name = 'r2'))), 'already_in_room');
-- Rejoindre la room dont on fait déjà partie reste permis.
do $$
begin
  assert public.join_room(pg_temp.code_of((select id from ids where name = 'r1'))) = (select id from ids where name = 'r1'),
    'Alice rejoint sa propre room';
  assert public.join_room('ZZZZZY') is null, 'un code inconnu reste « aucune room »';
end $$;

-- Erin rejoint la room d'Alice, puis la quitte : la room reste ouverte, Erin est libre.
set request.jwt.claim.sub = 'e0000000-0000-0000-0000-000000000005';
select public.join_room(pg_temp.code_of((select id from ids where name = 'r1')));
select pg_temp.expect_error('select public.create_room()', 'already_in_room');
select public.leave_room((select id from ids where name = 'r1'));
do $$
begin
  assert not exists (select 1 from public.my_active_room()), 'Erin n’est plus dans une room';
end $$;
insert into ids select 'r3', public.create_room();
reset role;
do $$
begin
  assert exists (select 1 from public.rooms where id = (select id from ids where name = 'r1')), 'la room d’Alice reste ouverte';
  assert (select count(*) from public.room_players where room_id = (select id from ids where name = 'r1')) = 1,
    'avec Alice seule';
end $$;

-- Frank rejoint la room d'Alice, qui ajoute une IA puis la quitte (hôte) : la room est supprimée avec ses participants.
set role authenticated;
set request.jwt.claim.sub = 'f0000000-0000-0000-0000-000000000006';
select public.join_room(pg_temp.code_of((select id from ids where name = 'r1')));
set request.jwt.claim.sub = 'a0000000-0000-0000-0000-000000000001';
select public.add_ai((select id from ids where name = 'r1'), 'easy');
select public.leave_room((select id from ids where name = 'r1'));
reset role;
do $$
begin
  assert not exists (select 1 from public.rooms where id = (select id from ids where name = 'r1')), 'room supprimée';
  assert not exists (select 1 from public.room_players where room_id = (select id from ids where name = 'r1')),
    'participants supprimés avec elle';
end $$;
set role authenticated;
-- Frank, renvoyé à l'accueil, et Alice peuvent créer une nouvelle room.
set request.jwt.claim.sub = 'f0000000-0000-0000-0000-000000000006';
do $$
begin
  assert not exists (select 1 from public.my_active_room()), 'Frank n’est plus dans une room';
end $$;
insert into ids select 'r4', public.create_room();
set request.jwt.claim.sub = 'a0000000-0000-0000-0000-000000000001';
insert into ids select 'r5', public.create_room();

-- Gina rejoint la room de Frank, qui la lance (Edge Function).
set request.jwt.claim.sub = '90000000-0000-0000-0000-000000000009';
select public.join_room(pg_temp.code_of((select id from ids where name = 'r4')));
reset role;
set role service_role;
select public.begin_game(
  (select id from ids where name = 'r4'), 'f0000000-0000-0000-0000-000000000006', '{"players": [{}, {}]}');
reset role;
set role authenticated;
-- En pleine partie : pas de nouvelle room, on ne quitte pas (on abandonne).
select pg_temp.expect_error('select public.create_room()', 'already_in_room');
select pg_temp.expect_error($$select public.leave_room((select id from ids where name = 'r4'))$$, 'room_started');
do $$
begin
  assert (select status from public.my_active_room()) = 'playing', 'la partie en cours est la room active';
end $$;
-- Gina abandonne (l'Edge Function ajoute son identifiant de joueur à games.forfeited) : elle est libre.
reset role;
update public.games set forfeited = array[1]::smallint[] where room_id = (select id from ids where name = 'r4');
set role authenticated;
do $$
begin
  assert not exists (select 1 from public.my_active_room()), 'après un abandon, la room n’est plus active';
end $$;
insert into ids select 'r6', public.create_room();
-- Frank est toujours dans la partie : l'abandon de Gina ne le libère pas.
set request.jwt.claim.sub = 'f0000000-0000-0000-0000-000000000006';
select pg_temp.expect_error('select public.create_room()', 'already_in_room');
-- La partie se termine : une room finie ne compte pas.
reset role;
update public.games set status = 'finished', winner = 0, end_reason = 'forfeit'
  where room_id = (select id from ids where name = 'r4');
set role authenticated;
do $$
begin
  assert not exists (select 1 from public.my_active_room()), 'une room finie ne compte pas';
end $$;
insert into ids select 'r7', public.create_room();
-- Les clients ne lisent pas la room active des autres.
select pg_temp.expect_error($$select * from public.active_rooms_of('a0000000-0000-0000-0000-000000000001')$$, '42501');
reset role;

-- Supprimer le compte du dernier humain d'une room supprime la room (et sa partie).
delete from auth.users where id = 'a0000000-0000-0000-0000-000000000001';
delete from auth.users where id = 'b0000000-0000-0000-0000-000000000002';
do $$
begin
  assert not exists (select 1 from public.games where id = (select id from ids where name = 'game')),
    'la partie suit la suppression de la room';
end $$;

\o
\echo 'rooms : toutes les vérifications sont passées.'
