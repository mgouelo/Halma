-- Vérifications de la migration rating (points des parties classées).
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

-- Partie finie : humains aux premières places, puis les IA. `moves` : joueurs
-- (identifiants du moteur) de chaque coup de l'historique, dans l'ordre.
create function pg_temp.game(humans uuid[], ais text[], moves int[], p_winner int default 0)
returns uuid
language plpgsql
as $$
declare
  room uuid;
  game uuid;
  i int;
  n_humans int := coalesce(array_length(humans, 1), 0);
  history jsonb := '[]';
begin
  insert into public.rooms (code, host_id, status) values (public.generate_room_code(), humans[1], 'finished')
    returning id into room;
  for i in 1 .. n_humans loop
    insert into public.room_players (room_id, seat, user_id, player_index) values (room, i - 1, humans[i], i - 1);
  end loop;
  for i in 1 .. coalesce(array_length(ais, 1), 0) loop
    insert into public.room_players (room_id, seat, ai_level, player_index)
      values (room, n_humans + i - 1, ais[i], n_humans + i - 1);
  end loop;
  for i in 1 .. coalesce(array_length(moves, 1), 0) loop
    history := history || jsonb_build_object('player', moves[i], 'move', jsonb_build_object('path', '[]'::jsonb));
  end loop;
  insert into public.games (room_id, state) values (room, jsonb_build_object('history', history)) returning id into game;
  update public.games set status = 'finished', winner = p_winner, end_reason = 'win' where id = game;
  return game;
end;
$$;

-- `n` coups alternés entre les joueurs 0 et 1.
create function pg_temp.moves(n int) returns int[] language sql as $$
  select coalesce(array_agg(i % 2), '{}') from generate_series(0, n - 1) i
$$;

create function pg_temp.changes(variadic items text[]) returns jsonb language sql as $$
  select coalesce(jsonb_agg(jsonb_build_object('user_id', split_part(x, ':', 1), 'before', split_part(x, ':', 2)::int,
    'delta', split_part(x, ':', 3)::int)), '[]')
  from unnest(items) x
$$;

create function pg_temp.mmr(who uuid) returns int language sql as $$
  select mmr from public.player_stats where user_id = who
$$;

insert into auth.users (id, email, raw_user_meta_data) values
  ('e3000000-0000-0000-0000-000000000001', 'anna@example.com', '{"pseudo": "Anna"}'),
  ('e3000000-0000-0000-0000-000000000002', 'basile@example.com', '{"pseudo": "Basile"}'),
  ('e3000000-0000-0000-0000-000000000003', 'chloe@example.com', '{"pseudo": "Chloe"}');
insert into auth.users (id, is_anonymous) values ('e3000000-0000-0000-0000-000000000004', true);

-- Aucune écriture par les clients ---------------------------------------------------

set role authenticated;
set request.jwt.claim.sub = 'e3000000-0000-0000-0000-000000000001';
select pg_temp.expect_error($$update public.player_stats set mmr = 5000$$, '42501');
select pg_temp.expect_error(
  $$insert into public.rating_events (game_id, user_id, rating_before, rating_after, delta)
    values (gen_random_uuid(), 'e3000000-0000-0000-0000-000000000001', 0, 100, 100)$$, '42501');
select pg_temp.expect_error($$insert into public.rating_games (game_id, ranked) values (gen_random_uuid(), true)$$, '42501');
select pg_temp.expect_error($$select public.record_game_rating(gen_random_uuid(), '[]', null)$$, '42501');
reset role;

-- Partie classée, puis idempotence -----------------------------------------------------

do $$
declare
  a constant uuid := 'e3000000-0000-0000-0000-000000000001';
  b constant uuid := 'e3000000-0000-0000-0000-000000000002';
  g uuid := pg_temp.game(array[a, b], '{}', pg_temp.moves(10));
begin
  assert pg_temp.mmr(a) is null or pg_temp.mmr(a) = 0, 'points de départ : 0';
  assert public.record_game_rating(g, pg_temp.changes(a || ':0:30', b || ':0:-15')) = 'ranked', 'partie classée';
  assert pg_temp.mmr(a) = 30 and pg_temp.mmr(b) = -15, 'points mis à jour (négatif permis)';
  assert (select ranked_games from public.player_stats where user_id = a) = 1, 'une partie classée';
  assert (select count(*) from public.rating_events where game_id = g) = 2, 'une ligne par joueur';
  assert (select rating_before = 0 and rating_after = -15 and delta = -15 from public.rating_events
    where game_id = g and user_id = b), 'avant, après, delta';

  -- Rappel (nouvelle demande, autre calcul) : rien ne change.
  assert public.record_game_rating(g, pg_temp.changes(a || ':30:28', b || ':-15:-14')) = 'already', 'déjà décidé';
  assert public.record_game_rating(g, '[]', 'not_enough_humans') = 'already', 'déjà décidé (vide)';
  assert pg_temp.mmr(a) = 30 and pg_temp.mmr(b) = -15, 'idempotent';
  assert (select count(*) from public.rating_events where game_id = g) = 2, 'pas de ligne en double';
