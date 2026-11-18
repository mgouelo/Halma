-- La langue choisie à l'inscription (ou à la connexion invité) arrive dans les
-- métadonnées du compte (`options.data.language`) : on la copie dans
-- `profiles.language` à la création du profil, sans attendre un appel de
-- l'application. Les comptes déjà créés reprennent leur métadonnée.
-- Une valeur inconnue est ignorée (null = français).

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  wanted text := public.clean_pseudo(new.raw_user_meta_data ->> 'pseudo');
  chosen text := new.raw_user_meta_data ->> 'language';
  candidate text;
begin
  if wanted is not null and wanted <> '' then
    -- Pseudo choisi : s'il est invalide ou déjà pris, l'inscription échoue
    -- (contrainte de format ou index unique) et le client affiche l'erreur.
    candidate := wanted;
  else
    -- Invité (ou inscription sans pseudo) : pseudo généré, unique.
    loop
      candidate := 'invite-' || substr(md5(random()::text || clock_timestamp()::text), 1, 6);
      exit when public.is_pseudo_available(candidate);
    end loop;
  end if;

  insert into public.profiles (id, pseudo, language)
    values (new.id, candidate, case when chosen in ('fr', 'en', 'de', 'es') then chosen end);
  return new;
end;
$$;

update public.profiles p
  set language = u.raw_user_meta_data ->> 'language'
  from auth.users u
  where u.id = p.id
    and p.language is null
    and u.raw_user_meta_data ->> 'language' in ('fr', 'en', 'de', 'es');
