-- Langue de l'application de chaque joueur (fr, en, de, es).
--
-- Sert à écrire les e-mails du compte dans la langue du joueur. Les modèles
-- d'e-mails de Supabase ne lisent que les métadonnées du compte
-- (`{{ .Data.language }}`, voir docs/emails/README.md) : l'application les
-- remplit elle aussi (`auth.updateUser({ data: { language } })`). La colonne
-- garde la langue côté base, pour tout envoi futur fait par le serveur.
--
-- - Valeur nulle tant que l'application ne l'a pas envoyée (comptes créés avant
--   cette migration, ou application pas encore à jour) : on écrit alors en français.
-- - Donnée privée : la langue n'est jamais montrée aux autres joueurs. Les
--   joueurs connectés gardent la lecture des colonnes publiques du profil
--   (pseudo, avatar…, pour les rooms, classements, amis et profils publics),
--   mais plus de `language` ; personne ne la modifie directement.
-- - Chacun change la sienne par set_my_language(), et la relit par my_language().

alter table public.profiles
  add column language text
  constraint profiles_language_check check (language in ('fr', 'en', 'de', 'es'));

comment on column public.profiles.language is
  'Langue de l’application du joueur (fr, en, de, es) pour les e-mails ; null = français. Privée : lue par my_language().';

-- Lecture colonne par colonne : toutes les colonnes existantes restent lisibles
-- par les joueurs connectés (rien ne change pour les écrans), sauf `language`.
-- Les fonctions SQL des classements, des amis et du profil public sont en
-- « security definer » : elles ne dépendent pas de ces droits.
revoke select on public.profiles from authenticated;
grant select (id, pseudo, avatar, created_at, pseudo_changed_at) on public.profiles to authenticated;

-- Changer sa langue --------------------------------------------------------

create function public.set_my_language(p_language text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := (select auth.uid());
begin
  if me is null then
    raise exception 'not_authenticated';
  end if;
  if p_language is null or p_language not in ('fr', 'en', 'de', 'es') then
    raise exception 'bad_request';
  end if;
  update public.profiles set language = p_language where id = me;
end;
$$;

revoke all on function public.set_my_language(text) from public, anon;
grant execute on function public.set_my_language(text) to authenticated;

-- Relire sa langue ---------------------------------------------------------

create function public.my_language()
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select language from public.profiles where id = (select auth.uid());
$$;

revoke all on function public.my_language() from public, anon;
grant execute on function public.my_language() to authenticated;
