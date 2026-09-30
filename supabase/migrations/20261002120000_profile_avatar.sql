-- Avatars Humation : `profiles.avatar` contient la configuration de l'avatar
-- (JSON `{ "v": 1, "selections": …, "colors": …, "background": … }`, environ
-- 250 caractères) ou une simple graine. Null : avatar tiré de l'identifiant.
--
-- Le contenu est relu avec prudence par l'application (morceaux inconnus et
-- couleurs invalides ignorés) ; la base se contente d'en borner la taille.

comment on column public.profiles.avatar is
  'Avatar Humation : configuration JSON (v, selections, colors, background) ou graine ; null = avatar tiré de l’identifiant.';

alter table public.profiles
  add constraint profiles_avatar_length check (avatar is null or char_length(avatar) <= 1000);