end $$;

-- Points périmés (autre partie finie entre-temps) : refus, l'Edge Function recommence.
do $$
declare
  a constant uuid := 'e3000000-0000-0000-0000-000000000001';
  c constant uuid := 'e3000000-0000-0000-0000-000000000003';
  g uuid := pg_temp.game(array[a, c], '{}', pg_temp.moves(12));
begin
  perform pg_temp.expect_error(format('select public.record_game_rating(%L, %L)', g, pg_temp.changes(a || ':0:28', c || ':0:-16')),
    'rating_conflict');
  assert not exists (select 1 from public.rating_games where game_id = g), 'rien n’est écrit en cas de conflit';
  -- Joueurs qui ne sont pas ceux de la partie : refus.
  perform pg_temp.expect_error(
    format('select public.record_game_rating(%L, %L)', g, pg_temp.changes(a || ':30:10', 'e3000000-0000-0000-0000-000000000002:-15:-5')),
    'bad_request');
  assert public.record_game_rating(g, pg_temp.changes(a || ':30:28', c || ':0:-16')) = 'ranked', 'recalcul accepté';
  assert pg_temp.mmr(a) = 58 and pg_temp.mmr(c) = -16, 'points après la deuxième partie';
end $$;

-- Garde-fous ------------------------------------------------------------------------------

do $$
declare
  a constant uuid := 'e3000000-0000-0000-0000-000000000001';
  b constant uuid := 'e3000000-0000-0000-0000-000000000002';
  g uuid;
begin
  -- Moins de 10 coups d'humains : les coups d'IA ne comptent pas.
  g := pg_temp.game(array[a, b], array['hard'], array[0, 1, 2, 2, 2, 2, 2, 2, 0, 1, 2, 0, 1, 0, 1, 0]);
  assert public.record_game_rating(g, pg_temp.changes(a || ':58:20', b || ':-15:-10')) = 'unranked', '9 coups d’humains';
  assert (select reason from public.rating_games where game_id = g) = 'too_few_human_moves', 'raison enregistrée';
  assert pg_temp.mmr(a) = 58, 'points inchangés';

  -- Un seul humain : non classée, même avec des variations envoyées.
  g := pg_temp.game(array[a], array['easy'], pg_temp.moves(20));
  assert public.record_game_rating(g, pg_temp.changes(a || ':58:20')) = 'unranked', 'un seul humain';
  assert (select reason from public.rating_games where game_id = g) = 'not_enough_humans', 'raison : un seul humain';

  -- Non classée selon l'Edge Function (liste vide) : décision enregistrée avec sa raison.
  g := pg_temp.game(array[a, b], '{}', pg_temp.moves(20));
  assert public.record_game_rating(g, '[]', 'no_human_left') = 'unranked', 'non classée';
  assert (select not ranked and reason = 'no_human_left' from public.rating_games where game_id = g), 'raison transmise';

  -- Partie en cours : refus.
  g := pg_temp.game(array[a, b], '{}', pg_temp.moves(20));
  update public.games set status = 'playing', end_reason = null where id = g;
  perform pg_temp.expect_error(format('select public.record_game_rating(%L, %L)', g, '[]'), 'game_not_finished');
end $$;

-- Plafond : 3 parties classées par jour entre deux mêmes comptes. Anna et Basile en ont 1.
do $$
declare
  a constant uuid := 'e3000000-0000-0000-0000-000000000001';
  b constant uuid := 'e3000000-0000-0000-0000-000000000002';
  c constant uuid := 'e3000000-0000-0000-0000-000000000003';
  g uuid;
  i int;
begin
  for i in 1 .. 2 loop
    g := pg_temp.game(array[a, b], '{}', pg_temp.moves(10));
    assert public.record_game_rating(g, pg_temp.changes(a || ':' || pg_temp.mmr(a) || ':1', b || ':' || pg_temp.mmr(b) || ':-1'))
      = 'ranked', format('partie %s du jour entre Anna et Basile', i + 1);
  end loop;
  -- Quatrième partie du jour entre eux, même avec un troisième humain : non classée.
  g := pg_temp.game(array[a, b, c], '{}', pg_temp.moves(12));
  assert public.record_game_rating(g, pg_temp.changes(a || ':' || pg_temp.mmr(a) || ':5', b || ':' || pg_temp.mmr(b) || ':-5',
    c || ':' || pg_temp.mmr(c) || ':-5')) = 'unranked', 'plafond atteint pour la paire Anna-Basile';
  assert (select reason from public.rating_games where game_id = g) = 'pair_daily_limit', 'raison : plafond';
  -- Une autre paire n'est pas concernée (Anna et Chloé : 1 partie aujourd'hui).
  g := pg_temp.game(array[a, c], '{}', pg_temp.moves(10));
  assert public.record_game_rating(g, pg_temp.changes(a || ':' || pg_temp.mmr(a) || ':2', c || ':' || pg_temp.mmr(c) || ':-2'))
    = 'ranked', 'autre paire classée';
  -- Les parties d'hier ne comptent pas.
  update public.rating_games set paris_day = paris_day - 1;
  g := pg_temp.game(array[a, b], '{}', pg_temp.moves(10));
  assert public.record_game_rating(g, pg_temp.changes(a || ':' || pg_temp.mmr(a) || ':1', b || ':' || pg_temp.mmr(b) || ':-1'))
    = 'ranked', 'nouveau jour';
