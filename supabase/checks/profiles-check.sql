-- Vérifications de la migration profiles (trigger, unicité, RLS, droits).
-- À lancer après auth-stub.sql et les migrations : voir scripts/check-db.sh.
-- Chaque vérification lève une exception en cas d'échec.

\set ON_ERROR_STOP on

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

-- Accents : acceptés, normalisés en NFC, et la casse est ignorée aussi pour les lettres accentuées.
insert into auth.users (id, email, raw_user_meta_data) values
  ('44444444-4444-4444-4444-444444444444', 'elodie@example.com', '{"pseudo": "Élodie"}'),
  -- « Zoë » écrit avec un e suivi du tréma combinant (U+0308) : stocké en NFC.
  ('55555555-5555-5555-5555-555555555555', 'zoe@example.com', jsonb_build_object('pseudo', 'Zoe' || U&'\0308'));

do $$
begin
  assert (select pseudo from public.profiles where id = '44444444-4444-4444-4444-444444444444') = 'Élodie',
    'un pseudo accentué est accepté';
  assert (select pseudo from public.profiles where id = '55555555-5555-5555-5555-555555555555') = 'Zoë',
    'le pseudo est normalisé en NFC à l''inscription';
end $$;

do $$
begin
  insert into auth.users (email, raw_user_meta_data) values ('e2@example.com', '{"pseudo": "éLODIE"}');
  raise exception 'Élodie et éLODIE devraient être considérés comme le même pseudo';
exception when unique_violation then null;
end $$;

do $$
declare bad text;
begin
  foreach bad in array array['emoji😀', 'deux mots', 'point.', 'ab'] loop
    begin
      insert into auth.users (email, raw_user_meta_data) values (bad || '@example.com', jsonb_build_object('pseudo', bad));
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
  assert not public.is_pseudo_available('ÉLODIE'), 'ÉLODIE est pris (casse ignorée, accents compris)';
  assert not public.is_pseudo_available('Zoe' || U&'\0308'), 'Zoë est pris, quelle que soit sa forme Unicode';
  assert public.is_pseudo_available('Elodie'), 'Elodie sans accent reste un autre pseudo';
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

  update public.profiles set pseudo = 'Alice2', avatar = 'seed-123' where id = '11111111-1111-1111-1111-111111111111';
  get diagnostics n = row_count;
  assert n = 1, 'Alice modifie son propre profil';

  update public.profiles set pseudo = 'pirate' where id = '22222222-2222-2222-2222-222222222222';
  get diagnostics n = row_count;
  assert n = 0, 'Alice ne modifie pas le profil de Bob';
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

do $$
begin
  update public.profiles set pseudo = 'Ali' || U&'\0301' || 'ce' where id = '11111111-1111-1111-1111-111111111111';
  raise exception 'un pseudo non normalisé (NFD) ne devrait pas être accepté';
exception when check_violation then null;
end $$;

do $$
begin
  update public.profiles set pseudo = 'BOB_42' where id = '11111111-1111-1111-1111-111111111111';
  raise exception 'un pseudo déjà pris ne devrait pas être accepté';
exception when unique_violation then null;
end $$;
reset role;

-- Supprimer le compte supprime le profil.
delete from auth.users where id = '22222222-2222-2222-2222-222222222222';
do $$
begin
  assert not exists (select 1 from public.profiles where id = '22222222-2222-2222-2222-222222222222'),
    'le profil suit la suppression du compte';
end $$;

\echo 'profiles : toutes les vérifications sont passées.'
