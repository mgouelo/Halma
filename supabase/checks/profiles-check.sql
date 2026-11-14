-- Vérifications de la migration profiles (trigger, unicité, RLS, droits).
-- À lancer après auth-stub.sql et les migrations : voir scripts/check-db.sh.
-- Chaque vérification lève une exception en cas d'échec.

\set ON_ERROR_STOP on

-- Vérifie qu'une instruction échoue avec le message ou le code attendu.
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

-- Deux comptes e-mail et un invité.
insert into auth.users (id, email, raw_user_meta_data) values
  ('11111111-1111-1111-1111-111111111111', 'alice@example.com', '{"pseudo": "Alice"}'),
  ('22222222-2222-2222-2222-222222222222', 'bob@example.com', '{"pseudo": "bob_42"}');
insert into auth.users (id, is_anonymous) values ('33333333-3333-3333-3333-333333333333', true);

do $$
begin
  assert (select pseudo from public.profiles where id = '11111111-1111-1111-1111-111111111111') = 'Alice',
    'le pseudo choisi est repris dans le profil';
  assert (select pseudo from public.profiles where id = '33333333-3333-3333-3333-333333333333') ~ '^invite-[0-9a-f]{6}$',
    'un invité reçoit un pseudo généré';
  assert (select created_at from public.profiles where id = '22222222-2222-2222-2222-222222222222') is not null,
    'created_at est rempli';
end $$;

-- Pseudo déjà pris (casse différente) : l'inscription échoue.
do $$
begin
  insert into auth.users (email, raw_user_meta_data) values ('x@example.com', '{"pseudo": "ALICE"}');
  raise exception 'un pseudo déjà pris aurait dû être refusé';
exception when unique_violation then null;
end $$;

-- Pseudo invalide : l'inscription échoue.
do $$
begin
  insert into auth.users (email, raw_user_meta_data) values ('y@example.com', '{"pseudo": "a b"}');
  raise exception 'un pseudo invalide aurait dû être refusé';
exception when check_violation then null;
end $$;

-- Points, tirets et soulignés acceptés ; casse ignorée.
insert into auth.users (id, email, raw_user_meta_data) values
  ('44444444-4444-4444-4444-444444444444', 'jean@example.com', '{"pseudo": "Jean.Dupont-2_b"}'),
  -- Exactement 3 lettres, dispersées : accepté.
  ('55555555-5555-5555-5555-555555555555', 'abc@example.com', '{"pseudo": "a1-b2.c3"}');

do $$
begin
  assert (select pseudo from public.profiles where id = '44444444-4444-4444-4444-444444444444') = 'Jean.Dupont-2_b',
    'points, tirets et soulignés sont acceptés';
end $$;

do $$
begin
  insert into auth.users (email, raw_user_meta_data) values ('j2@example.com', '{"pseudo": "jean.DUPONT-2_B"}');
  raise exception 'Jean.Dupont-2_b et jean.DUPONT-2_B devraient être le même pseudo';
exception when unique_violation then null;
end $$;

-- Moins de 3 lettres refusé.
do $$
declare bad text;
begin
  foreach bad in array array['...', '---', '12345', 'a1b2', 'x.y.1', '__a_b__'] loop
    begin
      insert into auth.users (email, raw_user_meta_data) values (md5(bad) || '@example.com', jsonb_build_object('pseudo', bad));
      raise exception 'le pseudo « % » (moins de 3 lettres) aurait dû être refusé', bad;
    exception when check_violation then null;
    end;
  end loop;
end $$;

