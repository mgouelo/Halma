-- Vérifications de la migration public_profile : profil public d'un joueur
-- (get_public_profile) et identifiant du joueur ajouté à get_leaderboards,
-- get_friends et get_friend_requests, anciennes colonnes inchangées.
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

-- Message, code, détail et indice d'une erreur (pour comparer deux refus).
create function pg_temp.error_of(statement text)
returns text
language plpgsql
as $$
declare
  msg text;
  state text;
  detail text;
  hint text;
begin
  execute statement;
  return 'aucune erreur';
exception when others then
  get stacked diagnostics msg = message_text, state = returned_sqlstate, detail = pg_exception_detail, hint = pg_exception_hint;
  return concat_ws(' | ', msg, state, detail, hint);
end;
$$;

create function pg_temp.as_user(who uuid) returns void language sql as $$
  select set_config('request.jwt.claim.sub', who::text, false);
$$;

-- f5000000-…-0001 Anna (moi), -0002 Basile (ami), -0003 Chloé (je lui ai demandé),
-- -0004 Dora (m'a demandé), -0005 Elio (aucun lien, classé), -0006 invité.
insert into auth.users (id, email, raw_user_meta_data) values
  ('f5000000-0000-0000-0000-000000000001', 'anna@example.com', '{"pseudo": "Anna"}'),
  ('f5000000-0000-0000-0000-000000000002', 'basile@example.com', '{"pseudo": "Basile"}'),
  ('f5000000-0000-0000-0000-000000000003', 'chloe@example.com', '{"pseudo": "Chloé"}'),
  ('f5000000-0000-0000-0000-000000000004', 'dora@example.com', '{"pseudo": "Dora"}'),
  ('f5000000-0000-0000-0000-000000000005', 'elio@example.com', '{"pseudo": "Elio"}');
insert into auth.users (id, is_anonymous) values ('f5000000-0000-0000-0000-000000000006', true);

insert into public.friendships (user_a, user_b)
  values ('f5000000-0000-0000-0000-000000000001', 'f5000000-0000-0000-0000-000000000002');
insert into public.friend_requests (sender_id, recipient_id) values
  ('f5000000-0000-0000-0000-000000000001', 'f5000000-0000-0000-0000-000000000003'),
  ('f5000000-0000-0000-0000-000000000004', 'f5000000-0000-0000-0000-000000000001');
insert into public.player_stats (user_id, mmr, mmr_at, ranked_games, wins, wins_at, games_started, current_streak, best_streak, best_streak_at)
  values ('f5000000-0000-0000-0000-000000000005', 50, now(), 2, 3, now(), 9, 1, 7, now())
  on conflict (user_id) do update set mmr = 50, mmr_at = now(), ranked_games = 2, wins = 3, wins_at = now(),
    games_started = 9, current_streak = 1, best_streak = 7, best_streak_at = now();
update public.profiles set avatar = '{"hair":"short"}' where id = 'f5000000-0000-0000-0000-000000000005';

-- Droits ------------------------------------------------------------------------------------

do $$
begin
  assert not has_function_privilege('anon', 'public.get_public_profile(uuid)', 'execute'), 'anon : pas de profil public';
  assert has_function_privilege('authenticated', 'public.get_public_profile(uuid)', 'execute'), 'connecté : profil public';
  assert not has_function_privilege('anon', 'public.get_leaderboards()', 'execute'), 'anon : pas de classement';
  assert not has_function_privilege('anon', 'public.get_friends()', 'execute'), 'anon : pas d’amis';
  assert not has_function_privilege('anon', 'public.get_friend_requests()', 'execute'), 'anon : pas de demandes';
  assert has_function_privilege('authenticated', 'public.get_leaderboards()', 'execute'), 'connecté : classement';
  assert has_function_privilege('authenticated', 'public.get_friends()', 'execute'), 'connecté : amis';
  assert has_function_privilege('authenticated', 'public.get_friend_requests()', 'execute'), 'connecté : demandes';
end $$;

set role anon;
select pg_temp.expect_error($$select * from public.get_public_profile('f5000000-0000-0000-0000-000000000005')$$, '42501');
reset role;

-- Toujours aucune écriture directe.
set role authenticated;
select pg_temp.as_user('f5000000-0000-0000-0000-000000000001');
select pg_temp.expect_error($$insert into public.friendships (user_a, user_b)
  values ('f5000000-0000-0000-0000-000000000001', 'f5000000-0000-0000-0000-000000000005')$$, '42501');
select pg_temp.expect_error($$update public.player_stats set mmr = 999$$, '42501');

-- Un invité ne lit aucun profil public.
select pg_temp.as_user('f5000000-0000-0000-0000-000000000006');
select pg_temp.expect_error($$select * from public.get_public_profile('f5000000-0000-0000-0000-000000000005')$$, 'guest_not_allowed');

-- Joueur inconnu ou invité : la même erreur, rien qui les distingue.
select pg_temp.as_user('f5000000-0000-0000-0000-000000000001');
select pg_temp.expect_error($$select * from public.get_public_profile('f5000000-0000-0000-0000-0000000000ff')$$, 'player_not_found');
select pg_temp.expect_error($$select * from public.get_public_profile('f5000000-0000-0000-0000-000000000006')$$, 'player_not_found');
select pg_temp.expect_error($$select * from public.get_public_profile(null)$$, 'player_not_found');
do $$
begin
  assert pg_temp.error_of($q$select * from public.get_public_profile('f5000000-0000-0000-0000-0000000000ff')$q$)
    = pg_temp.error_of($q$select * from public.get_public_profile('f5000000-0000-0000-0000-000000000006')$q$),
    'joueur inconnu et invité : même erreur';
end $$;

-- Relations, vues par Anna ----------------------------------------------------------------------

do $$
declare
  r record;
begin
  select * into r from public.get_public_profile('f5000000-0000-0000-0000-000000000001');
  assert r.relation = 'self' and r.pseudo = 'Anna' and r.friendship_id is null and r.request_id is null, format('moi : %s', r);

  select * into r from public.get_public_profile('f5000000-0000-0000-0000-000000000002');
  assert r.relation = 'friends' and r.request_id is null, format('ami : %s', r);
  assert r.friendship_id = (select id from public.friendships
    where user_a = 'f5000000-0000-0000-0000-000000000001' and user_b = 'f5000000-0000-0000-0000-000000000002'),
    'identifiant de l’amitié';
  -- Sans statistiques : zéro partout, pas de rang.
  assert r.points = 0 and r.rank is null and r.wins = 0 and r.best_streak = 0, format('Basile sans statistiques : %s', r);
  -- Sans avatar : l'identifiant sert de graine, comme dans les classements.
  assert r.avatar = 'f5000000-0000-0000-0000-000000000002', 'avatar par défaut';

  select * into r from public.get_public_profile('f5000000-0000-0000-0000-000000000003');
  assert r.relation = 'request_sent' and r.friendship_id is null and r.request_id is null, format('demande envoyée : %s', r);

  select * into r from public.get_public_profile('f5000000-0000-0000-0000-000000000004');
  assert r.relation = 'request_received' and r.friendship_id is null, format('demande reçue : %s', r);
  assert r.request_id = (select id from public.friend_requests where sender_id = 'f5000000-0000-0000-0000-000000000004'),
    'identifiant de la demande reçue';

  select * into r from public.get_public_profile('f5000000-0000-0000-0000-000000000005');
  assert r.relation = 'none' and r.friendship_id is null and r.request_id is null, format('aucun lien : %s', r);
  assert r.pseudo = 'Elio' and r.avatar = '{"hair":"short"}' and r.points = 50 and r.rank is not null
    and r.wins = 3 and r.best_streak = 7, format('statistiques publiques d’Elio : %s', r);
  assert (select count(*) from public.get_public_profile('f5000000-0000-0000-0000-000000000005')) = 1, 'une seule ligne';
end $$;

-- Vues de l'autre côté : Chloé a reçu la demande d'Anna, Dora a envoyé la sienne.
select pg_temp.as_user('f5000000-0000-0000-0000-000000000003');
do $$
begin
  assert (select relation from public.get_public_profile('f5000000-0000-0000-0000-000000000001')) = 'request_received',
    'Chloé : demande reçue d’Anna';
end $$;
select pg_temp.as_user('f5000000-0000-0000-0000-000000000004');
do $$
begin
  assert (select relation from public.get_public_profile('f5000000-0000-0000-0000-000000000001')) = 'request_sent',
    'Dora : demande envoyée à Anna';
  assert (select request_id from public.get_public_profile('f5000000-0000-0000-0000-000000000001')) is null,
    'Dora ne reçoit pas l’identifiant de sa propre demande';
end $$;

-- Les relations suivent les fonctions d'amitié : Anna accepte Dora, retire Basile.
select pg_temp.as_user('f5000000-0000-0000-0000-000000000001');
do $$
begin
  perform public.respond_friend_request((select request_id from public.get_public_profile('f5000000-0000-0000-0000-000000000004')), true);
  assert (select relation from public.get_public_profile('f5000000-0000-0000-0000-000000000004')) = 'friends', 'Dora acceptée';
  perform public.remove_friend((select friendship_id from public.get_public_profile('f5000000-0000-0000-0000-000000000002')));
  assert (select relation from public.get_public_profile('f5000000-0000-0000-0000-000000000002')) = 'none', 'Basile retiré';
  assert public.send_friend_request('Elio') = 'sent', 'demande à Elio';
  assert (select relation from public.get_public_profile('f5000000-0000-0000-0000-000000000005')) = 'request_sent',
    'demande à Elio envoyée';
end $$;

-- Aucune donnée privée ------------------------------------------------------------------------------

do $$
declare
  row_text text;
begin
  -- Le contenu renvoyé ne contient ni e-mail ni parties lancées (Elio en a 9, Basile a un e-mail).
  select string_agg(row_to_json(p)::text, ' ') into row_text from (
    select * from public.get_public_profile('f5000000-0000-0000-0000-000000000005')
    union all select * from public.get_public_profile('f5000000-0000-0000-0000-000000000002')
  ) p;
  assert row_text not like '%@%', format('aucun e-mail : %s', row_text);
  assert row_text not like '%games_started%' and row_text not like '%current_streak%', 'aucune statistique privée';
end $$;
reset role;

do $$
begin
  assert pg_get_function_result('public.get_public_profile(uuid)'::regprocedure)
    = 'TABLE(pseudo text, avatar text, points integer, rank integer, wins integer, best_streak integer, relation text, friendship_id uuid, request_id uuid)',
    'colonnes du profil public : rien d’autre';
  assert (select prosecdef from pg_proc where oid = 'public.get_public_profile(uuid)'::regprocedure), 'security definer';
  -- Pas de liste : la fonction prend un identifiant et n'a pas de variante sans argument.
  assert (select count(*) from pg_proc where proname = 'get_public_profile') = 1, 'une seule fonction';
end $$;

-- Anciennes colonnes inchangées, l'identifiant du joueur ajouté en dernier ------------------------------

do $$
begin
  assert pg_get_function_result('public.get_leaderboards()'::regprocedure)
    = 'TABLE(board text, rank integer, pseudo text, avatar text, score integer, is_me boolean, user_id uuid)',
    'get_leaderboards : anciennes colonnes, puis user_id';
  assert pg_get_function_result('public.get_friends()'::regprocedure)
    = 'TABLE(friendship_id uuid, pseudo text, avatar text, points integer, rank integer, user_id uuid)',
    'get_friends : anciennes colonnes, puis user_id';
  assert pg_get_function_result('public.get_friend_requests()'::regprocedure)
    = 'TABLE(request_id uuid, pseudo text, avatar text, created_at timestamp with time zone, user_id uuid)',
    'get_friend_requests : anciennes colonnes, puis user_id';
  assert (select bool_and(prosecdef) from pg_proc
    where proname in ('get_leaderboards', 'get_friends', 'get_friend_requests') and pronamespace = 'public'::regnamespace),
    'toujours security definer';
end $$;

-- Les identifiants renvoyés sont les bons.
set role authenticated;
select pg_temp.as_user('f5000000-0000-0000-0000-000000000001');
do $$
begin
  assert (select user_id from public.get_friends() where pseudo = 'Dora') = 'f5000000-0000-0000-0000-000000000004',
    'get_friends : identifiant de Dora';
  assert (select user_id from public.get_leaderboards() where board = 'points' and pseudo = 'Elio')
    = 'f5000000-0000-0000-0000-000000000005', 'get_leaderboards : identifiant d’Elio';
  assert (select bool_and(user_id = 'f5000000-0000-0000-0000-000000000001') from public.get_leaderboards() where is_me),
    'get_leaderboards : ma ligne porte mon identifiant';
  assert not exists (select 1 from public.get_leaderboards() where user_id is null), 'toutes les lignes ont un identifiant';
end $$;
select pg_temp.as_user('f5000000-0000-0000-0000-000000000005');
do $$
begin
  assert (select user_id from public.get_friend_requests() where pseudo = 'Anna') = 'f5000000-0000-0000-0000-000000000001',
    'get_friend_requests : identifiant de l’expéditrice';
end $$;
-- Les invités restent refusés par les trois fonctions.
select pg_temp.as_user('f5000000-0000-0000-0000-000000000006');
select pg_temp.expect_error($$select * from public.get_leaderboards()$$, 'guest_not_ranked');
select pg_temp.expect_error($$select * from public.get_friends()$$, 'guest_not_allowed');
select pg_temp.expect_error($$select * from public.get_friend_requests()$$, 'guest_not_allowed');
reset role;

-- Nettoyage.
delete from auth.users where id::text like 'f5000000-%';

\o
\echo 'profil public : toutes les vérifications sont passées.'
