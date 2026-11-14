-- Vérifications de la migration friends (demandes d'ami et amitiés).
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

-- Joueur connecté (pour la suite de la transaction en cours).
create function pg_temp.as_user(who uuid) returns void language sql as $$
  select set_config('request.jwt.claim.sub', who::text, false);
$$;

-- f4000000-…-0001 Zoé, -0002 Basile, -0003 Chloé, invité -0004, puis 30 joueurs « Joueur01… ».
insert into auth.users (id, email, raw_user_meta_data) values
  ('f4000000-0000-0000-0000-000000000001', 'zoe@example.com', '{"pseudo": "Zoé"}'),
  ('f4000000-0000-0000-0000-000000000002', 'basile@example.com', '{"pseudo": "Basile"}'),
  ('f4000000-0000-0000-0000-000000000003', 'chloe@example.com', '{"pseudo": "Chloé"}');
insert into auth.users (id, is_anonymous) values ('f4000000-0000-0000-0000-000000000004', true);
insert into auth.users (id, email, raw_user_meta_data)
  select ('f4000000-0000-0000-0001-' || lpad(i::text, 12, '0'))::uuid, format('j%s@example.com', i),
    jsonb_build_object('pseudo', format('Joueur%s', lpad(i::text, 2, '0')))
  from generate_series(1, 30) i;

-- Aucune écriture directe ----------------------------------------------------------------------

set role authenticated;
select pg_temp.as_user('f4000000-0000-0000-0000-000000000001');
select pg_temp.expect_error($$insert into public.friend_requests (sender_id, recipient_id)
  values ('f4000000-0000-0000-0000-000000000001', 'f4000000-0000-0000-0000-000000000002')$$, '42501');
select pg_temp.expect_error($$insert into public.friendships (user_a, user_b)
  values ('f4000000-0000-0000-0000-000000000001', 'f4000000-0000-0000-0000-000000000002')$$, '42501');
select pg_temp.expect_error($$delete from public.friend_requests$$, '42501');
select pg_temp.expect_error($$update public.friendships set created_at = now()$$, '42501');
select pg_temp.expect_error($$select * from public.friend_request_refusals$$, '42501');
reset role;
set role anon;
select pg_temp.expect_error($$select public.send_friend_request('Basile')$$, '42501');
select pg_temp.expect_error($$select * from public.friend_requests$$, '42501');
reset role;

-- Envoyer une demande ------------------------------------------------------------------------------

set role authenticated;
-- Basile cherche « zoe » : la recherche ignore la casse, les accents et les apostrophes.
select pg_temp.as_user('f4000000-0000-0000-0000-000000000002');
do $$
begin
  assert public.send_friend_request(' ZOE ') = 'sent', 'zoe trouve Zoé';
end $$;
select pg_temp.expect_error($$select public.send_friend_request('zoé')$$, 'already_requested');
select pg_temp.expect_error($$select public.send_friend_request('Basile')$$, 'self_request');
select pg_temp.expect_error($$select public.send_friend_request('Personne')$$, 'pseudo_unknown');
select pg_temp.expect_error($$select public.send_friend_request(null)$$, 'pseudo_unknown');
select pg_temp.expect_error(
  format('select public.send_friend_request(%L)', (select pseudo from public.profiles where id = 'f4000000-0000-0000-0000-000000000004')),
  'not_eligible');

-- L'invité ne peut rien faire.
select pg_temp.as_user('f4000000-0000-0000-0000-000000000004');
select pg_temp.expect_error($$select public.send_friend_request('Basile')$$, 'guest_not_allowed');
select pg_temp.expect_error($$select * from public.get_friends()$$, 'guest_not_allowed');
select pg_temp.expect_error($$select * from public.get_friend_requests()$$, 'guest_not_allowed');

-- RLS : chacun ne lit que ce qui le concerne.
select pg_temp.as_user('f4000000-0000-0000-0000-000000000003');
do $$
begin
  assert (select count(*) from public.friend_requests) = 0, 'Chloé ne voit pas la demande de Basile à Zoé';
end $$;
select pg_temp.as_user('f4000000-0000-0000-0000-000000000001');
do $$
begin
  assert (select count(*) from public.friend_requests) = 1, 'Zoé voit la demande reçue';
  assert (select pseudo from public.get_friend_requests()) = 'Basile', 'demande reçue de Basile';
end $$;

-- Demande croisée : Zoé demande Basile à son tour, ils deviennent amis.
do $$
begin
  assert public.send_friend_request('basile') = 'accepted', 'demande croisée acceptée';
  assert (select count(*) from public.friend_requests) = 0, 'plus de demande en attente';
  assert (select count(*) from public.friendships) = 1, 'amitié créée';
  assert (select user_a < user_b from public.friendships), 'paire canonique';
end $$;
select pg_temp.expect_error($$select public.send_friend_request('Basile')$$, 'already_friends');
select pg_temp.as_user('f4000000-0000-0000-0000-000000000002');
select pg_temp.expect_error($$select public.send_friend_request('Zoe')$$, 'already_friends');

-- Liste d'amis : pseudo, avatar, points et rang, rien d'autre.
reset role;
insert into public.player_stats (user_id, mmr, ranked_games) values ('f4000000-0000-0000-0000-000000000001', 42, 3)
  on conflict (user_id) do update set mmr = 42, ranked_games = 3;
set role authenticated;
select pg_temp.as_user('f4000000-0000-0000-0000-000000000002');
do $$
declare
  r record;
begin
  select * into r from public.get_friends();
  assert r.pseudo = 'Zoé' and r.points = 42 and r.rank is not null, format('ami : %s', r);
end $$;
reset role;
do $$
begin
  assert (
    select array_agg(name order by ordinality)
    from unnest((select proargnames from pg_proc where proname = 'get_friends')) with ordinality as a (name, ordinality)
  ) = array['friendship_id', 'pseudo', 'avatar', 'points', 'rank'], 'get_friends : pas d’e-mail ni d’identifiant de compte';
end $$;

-- Refus, puis délai de 24 heures -----------------------------------------------------------------------

set role authenticated;
select pg_temp.as_user('f4000000-0000-0000-0000-000000000003');
do $$
begin
  assert public.send_friend_request('Basile') = 'sent', 'Chloé demande Basile';
end $$;
-- Seul le destinataire répond.
select pg_temp.expect_error(
  format('select public.respond_friend_request(%L, true)', (select id from public.friend_requests limit 1)), 'request_not_found');
select pg_temp.as_user('f4000000-0000-0000-0000-000000000002');
do $$
begin
  assert public.respond_friend_request((select request_id from public.get_friend_requests()), false) = 'refused', 'refus';
  assert (select count(*) from public.friend_requests) = 0, 'demande retirée';
end $$;
select pg_temp.as_user('f4000000-0000-0000-0000-000000000003');
select pg_temp.expect_error($$select public.send_friend_request('Basile')$$, 'recently_refused');
reset role;
update public.friend_request_refusals set refused_at = now() - interval '25 hours';
set role authenticated;
select pg_temp.as_user('f4000000-0000-0000-0000-000000000003');
do $$
begin
  assert public.send_friend_request('Basile') = 'sent', 'nouvelle demande après 24 h';
end $$;
select pg_temp.as_user('f4000000-0000-0000-0000-000000000002');
do $$
begin
  assert public.respond_friend_request((select request_id from public.get_friend_requests()), true) = 'accepted', 'acceptée';
  assert (select string_agg(pseudo, ',' order by pseudo) from public.get_friends()) = 'Chloé,Zoé', 'deux amis';
  -- Triés par points, le plus haut d'abord : Zoé (42), puis Chloé (0).
  assert (select string_agg(pseudo, ',') from public.get_friends()) = 'Zoé,Chloé', 'tri par points';
  assert (select rank from public.get_friends() where pseudo = 'Chloé') is null, 'Chloé sans partie classée : pas de rang';
end $$;

-- Retirer un ami : seulement l'un des deux.
select pg_temp.as_user('f4000000-0000-0000-0000-000000000001');
select pg_temp.expect_error(
  format('select public.remove_friend(%L)', (select f.id from public.friendships f
    where 'f4000000-0000-0000-0000-000000000003' in (f.user_a, f.user_b) limit 1)), 'friend_not_found');
select pg_temp.as_user('f4000000-0000-0000-0000-000000000002');
do $$
begin
  perform public.remove_friend((select friendship_id from public.get_friends() where pseudo = 'Chloé'));
  assert (select string_agg(pseudo, ',') from public.get_friends()) = 'Zoé', 'Chloé retirée';
end $$;
reset role;

-- Au plus 10 demandes reçues : la plus ancienne laisse sa place, la nouvelle en tête --------------------

set role authenticated;
do $$
declare
  i int;
begin
  for i in 1 .. 11 loop
    perform pg_temp.as_user(('f4000000-0000-0000-0001-' || lpad(i::text, 12, '0'))::uuid);
    assert public.send_friend_request('Chloé') = 'sent', format('demande %s', i);
  end loop;
  perform pg_temp.as_user('f4000000-0000-0000-0000-000000000003');
  assert (select count(*) from public.get_friend_requests()) = 10, 'dix demandes au plus';
  assert (select pseudo from public.get_friend_requests() limit 1) = 'Joueur11', 'la nouvelle en tête';
  assert not exists (select 1 from public.get_friend_requests() where pseudo = 'Joueur01'), 'la plus ancienne supprimée';
  assert (select string_agg(pseudo, ',') from public.get_friend_requests()) =
    'Joueur11,Joueur10,Joueur09,Joueur08,Joueur07,Joueur06,Joueur05,Joueur04,Joueur03,Joueur02', 'de la plus récente à la plus ancienne';
end $$;

-- Au plus 20 demandes envoyées en attente par joueur.
do $$
declare
  i int;
begin
  perform pg_temp.as_user('f4000000-0000-0000-0001-000000000030');
  for i in 1 .. 20 loop
    assert public.send_friend_request(format('Joueur%s', lpad(i::text, 2, '0'))) = 'sent', format('envoi %s', i);
  end loop;
end $$;
select pg_temp.as_user('f4000000-0000-0000-0001-000000000030');
select pg_temp.expect_error($$select public.send_friend_request('Joueur21')$$, 'too_many_sent');
reset role;

-- Suppression du compte : amitiés et demandes suivent ------------------------------------------------

do $$
begin
  delete from auth.users where id = 'f4000000-0000-0000-0000-000000000001';
  assert not exists (select 1 from public.friendships
    where 'f4000000-0000-0000-0000-000000000001' in (user_a, user_b)), 'amitiés supprimées avec le compte';
  delete from auth.users where id = 'f4000000-0000-0000-0001-000000000030';
  assert not exists (select 1 from public.friend_requests
    where sender_id = 'f4000000-0000-0000-0001-000000000030'), 'demandes supprimées avec le compte';
end $$;

-- Nettoyage.
delete from auth.users where id::text like 'f4000000-%';

\o
\echo 'amis : toutes les vérifications sont passées.'
