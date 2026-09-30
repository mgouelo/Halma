-- Profils des joueurs : un profil par compte Supabase Auth (e-mail ou invité anonyme).
--
-- - Le profil est créé automatiquement à l'inscription (trigger sur auth.users) :
--   le pseudo vient des métadonnées d'inscription (`options.data.pseudo`), ou
--   « invite-xxxxxx » pour une connexion invité.
-- - Pseudo unique sans tenir compte de la casse, 3 à 20 caractères parmi
--   lettres (accents compris, tous alphabets), chiffres, « _ » et « - ».
--   Les comparaisons utilisent la collation ICU « und-x-icu » : avec la
--   collation « C » par défaut, lower('É') reste 'É' et [[:alpha:]] refuse 'é'.
--   Le pseudo est stocké normalisé en NFC, pour qu'un « é » précomposé et un
--   « e » suivi d'un accent combinant ne donnent pas deux pseudos identiques à l'œil.
-- - Row Level Security : tout utilisateur connecté (invités compris) peut lire
--   les profils ; chacun ne peut modifier que son pseudo et son avatar.

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  pseudo text not null,
  -- Avatar Humation (identifiant ou configuration sérialisée), défini à l'étape 6.
  avatar text,
  created_at timestamptz not null default now(),
  constraint profiles_pseudo_format check ((pseudo collate "und-x-icu") ~ '^[[:alpha:][:digit:]_-]{3,20}$'),
  constraint profiles_pseudo_nfc check (pseudo is nfc normalized)
);

comment on table public.profiles is 'Profil public de chaque joueur (pseudo, avatar).';

create unique index profiles_pseudo_unique on public.profiles (lower(pseudo collate "und-x-icu"));

-- Row Level Security ------------------------------------------------------

alter table public.profiles enable row level security;

create policy "Profils lisibles par les joueurs connectés"
  on public.profiles for select
  to authenticated
  using (true);

create policy "Chacun modifie son propre profil"
  on public.profiles for update
  to authenticated
  using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);

-- Pas de politique insert ni delete : le profil est créé par le trigger
-- ci-dessous et supprimé avec le compte (on delete cascade).

-- Seuls le pseudo et l'avatar sont modifiables par les clients.
revoke all on public.profiles from anon, authenticated;
grant select on public.profiles to authenticated;
grant update (pseudo, avatar) on public.profiles to authenticated;

-- Pseudo disponible ? ------------------------------------------------------
-- Appelable avant l'inscription (rôle anon), sans exposer la table.

create function public.is_pseudo_available(candidate text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select not exists (
    select 1 from public.profiles
    where lower(pseudo collate "und-x-icu") = lower(normalize(btrim(candidate), nfc) collate "und-x-icu")
  );
$$;

revoke all on function public.is_pseudo_available(text) from public;
grant execute on function public.is_pseudo_available(text) to anon, authenticated;

-- Création du profil à l'inscription --------------------------------------

create function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  wanted text := normalize(btrim(new.raw_user_meta_data ->> 'pseudo'), nfc);
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

revoke all on function public.handle_new_user() from public, anon, authenticated;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
