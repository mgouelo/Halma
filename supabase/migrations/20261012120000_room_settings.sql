-- Réglages d'une room : les mutateurs de partie.
--
-- Deux options d'interface, activables ou non, que l'hôte règle dans la salle
-- d'attente et que tous les joueurs appliquent pareil :
-- - « touch_move » (Toucher c'est jouer, désactivé par défaut) : un pion touché
--   qui peut bouger doit être joué ;
-- - « clairvoyance » (activée par défaut) : les cases atteignables du pion
--   choisi sont affichées.
-- Ce sont des options d'INTERFACE : le moteur et l'Edge Function `game-action`
-- ne les lisent pas et valident les coups comme avant. Elles ne sont donc pas
-- vérifiées côté serveur, et ne changent rien aux statistiques ni aux classements.
--
-- Écriture : uniquement par la fonction `set_room_settings`, appelée par l'hôte
-- d'une room en attente ; elles sont donc figées au lancement de la partie.
-- Lecture : comme le reste de la room (RLS « Rooms lisibles par leurs joueurs »),
-- et diffusées par Realtime (la table `rooms` est déjà publiée).

-- Forme des réglages ----------------------------------------------------------

-- Un objet JSON dont chaque clé est un mutateur connu et chaque valeur un booléen.
-- Fonction pure, laissée exécutable par tous : la contrainte CHECK l'appelle à
-- chaque écriture de `rooms`, y compris celles de l'Edge Function (service_role).
create function public.valid_room_settings(p_settings jsonb)
returns boolean
language sql
immutable
set search_path = ''
as $$
  -- « case » : jsonb_each n'est appelé que sur un objet (un « and » ne garantit pas l'ordre).
  select case
    when p_settings is null or jsonb_typeof(p_settings) <> 'object' then false
    else not exists (
      select 1
      from jsonb_each(p_settings) as entry (key, value)
      where entry.key not in ('touch_move', 'clairvoyance')
         or jsonb_typeof(entry.value) <> 'boolean'
    )
  end;
$$;

alter table public.rooms
  add column settings jsonb not null default '{"touch_move": false, "clairvoyance": true}'::jsonb,
  add constraint rooms_settings_shape check (public.valid_room_settings(settings));

comment on column public.rooms.settings is
  'Mutateurs de partie (options d''interface, non vérifiées par le serveur) : touch_move, clairvoyance. Réglés par l''hôte avant le lancement.';

-- Réglage par l'hôte ------------------------------------------------------------

-- Change un ou plusieurs mutateurs (les clés absentes gardent leur valeur) ;
-- renvoie les réglages à jour. Refusé à un autre joueur (« not_host »), après le
-- lancement (« room_started ») et pour toute valeur invalide (« bad_request »).
create function public.set_room_settings(p_room uuid, p_settings jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := public.require_player();
  updated jsonb;
begin
  perform public.lock_hosted_room(p_room, me);
  if not public.valid_room_settings(p_settings) then
    raise exception 'bad_request';
  end if;
  update public.rooms set settings = settings || p_settings where id = p_room returning settings into updated;
  return updated;
end;
$$;

revoke all on function public.set_room_settings(uuid, jsonb) from public, anon;
grant execute on function public.set_room_settings(uuid, jsonb) to authenticated;
