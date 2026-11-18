-- Vérifications de la migration profile_language (langue du joueur, privée).
-- À lancer après auth-stub.sql et les migrations : voir scripts/check-db.sh.
-- Chaque vérification lève une exception en cas d'échec.

\set ON_ERROR_STOP on

insert into auth.users (id, email, raw_user_meta_data) values
  ('c1000000-0000-0000-0000-000000000001', 'lena@example.com', '{"pseudo": "Lena"}'),
  ('c1000000-0000-0000-0000-000000000002', 'tom@example.com', '{"pseudo": "Tomas"}');

do $$
begin
  assert (select language from public.profiles where id = 'c1000000-0000-0000-0000-000000000001') is null,
    'sans choix, pas de langue enregistrée (français par défaut)';
end $$;

-- La langue choisie à l'inscription est copiée dans le profil ; une valeur inconnue est ignorée.
insert into auth.users (id, email, raw_user_meta_data) values
  ('c1000000-0000-0000-0000-000000000003', 'ana@example.com', '{"pseudo": "Anabel", "language": "es"}'),
  ('c1000000-0000-0000-0000-000000000004', 'kim@example.com', '{"pseudo": "Kimberly", "language": "xx"}');
do $$
begin
  assert (select language from public.profiles where id = 'c1000000-0000-0000-0000-000000000003') = 'es',
    'la langue d’inscription est copiée dans le profil';
  assert (select language from public.profiles where id = 'c1000000-0000-0000-0000-000000000004') is null,
    'une langue inconnue est ignorée';
end $$;

-- Lena connectée.
set role authenticated;
set request.jwt.claim.sub = 'c1000000-0000-0000-0000-000000000001';

do $$
begin
  perform public.set_my_language('de');
  assert public.my_language() = 'de', 'Lena relit sa langue';

  -- Les colonnes publiques du profil restent lisibles (rooms, amis, classements).
  assert (select pseudo from public.profiles where id = 'c1000000-0000-0000-0000-000000000002') = 'Tomas',
    'le pseudo des autres reste lisible';
  assert (select count(*) from public.profiles) >= 2, 'les profils restent comptables (count(*))';
end $$;

do $$
begin
  perform public.set_my_language('it');
  raise exception 'une langue inconnue devrait être refusée';
exception when others then
  if sqlerrm <> 'bad_request' then raise; end if;
end $$;

-- La langue des autres n'est pas lisible, ni la sienne en direct (seulement par my_language()).
do $$
begin
  perform language from public.profiles where id = 'c1000000-0000-0000-0000-000000000002';
  raise exception 'la langue des autres joueurs ne devrait pas être lisible';
exception when insufficient_privilege then null;
end $$;

do $$
begin
  perform * from public.profiles;
  raise exception 'select * ne devrait pas passer (la colonne language est privée)';
exception when insufficient_privilege then null;
end $$;

-- Personne ne modifie la langue directement, même la sienne.
do $$
begin
  update public.profiles set language = 'es' where id = 'c1000000-0000-0000-0000-000000000001';
  raise exception 'la langue ne devrait se changer que par set_my_language()';
exception when insufficient_privilege then null;
end $$;

-- Tom ne change que la sienne.
set request.jwt.claim.sub = 'c1000000-0000-0000-0000-000000000002';
do $$
begin
  perform public.set_my_language('es');
  assert public.my_language() = 'es', 'Tom relit sa langue';
end $$;

reset role;

do $$
begin
  assert (select language from public.profiles where id = 'c1000000-0000-0000-0000-000000000001') = 'de',
    'la langue de Lena n’a pas bougé';
  assert (select language from public.profiles where id = 'c1000000-0000-0000-0000-000000000002') = 'es',
    'la langue de Tom est enregistrée';
end $$;

-- Sans session : refusé.
set role anon;
do $$
begin
  perform public.set_my_language('en');
  raise exception 'un visiteur sans compte ne devrait pas pouvoir appeler set_my_language';
exception when insufficient_privilege then null;
end $$;
reset role;
