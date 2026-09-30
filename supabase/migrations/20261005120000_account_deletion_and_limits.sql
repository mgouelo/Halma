-- Suppression de compte et limites d'abus.
--
-- Suppression de compte (Edge Function `delete-account`, ou tableau de bord
-- Supabase) : supprimer l'utilisateur dans auth.users supprime son profil, et
-- tout ce qui en dépend part en cascade. Avant cela, un trigger sur profiles
-- (prepare_account_deletion) évite de casser les rooms des autres :
-- - salles d'attente : le joueur les quitte (comme leave_room) ;
-- - rooms dont il est l'hôte : l'hôte passe au joueur humain suivant (ordre des
--   places) ; s'il ne reste aucun autre humain, la room est supprimée ;
-- - parties lancées : sa place reste (ordre du tour, couleurs), avec
--   user_id = null (« Compte supprimé ») ; l'arbitre le déclare forfait
--   (l'Edge Function l'a normalement déjà fait abandonner).
-- Profil, statistiques (player_stats) et victoires comptées (stats_wins)
-- disparaissent avec le compte : il sort des classements.
--
-- Limites d'abus : 10 codes de room inconnus au plus par tranche de 10 minutes
-- et par joueur, 5 rooms en attente au plus par joueur.

-- Place d'un compte supprimé ------------------------------------------------------

alter table public.room_players
  drop constraint room_players_user_id_fkey,
  add constraint room_players_user_id_fkey
    foreign key (user_id) references public.profiles (id) on delete set null;

-- Un participant est un humain, une IA, ou (dans une partie lancée) un compte supprimé.
alter table public.room_players
  drop constraint room_players_kind,
  add constraint room_players_kind check (user_id is null or ai_level is null);

comment on column public.room_players.user_id is
  'Joueur humain ; null pour une IA (ai_level) ou pour un compte supprimé après le lancement (ni l’un ni l’autre).';

-- Avant la suppression d'un profil -------------------------------------------------

create function public.prepare_account_deletion(p_user uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  r public.rooms;
  next_host uuid;
begin
  -- Salles d'attente : le joueur les quitte.
  for r in
    select ro.* from public.rooms ro
    join public.room_players rp on rp.room_id = ro.id
    where rp.user_id = p_user and ro.status = 'waiting'
    for update of ro
  loop
    delete from public.room_players where room_id = r.id and user_id = p_user;
  end loop;

  -- Rooms dont il est l'hôte, quel que soit leur statut : l'hôte passe au joueur
  -- humain suivant ; sans autre humain, la room (et sa partie) est supprimée.
  for r in select * from public.rooms where host_id = p_user for update loop
    -- (profil encore présent : plusieurs comptes peuvent être supprimés d'un coup)
    select rp.user_id into next_host from public.room_players rp
      join public.profiles p on p.id = rp.user_id
      where rp.room_id = r.id and rp.user_id <> p_user
      order by rp.seat limit 1;
    if next_host is null then
      delete from public.rooms where id = r.id;
    else
      update public.rooms set host_id = next_host where id = r.id;
    end if;
  end loop;
end;
$$;

revoke all on function public.prepare_account_deletion(uuid) from public, anon, authenticated;
grant execute on function public.prepare_account_deletion(uuid) to service_role;

create function public.before_profile_delete()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.prepare_account_deletion(old.id);
  return old;
end;
$$;

revoke all on function public.before_profile_delete() from public, anon, authenticated;

create trigger profiles_before_delete
  before delete on public.profiles
  for each row execute function public.before_profile_delete();

-- Limite d'essais de codes de room ---------------------------------------------

-- Codes inconnus essayés par chaque joueur (vidée par cleanup_abandoned_rooms).
create table public.room_join_failures (
  id bigint generated always as identity primary key,
  user_id uuid not null references public.profiles (id) on delete cascade,
  attempted_at timestamptz not null default now()
);

comment on table public.room_join_failures is
  'Codes de room inconnus essayés (limite : 10 par tranche de 10 minutes et par joueur).';

create index room_join_failures_user_idx on public.room_join_failures (user_id, attempted_at);

alter table public.room_join_failures enable row level security;
revoke all on public.room_join_failures from anon, authenticated;
grant select, insert, delete on public.room_join_failures to service_role;

-- join_room : même contrat, sauf qu'un code inconnu renvoie null au lieu de
-- lever room_not_found (une exception annulerait l'enregistrement de l'essai).
-- Après 10 codes inconnus en 10 minutes : too_many_attempts, même pour un bon code.
create or replace function public.join_room(p_code text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := public.require_player();
  r public.rooms;
  seat_no smallint;
begin
  if (select count(*) from public.room_join_failures
      where user_id = me and attempted_at > now() - interval '10 minutes') >= 10 then
    raise exception 'too_many_attempts';
  end if;
  select * into r from public.rooms where code = upper(btrim(p_code)) for update;
  if not found then
    insert into public.room_join_failures (user_id) values (me);
    return null;
  end if;
  if exists (select 1 from public.room_players where room_id = r.id and user_id = me) then
    update public.room_players set last_seen_at = now() where room_id = r.id and user_id = me;
    return r.id;
  end if;
  if r.status <> 'waiting' then
    raise exception 'room_started';
  end if;
  seat_no := public.free_seat(r.id);
  if seat_no is null then
    raise exception 'room_full';
  end if;
  insert into public.room_players (room_id, seat, user_id) values (r.id, seat_no, me);
  return r.id;
end;
$$;

-- create_room : 5 rooms en attente au plus par joueur.
create or replace function public.create_room()
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := public.require_player();
  new_code text;
  room_id uuid;
begin
  if (select count(*) from public.rooms ro
      join public.room_players rp on rp.room_id = ro.id
      where rp.user_id = me and ro.status = 'waiting') >= 5 then
    raise exception 'too_many_rooms';
  end if;
  loop
    new_code := public.generate_room_code();
    exit when not exists (select 1 from public.rooms where code = new_code);
  end loop;
  insert into public.rooms (code, host_id) values (new_code, me) returning id into room_id;
  insert into public.room_players (room_id, seat, user_id) values (room_id, 0, me);
  return room_id;
end;
$$;