-- Autres accents, espaces, émojis et autre ponctuation refusés (é, è, É, È et
-- l'apostrophe sont vérifiés plus bas).
do $$
declare bad text;
begin
  foreach bad in array array['Zoë', 'Agnès-ê', 'emoji😀', 'deux mots', 'point!', 'a,b', 'ab', repeat('a', 21)] loop
    begin
      insert into auth.users (email, raw_user_meta_data) values (md5(bad) || '@example.com', jsonb_build_object('pseudo', bad));
      raise exception 'le pseudo « % » aurait dû être refusé', bad;
    exception when check_violation then null;
    end;
  end loop;
end $$;

-- Disponibilité d'un pseudo, appelée avant inscription (rôle anon).
set role anon;
do $$
begin
  assert public.is_pseudo_available('Charlie'), 'Charlie est libre';
  assert not public.is_pseudo_available('alice'), 'alice est pris (casse ignorée)';
  assert not public.is_pseudo_available(' JEAN.dupont-2_B '), 'Jean.Dupont-2_b est pris (casse et espaces ignorés)';
  assert public.is_pseudo_available('Jean.Dupont'), 'Jean.Dupont est un autre pseudo';
end $$;

-- anon ne lit pas la table.
do $$
begin
  perform 1 from public.profiles;
  raise exception 'anon ne devrait pas pouvoir lire profiles';
exception when insufficient_privilege then null;
end $$;
reset role;

-- Alice connectée.
set role authenticated;
set request.jwt.claim.sub = '11111111-1111-1111-1111-111111111111';
do $$
declare n int;
begin
  assert (select count(*) from public.profiles) = 5, 'un joueur connecté lit tous les profils';

  update public.profiles set avatar = 'seed-123' where id = '11111111-1111-1111-1111-111111111111';
  get diagnostics n = row_count;
  assert n = 1, 'Alice modifie son propre avatar';

  update public.profiles set avatar = 'pirate' where id = '22222222-2222-2222-2222-222222222222';
  get diagnostics n = row_count;
  assert n = 0, 'Alice ne modifie pas le profil de Bob';
end $$;

-- Le pseudo ne se modifie plus directement : seulement par change_pseudo().
do $$
begin
  update public.profiles set pseudo = 'Alice2' where id = '11111111-1111-1111-1111-111111111111';
  raise exception 'le pseudo ne devrait plus être modifiable directement';
exception when insufficient_privilege then null;
end $$;

do $$
begin
  update public.profiles set pseudo_changed_at = null where id = '11111111-1111-1111-1111-111111111111';
  raise exception 'pseudo_changed_at ne devrait pas être modifiable';
exception when insufficient_privilege then null;
end $$;

do $$
begin
  update public.profiles set created_at = now() where id = '11111111-1111-1111-1111-111111111111';
  raise exception 'created_at ne devrait pas être modifiable';
exception when insufficient_privilege then null;
end $$;

do $$
begin
  insert into public.profiles (id, pseudo) values (gen_random_uuid(), 'intrus');
  raise exception 'un client ne devrait pas pouvoir créer de profil';
exception when insufficient_privilege then null;
end $$;

do $$
begin
  delete from public.profiles where id = '11111111-1111-1111-1111-111111111111';
  raise exception 'un client ne devrait pas pouvoir supprimer de profil';
exception when insufficient_privilege then null;
end $$;

select pg_temp.expect_error($$select public.change_pseudo('Alïce')$$, 'pseudo_invalid');
select pg_temp.expect_error($$select public.change_pseudo('BOB_42')$$, 'pseudo_taken');
do $$
begin
  assert public.change_pseudo('Alice2') = 'Alice2', 'Alice change de pseudo avec change_pseudo()';
  assert (select pseudo from public.profiles where id = '11111111-1111-1111-1111-111111111111') = 'Alice2',
    'le nouveau pseudo est enregistré';
end $$;
reset role;

-- Supprimer le compte supprime le profil.
delete from auth.users where id = '22222222-2222-2222-2222-222222222222';
do $$
begin
  assert not exists (select 1 from public.profiles where id = '22222222-2222-2222-2222-222222222222'),
    'le profil suit la suppression du compte';
end $$;

-- é, è, É, È et apostrophe ----------------------------------------------------
-- La base de vérification est en locale C : lower('É') y vaut 'É'. Ces
-- vérifications montrent que format et unicité n'en dépendent pas.

do $$
begin
  assert public.pseudo_key('ÉLODIE') = 'elodie', 'clé : É devient e sans dépendre de la locale';
  assert public.pseudo_key('Zoè') = 'zoe' and public.pseudo_key('ZOÉ') = 'zoe', 'clé : accents ignorés';
  assert public.pseudo_key('d''Artagnan') = 'dartagnan', 'clé : apostrophes retirées';
  assert public.clean_pseudo(' d’Artagnan ') = 'd''Artagnan', 'apostrophe courbe convertie, espaces retirés';
  assert public.clean_pseudo('Ze' || U&'\0301' || 'lie') = 'Zélie', 'e + accent séparé recomposé (NFC)';
end $$;

-- Acceptés à l'inscription (l'apostrophe courbe et l'accent séparé sont nettoyés).
insert into auth.users (id, email, raw_user_meta_data) values
  ('a1000000-0000-0000-0000-000000000001', 'zoe@example.com', '{"pseudo": "Zoé"}'),
  ('a1000000-0000-0000-0000-000000000002', 'elodie@example.com', '{"pseudo": "Élodie"}'),
  ('a1000000-0000-0000-0000-000000000003', 'dan@example.com', '{"pseudo": "Dan"}'),
  ('a1000000-0000-0000-0000-000000000004', 'dart@example.com', '{"pseudo": "d’Artagnan"}'),
  ('a1000000-0000-0000-0000-000000000005', 'helene@example.com', '{"pseudo": "Hélène_È.2"}'),
  ('a1000000-0000-0000-0000-000000000006', 'zelie@example.com', jsonb_build_object('pseudo', 'Ze' || U&'\0301' || 'lie')),
  ('a1000000-0000-0000-0000-000000000007', 'eee@example.com', '{"pseudo": "éèÉ"}'),
  ('a1000000-0000-0000-0000-000000000008', 'frank@example.com', '{"pseudo": "Frank"}');
insert into auth.users (id, is_anonymous) values ('a1000000-0000-0000-0000-000000000009', true);

do $$
begin
  assert (select pseudo from public.profiles where id = 'a1000000-0000-0000-0000-000000000001') = 'Zoé', 'Zoé accepté';
  assert (select pseudo from public.profiles where id = 'a1000000-0000-0000-0000-000000000004') = 'd''Artagnan',
    'apostrophe courbe enregistrée en apostrophe droite';
  assert (select pseudo from public.profiles where id = 'a1000000-0000-0000-0000-000000000005') = 'Hélène_È.2', 'é, è, È acceptés';
  assert (select pseudo from public.profiles where id = 'a1000000-0000-0000-0000-000000000006') = 'Zélie',
    'accent séparé recomposé (NFC)';
  assert (select pseudo_changed_at from public.profiles where id = 'a1000000-0000-0000-0000-000000000001') is null,
    'pas de date de changement à l''inscription';
end $$;

-- Refusés : apostrophe au début, à la fin ou doublée, autres accents, moins de 3 lettres.
do $$
declare bad text;
begin
  foreach bad in array array['''Dan', 'Dan''', 'Da''''n', '''''abc', 'Zoë', 'Zoê', 'Ève-à', 'Ça va', 'é.è', 'é''1', 'Dan‘s', 'Dan`s'] loop
    begin
      insert into auth.users (email, raw_user_meta_data) values (md5(bad) || '@example.com', jsonb_build_object('pseudo', bad));
      raise exception 'le pseudo « % » aurait dû être refusé', bad;
    exception when check_violation then null;
    end;
  end loop;
end $$;

-- Un pseudo non NFC écrit directement (sans nettoyage) est refusé par la contrainte.
do $$
begin
  update public.profiles set pseudo = 'Ze' || U&'\0301' || 'lie2' where id = 'a1000000-0000-0000-0000-000000000006';
  raise exception 'un pseudo non NFC aurait dû être refusé';
exception when check_violation then null;
end $$;

-- Unicité sans tenir compte de la casse, des accents ni des apostrophes.
do $$
declare dup text;
begin
  foreach dup in array array['zoe', 'ZOE', 'Zoè', 'ZOÉ', 'elodie', 'ÉLODIE', 'Èlodie', 'Da''n', 'DAN', 'dartagnan', 'D''Arta''gnan', 'helene_e.2', 'eee', 'EÈé'] loop
    begin
      insert into auth.users (email, raw_user_meta_data) values (md5(dup) || '@example.com', jsonb_build_object('pseudo', dup));
      raise exception '« % » aurait dû être refusé comme déjà pris', dup;
    exception when unique_violation then null;
    end;
  end loop;
end $$;

set role anon;
do $$
begin
  assert not public.is_pseudo_available('zoe'), 'zoe est pris (Zoé)';
  assert not public.is_pseudo_available('ELODIE'), 'ELODIE est pris (Élodie)';
  assert not public.is_pseudo_available('Da''n'), 'Da''n est pris (Dan)';
  assert not public.is_pseudo_available(' D’artagnan '), 'D’artagnan est pris (apostrophe courbe, espaces)';
  assert public.is_pseudo_available('Zoéline'), 'Zoéline est libre';
end $$;
select pg_temp.expect_error($$select public.change_pseudo('Zoéline')$$, '42501');
reset role;

-- Changer de pseudo ---------------------------------------------------------------

set role authenticated;
-- Zoé : peut écrire son propre pseudo autrement (casse, accent), ce n'est pas « déjà pris ».
set request.jwt.claim.sub = 'a1000000-0000-0000-0000-000000000001';
do $$
begin
  assert public.is_pseudo_available('zoe'), 'Zoé ne se gêne pas elle-même';
  assert public.change_pseudo('Zoé') = 'Zoé', 'redonner son pseudo ne change rien';
  assert (select pseudo_changed_at from public.profiles where id = 'a1000000-0000-0000-0000-000000000001') is null,
    'redonner son pseudo ne compte pas comme un changement';
  assert public.change_pseudo('ZOE') = 'ZOE', 'Zoé devient ZOE';
end $$;
select pg_temp.expect_error($$select public.change_pseudo('Élodie')$$, 'pseudo_taken');
select pg_temp.expect_error($$select public.change_pseudo('dan''')$$, 'pseudo_invalid');
select pg_temp.expect_error($$select public.change_pseudo('Dan''s')$$, 'pseudo_too_soon');

-- Frank : format, réservé, déjà pris, nettoyage, puis délai de 7 jours.
set request.jwt.claim.sub = 'a1000000-0000-0000-0000-000000000008';
select pg_temp.expect_error($$select public.change_pseudo('''Frank')$$, 'pseudo_invalid');
select pg_temp.expect_error($$select public.change_pseudo('ab')$$, 'pseudo_invalid');
select pg_temp.expect_error($$select public.change_pseudo(null)$$, 'pseudo_invalid');
select pg_temp.expect_error($$select public.change_pseudo('Invite-Frank')$$, 'pseudo_reserved');
select pg_temp.expect_error($$select public.change_pseudo('invi''te-x')$$, 'pseudo_reserved');
select pg_temp.expect_error($$select public.change_pseudo('dartagnan')$$, 'pseudo_taken');
select pg_temp.expect_error($$select public.change_pseudo('zoé')$$, 'pseudo_taken');
do $$
declare
  detail text;
begin
  assert public.change_pseudo(' Fr’anck ') = 'Fr''anck', 'nouveau pseudo nettoyé et enregistré';
  assert (select pseudo = 'Fr''anck' and pseudo_changed_at > now() - interval '1 minute'
    from public.profiles where id = 'a1000000-0000-0000-0000-000000000008'), 'date du changement enregistrée';
  assert public.change_pseudo('Fr''anck') = 'Fr''anck', 'redonner son pseudo reste permis pendant le délai';
  begin
    perform public.change_pseudo('Frankie');
    raise exception 'un deuxième changement en moins de 7 jours aurait dû être refusé';
  exception when others then
    get stacked diagnostics detail = pg_exception_detail;
    assert sqlerrm = 'pseudo_too_soon', format('erreur inattendue : %s', sqlerrm);
    assert detail::timestamptz between now() + interval '7 days' - interval '1 minute' and now() + interval '7 days',
      format('le détail donne la date du prochain changement : %s', detail);
  end;
  assert (select pseudo from public.profiles where id = 'a1000000-0000-0000-0000-000000000008') = 'Fr''anck',
    'le pseudo refusé n''est pas enregistré';
end $$;
reset role;

-- Huit jours plus tard : de nouveau permis.
update public.profiles set pseudo_changed_at = now() - interval '8 days' where id = 'a1000000-0000-0000-0000-000000000008';
set role authenticated;
set request.jwt.claim.sub = 'a1000000-0000-0000-0000-000000000008';
do $$
begin
  assert public.change_pseudo('Frankie') = 'Frankie', 'permis après 7 jours';
end $$;

-- Invité : le premier choix (pseudo « invite-… ») n'est pas soumis au délai et
-- n'enregistre pas de date ; le changement suivant si.
set request.jwt.claim.sub = 'a1000000-0000-0000-0000-000000000009';
select pg_temp.expect_error($$select public.change_pseudo('Gaëtan')$$, 'pseudo_invalid');
do $$
begin
  assert public.change_pseudo('Gaston') = 'Gaston', 'premier choix d''un invité permis';
  assert (select pseudo_changed_at from public.profiles where id = 'a1000000-0000-0000-0000-000000000009') is null,
    'le premier choix d''un invité n''est pas daté';
  assert public.change_pseudo('Gaspard') = 'Gaspard', 'changement suivant permis (premier choix non daté)';
  assert (select pseudo_changed_at from public.profiles where id = 'a1000000-0000-0000-0000-000000000009') is not null,
    'le changement suivant est daté';
end $$;
select pg_temp.expect_error($$select public.change_pseudo('Gaspardo')$$, 'pseudo_too_soon');
reset role;

-- Nettoyage : les vérifications suivantes comptent les profils.
delete from auth.users where id::text like 'a1000000-%';

\echo 'profiles : toutes les vérifications sont passées.'