end $$;

-- Plancher à -999.
do $$
declare
  b constant uuid := 'e3000000-0000-0000-0000-000000000002';
  c constant uuid := 'e3000000-0000-0000-0000-000000000003';
  g uuid := pg_temp.game(array[b, c], '{}', pg_temp.moves(10));
  before_b int;
begin
  update public.player_stats set mmr = -990 where user_id = b;
  before_b := pg_temp.mmr(c);
  assert public.record_game_rating(g, pg_temp.changes(b || ':-990:-30', c || ':' || before_b || ':1')) = 'ranked', 'classée';
  assert pg_temp.mmr(b) = -999, 'plancher';
  assert (select delta = -9 and rating_after = -999 from public.rating_events where game_id = g and user_id = b),
    'variation réelle enregistrée (plancher)';
end $$;

-- Lecture par les joueurs -----------------------------------------------------------------

do $$
declare
  a constant uuid := 'e3000000-0000-0000-0000-000000000001';
  b constant uuid := 'e3000000-0000-0000-0000-000000000002';
  pending uuid := pg_temp.game(array[a, b], '{}', pg_temp.moves(10));
begin
  perform set_config('halma.pending_game', pending::text, false);
end $$;

set role authenticated;
set request.jwt.claim.sub = 'e3000000-0000-0000-0000-000000000001';
do $$
declare
  pending uuid := current_setting('halma.pending_game')::uuid;
  first_game uuid := (select game_id from public.rating_events where user_id = 'e3000000-0000-0000-0000-000000000001'
    order by created_at limit 1);
  r record;
begin
  select * into r from public.get_game_rating(pending);
  assert r.status = 'pending' and r.delta is null, 'pas encore décidé';
  select * into r from public.get_game_rating(first_game);
  assert r.status = 'ranked' and r.delta = 30 and r.rating_after = 30, 'variation du joueur';
  assert (select count(*) from public.rating_events) = (select count(*) from public.rating_events
    where user_id = 'e3000000-0000-0000-0000-000000000001'), 'chacun ne lit que ses variations';
  select * into r from public.get_my_rating();
  assert r.mmr = (select mmr from public.player_stats where user_id = 'e3000000-0000-0000-0000-000000000001'), 'points';
  assert r.rank = 1, format('Anna première aux points : %s', r.rank);
  -- Classement des points : négatifs compris, ordre décroissant.
  assert (select string_agg(format('%s:%s', pseudo, sign(score)), ' ' order by rank)
    from public.get_leaderboards() where board = 'points' and rank is not null) = 'Anna:1 Chloe:-1 Basile:-1',
    'classement des points';
end $$;
-- Un joueur hors de la partie ne lit pas son résultat.
set request.jwt.claim.sub = 'e3000000-0000-0000-0000-000000000004';
select pg_temp.expect_error(format('select * from public.get_game_rating(%L)', current_setting('halma.pending_game')), 'room_not_found');
do $$
declare
  r record;
begin
  select * into r from public.get_my_rating();
  assert r.mmr = 0 and r.rank is null and r.ranked_games = 0, 'invité : 0 point, pas de rang';
end $$;
reset role;

-- Un invité qui a joué des parties classées a des points, mais pas de rang.
do $$
declare
  a constant uuid := 'e3000000-0000-0000-0000-000000000001';
  guest constant uuid := 'e3000000-0000-0000-0000-000000000004';
  g uuid := pg_temp.game(array[guest, a], '{}', pg_temp.moves(10));
begin
  assert public.record_game_rating(g, pg_temp.changes(guest || ':0:30', a || ':' || pg_temp.mmr(a) || ':-5')) = 'ranked',
    'partie avec un invité classée';
  assert pg_temp.mmr(guest) = 30, 'points de l’invité';
  assert not exists (select 1 from public.points_ranking() where user_id = guest), 'invité hors classement';
end $$;

-- Nettoyage : les vérifications suivantes comptent les joueurs.
delete from public.rooms where host_id::text like 'e3000000-%';
delete from auth.users where id::text like 'e3000000-%';

\o
\echo 'points : toutes les vérifications sont passées.'
