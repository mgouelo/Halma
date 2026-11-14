-- Pseudos : « é », « è », « É », « È » et l'apostrophe droite, puis changement
-- de pseudo depuis le profil (au plus une fois tous les 7 jours).
--
-- Format (même règle que src/auth/validation.ts) :
-- - 3 à 20 caractères parmi A-Z, a-z, 0-9, « _ », « - », « . », « é », « è »,
--   « É », « È » et « ' » (apostrophe droite) ; aucun autre accent ;
-- - au moins 3 lettres (les quatre lettres accentuées comptent) ;
-- - l'apostrophe n'est ni la première, ni la dernière, ni doublée.
-- Les caractères permis sont écrits un par un (pas de classe [:alpha:] ni
-- d'intervalle) : la règle ne dépend pas de la locale de la base. Les pseudos
-- existants (ASCII) restent valides.
--
-- Unicité : sans tenir compte de la casse, des accents ni des apostrophes
-- (« Zoé » = « zoe », « Élodie » = « elodie », « Dan' » = « Dan »), pour éviter
-- l'usurpation d'identité. La clé est construite avec translate() et une table
-- de correspondance explicite, pas avec lower(), dont le résultat dépend de la
-- locale (É n'est pas mis en minuscule en locale C, I devient ı en turc).
--
-- Changement de pseudo : uniquement par change_pseudo(), qui vérifie format,
-- unicité et délai. Les clients ne peuvent plus modifier la colonne pseudo
-- directement (ils gardent l'avatar). Le premier choix d'un invité (pseudo
-- actuel « invite-… ») n'est pas soumis au délai.

-- Fonctions de pseudo -------------------------------------------------------

-- Forme enregistrée : sans espaces autour, unicode NFC (un clavier peut envoyer
-- « e » suivi d'un accent séparé), apostrophe courbe convertie en apostrophe droite.
create function public.clean_pseudo(candidate text)
returns text
language sql
immutable
parallel safe
as $$
  select pg_catalog.replace(normalize(pg_catalog.btrim(candidate), NFC), '’', '''');
$$;

-- Format d'un pseudo (déjà nettoyé).
create function public.is_valid_pseudo(candidate text)
returns boolean
language sql
immutable
parallel safe
as $$
  select coalesce(
    candidate ~ '^[ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789éèÉÈ._''-]{3,20}$'
      and pg_catalog.char_length(
        pg_catalog.regexp_replace(candidate, '[^ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyzéèÉÈ]', '', 'g')
      ) >= 3
      and pg_catalog.left(candidate, 1) <> ''''
      and pg_catalog.right(candidate, 1) <> ''''
      and pg_catalog.strpos(candidate, '''''') = 0,
    false
  );
$$;

-- Clé d'unicité : majuscules en minuscules, é è É È en « e », apostrophes retirées
-- (la dernière lettre de la liste de départ, sans correspondance, est supprimée).
create function public.pseudo_key(pseudo text)
returns text
language sql
immutable
parallel safe
as $$
  select pg_catalog.translate(
    pseudo,
    'ABCDEFGHIJKLMNOPQRSTUVWXYZéèÉÈ''',
    'abcdefghijklmnopqrstuvwxyzeeee'
  );
$$;

-- Format et unicité ---------------------------------------------------------

alter table public.profiles
  drop constraint profiles_pseudo_format,
  drop constraint profiles_pseudo_letters,
  add constraint profiles_pseudo_format check (public.is_valid_pseudo(pseudo));

-- La nouvelle clé confond plus de pseudos que lower() : elle remplace l'ancien index.
create unique index profiles_pseudo_key_unique on public.profiles (public.pseudo_key(pseudo));
drop index public.profiles_pseudo_unique;

-- Date du dernier changement de pseudo (null : jamais changé depuis l'inscription).
alter table public.profiles add column pseudo_changed_at timestamptz;

comment on column public.profiles.pseudo_changed_at is
  'Dernier changement de pseudo par change_pseudo() ; null si jamais changé. Délai de 7 jours entre deux changements.';

-- Le pseudo ne change plus que par change_pseudo() ; l'avatar reste modifiable directement.
revoke update (pseudo) on public.profiles from authenticated;

-- Pseudo disponible ? ---------------------------------------------------------
-- Appelable avant l'inscription (rôle anon). Le joueur connecté ne se gêne pas
-- lui-même : « Zoe » peut devenir « Zoé ».

create or replace function public.is_pseudo_available(candidate text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select not exists (
    select 1 from public.profiles
    where public.pseudo_key(pseudo) = public.pseudo_key(public.clean_pseudo(candidate))
      and id is distinct from (select auth.uid())
  );
$$;

-- Création du profil à l'inscription : même nettoyage du pseudo choisi. --------

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  wanted text := public.clean_pseudo(new.raw_user_meta_data ->> 'pseudo');
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

  insert into public.profiles (id, pseudo) values (new.id, candidate);
  return new;
end;
$$;

-- Changer de pseudo -------------------------------------------------------------
-- Erreurs (message court, traduit par l'application) :
-- - not_authenticated : pas de joueur connecté ;
-- - pseudo_invalid : format refusé ;
-- - pseudo_reserved : commence par « invite- » ;
-- - pseudo_taken : déjà pris (casse, accents et apostrophes ignorés) ;
-- - pseudo_too_soon : moins de 7 jours depuis le dernier changement ; le détail
--   de l'erreur donne la date à partir de laquelle c'est possible (ISO 8601).
-- Renvoie le pseudo enregistré. Redonner son pseudo actuel ne change rien.

create function public.change_pseudo(new_pseudo text)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := (select auth.uid());
  wanted text := public.clean_pseudo(new_pseudo);
  current_pseudo text;
  changed_at timestamptz;
  first_choice boolean;
  next_change timestamptz;
begin
  if me is null then
    raise exception 'not_authenticated' using errcode = '42501';
  end if;
  if not public.is_valid_pseudo(wanted) then
    raise exception 'pseudo_invalid';
  end if;
  if pg_catalog.starts_with(public.pseudo_key(wanted), 'invite-') then
    raise exception 'pseudo_reserved';
  end if;

  select p.pseudo, p.pseudo_changed_at into current_pseudo, changed_at
    from public.profiles p where p.id = me for update;
  if not found then
    raise exception 'not_authenticated' using errcode = '42501';
  end if;
  if wanted = current_pseudo then
    return current_pseudo;
  end if;

  if exists (
    select 1 from public.profiles p
    where public.pseudo_key(p.pseudo) = public.pseudo_key(wanted) and p.id <> me
  ) then
    raise exception 'pseudo_taken';
  end if;

  -- Premier choix d'un invité : comme à l'inscription, ni délai ni date enregistrée.
  first_choice := current_pseudo like 'invite-%';
  if not first_choice and changed_at is not null then
    next_change := changed_at + interval '7 days';
    if now() < next_change then
      raise exception 'pseudo_too_soon'
        using detail = pg_catalog.to_char(next_change at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"');
    end if;
  end if;

  begin
    update public.profiles
      set pseudo = wanted,
          pseudo_changed_at = case when first_choice then pseudo_changed_at else now() end
      where id = me;
  exception when unique_violation then
    -- Pris entre-temps par un autre joueur.
    raise exception 'pseudo_taken';
  end;
  return wanted;
end;
$$;

revoke all on function public.change_pseudo(text) from public, anon;
grant execute on function public.change_pseudo(text) to authenticated;
