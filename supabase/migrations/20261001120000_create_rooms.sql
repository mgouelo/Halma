-- Jeu en ligne : rooms, participants (joueurs et IA) et parties.
--
-- Qui écrit quoi :
-- - les clients ne peuvent QUE lire (et seulement les rooms dont ils font partie) ;
-- - la salle d'attente passe par des fonctions SQL « security definer » qui
--   vérifient chaque demande : create_room, join_room, leave_room, add_ai,
--   set_ai_level, remove_ai, heartbeat ;
-- - la partie elle-même (lancement, coups, IA, forfaits) passe par l'Edge
--   Function `game-action`, qui valide tout avec le moteur `src/game/` et écrit
--   avec la clé service_role. `begin_game` n'est appelable que par elle.
--
-- Realtime : les trois tables sont publiées dans `supabase_realtime`. Les
-- abonnements « postgres_changes » respectent la RLS : un joueur ne reçoit
-- que les changements de ses rooms.

-- Rooms ---------------------------------------------------------------------

create table public.rooms (
  id uuid primary key default gen_random_uuid(),
  -- Code court à partager : 6 caractères, sans I, L, O, 0 ni 1 (faciles à confondre).
  code text not null unique,
  host_id uuid not null references public.profiles (id) on delete cascade,
  status text not null default 'waiting',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint rooms_code_format check (code ~ '^[A-HJKMNP-Z2-9]{6}$'),
  constraint rooms_status check (status in ('waiting', 'playing', 'finished'))
);

comment on table public.rooms is 'Room de jeu en ligne : code à partager, hôte, statut (attente, en jeu, finie).';

-- Participants : un joueur humain (user_id) ou une IA (ai_level), à une place (seat).
create table public.room_players (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.rooms (id) on delete cascade,
  -- Place dans la salle d'attente (0 à 5) ; l'ordre des places donne l'ordre du tour.
  seat smallint not null,
  user_id uuid references public.profiles (id) on delete cascade,
  ai_level text,
  -- Identifiant du joueur dans le moteur (0 à n-1), attribué au lancement de la partie.
  player_index smallint,
  -- Dernier signe de vie du client (heartbeat) : sert à détecter les déconnexions.
  last_seen_at timestamptz not null default now(),
  joined_at timestamptz not null default now(),
  constraint room_players_seat check (seat between 0 and 5),
  constraint room_players_kind check ((user_id is null) <> (ai_level is null)),
  constraint room_players_ai_level check (ai_level in ('easy', 'medium', 'hard')),
  constraint room_players_player_index check (player_index between 0 and 5),
  constraint room_players_unique_seat unique (room_id, seat),
  constraint room_players_unique_user unique (room_id, user_id),
  constraint room_players_unique_index unique (room_id, player_index)
);

comment on table public.room_players is 'Participants d’une room : joueurs (user_id) et IA (ai_level).';

create index room_players_user_idx on public.room_players (user_id);

-- Partie d'une room (une seule par room).
create table public.games (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null unique references public.rooms (id) on delete cascade,
  -- État complet du moteur (`GameState` de src/game), sérialisé en JSON.
  state jsonb not null,
  -- Incrémenté à chaque écriture : l'Edge Function n'écrit que si la version
  -- n'a pas changé depuis sa lecture (verrou optimiste).
  version integer not null default 0,
  -- Joueurs (identifiants du moteur) déclarés forfait : leurs pions sont retirés.
  forfeited smallint[] not null default '{}',
  -- Copies de state.status et state.winner, pour les requêtes.
  status text not null default 'playing',
  winner smallint,
  end_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint games_status check (status in ('playing', 'finished')),
  constraint games_end_reason check (end_reason in ('win', 'forfeit', 'abandoned')),
  constraint games_finished check ((status = 'finished') = (end_reason is not null))
);

comment on table public.games is 'Partie en ligne : état du moteur, écrit uniquement par l’Edge Function game-action.';

-- Horodatage des modifications ---------------------------------------------

create function public.touch_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger rooms_touch before update on public.rooms
  for each row execute function public.touch_updated_at();
create trigger games_touch before update on public.games
  for each row execute function public.touch_updated_at();

-- Fin de partie : la room passe à « finie » dans la même transaction.
create function public.finish_room_with_game()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status = 'finished' then
    update public.rooms set status = 'finished' where id = new.room_id and status <> 'finished';
  end if;
  return new;
end;
$$;

create trigger games_finish_room after update of status on public.games
  for each row execute function public.finish_room_with_game();

-- Row Level Security ------------------------------------------------------

-- Membre d'une room (joueur humain) ? « security definer » pour éviter que la
-- politique de room_players ne s'appelle elle-même.
create function public.is_room_member(room uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.room_players
    where room_id = room and user_id = (select auth.uid())
  );
$$;

alter table public.rooms enable row level security;
alter table public.room_players enable row level security;
alter table public.games enable row level security;

create policy "Rooms lisibles par leurs joueurs"
  on public.rooms for select
  to authenticated
  using (public.is_room_member(id));

create policy "Participants lisibles par les joueurs de la room"
  on public.room_players for select
  to authenticated
  using (public.is_room_member(room_id));

create policy "Parties lisibles par les joueurs de la room"
  on public.games for select
  to authenticated
  using (public.is_room_member(room_id));

-- Aucune politique insert, update ni delete : les clients ne peuvent rien
-- écrire directement, même dans leurs propres rooms.
revoke all on public.rooms, public.room_players, public.games from anon, authenticated;
grant select on public.rooms, public.room_players, public.games to authenticated;
grant select, insert, update, delete on public.rooms, public.room_players, public.games to service_role;

revoke all on function public.is_room_member(uuid) from public, anon;
grant execute on function public.is_room_member(uuid) to authenticated, service_role;
revoke all on function public.touch_updated_at() from public, anon, authenticated;
revoke all on function public.finish_room_with_game() from public, anon, authenticated;

-- Realtime ------------------------------------------------------------------

-- Les suppressions (un joueur quitte la salle d'attente) doivent porter
-- room_id pour que le filtre « room_id=eq.… » des abonnés les laisse passer.
alter table public.room_players replica identity full;

alter publication supabase_realtime add table public.rooms, public.room_players, public.games;

-- Salle d'attente ----------------------------------------------------------
-- Les erreurs sont levées avec un code court en message (room_full, not_host…),
-- traduit en français par l'application.

create function public.generate_room_code()
returns text
language sql
volatile
set search_path = ''
as $$
  select string_agg(substr('ABCDEFGHJKMNPQRSTUVWXYZ23456789', 1 + floor(random() * 31)::int, 1), '')
  from generate_series(1, 6);
$$;

revoke all on function public.generate_room_code() from public, anon, authenticated;

-- Utilisateur connecté, avec un profil.
create function public.require_player()
returns uuid
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  me uuid := (select auth.uid());
begin
  if me is null or not exists (select 1 from public.profiles where id = me) then
    raise exception 'not_authenticated';
  end if;
  return me;
end;
$$;

revoke all on function public.require_player() from public, anon, authenticated;

-- Room en attente dont l'utilisateur est l'hôte, verrouillée jusqu'à la fin de la transaction.
create function public.lock_hosted_room(p_room uuid, me uuid)
returns public.rooms
language plpgsql
security definer
set search_path = ''
as $$
declare
  r public.rooms;
begin
  select * into r from public.rooms where id = p_room for update;
  if not found or not public.is_room_member(p_room) then
    raise exception 'room_not_found';
  end if;
  if r.host_id <> me then
    raise exception 'not_host';
  end if;
  if r.status <> 'waiting' then
    raise exception 'room_started';
  end if;
  return r;
end;
$$;

revoke all on function public.lock_hosted_room(uuid, uuid) from public, anon, authenticated;

-- Plus petite place libre (0 à 5), ou null si la room est complète.
create function public.free_seat(p_room uuid)
returns smallint
language sql
stable
set search_path = ''
as $$
  select min(s)::smallint
  from generate_series(0, 5) as s
  where not exists (select 1 from public.room_players where room_id = p_room and seat = s);
$$;

revoke all on function public.free_seat(uuid) from public, anon, authenticated;

-- Crée une room dont l'utilisateur est l'hôte (place 0) et renvoie son identifiant.
create function public.create_room()
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
  loop
    new_code := public.generate_room_code();
    exit when not exists (select 1 from public.rooms where code = new_code);
  end loop;
  insert into public.rooms (code, host_id) values (new_code, me) returning id into room_id;
  insert into public.room_players (room_id, seat, user_id) values (room_id, 0, me);
  return room_id;
end;
$$;

-- Rejoint une room en attente par son code (casse et espaces ignorés) et renvoie
-- son identifiant. Rejoindre une room dont on fait déjà partie ne change rien
-- (reprise après une déconnexion, même en cours de partie).
create function public.join_room(p_code text)
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
  select * into r from public.rooms where code = upper(btrim(p_code)) for update;
  if not found then
    raise exception 'room_not_found';
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

-- Quitte une room en attente. Si l'hôte part, le joueur humain à la plus petite
-- place devient hôte ; s'il ne reste aucun humain, la room est supprimée.
-- Pendant la partie, il faut abandonner (Edge Function, action « resign »).
create function public.leave_room(p_room uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := public.require_player();
  r public.rooms;
  next_host uuid;
begin
  select * into r from public.rooms where id = p_room for update;
  if not found or not public.is_room_member(p_room) then
    raise exception 'room_not_found';
  end if;
  if r.status = 'playing' then
    raise exception 'room_started';
  end if;

  delete from public.room_players where room_id = p_room and user_id = me;
  if r.status = 'finished' then
    return;
  end if;

  select user_id into next_host from public.room_players
    where room_id = p_room and user_id is not null
    order by seat limit 1;
  if next_host is null then
    delete from public.rooms where id = p_room;
  elsif r.host_id = me then
    update public.rooms set host_id = next_host where id = p_room;
  end if;
end;
$$;

-- L'hôte ajoute une IA à la première place libre et renvoie l'identifiant du participant.
create function public.add_ai(p_room uuid, p_level text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := public.require_player();
  seat_no smallint;
  player_id uuid;
begin
  perform public.lock_hosted_room(p_room, me);
  if p_level is null or p_level not in ('easy', 'medium', 'hard') then
    raise exception 'bad_request';
  end if;
  seat_no := public.free_seat(p_room);
  if seat_no is null then
    raise exception 'room_full';
  end if;
  insert into public.room_players (room_id, seat, ai_level) values (p_room, seat_no, p_level)
    returning id into player_id;
  return player_id;
end;
$$;

-- IA d'une room en attente, dont l'utilisateur est l'hôte.
create function public.lock_hosted_ai(p_player uuid, me uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  room uuid;
begin
  select room_id into room from public.room_players where id = p_player and ai_level is not null;
  if room is null then
    raise exception 'room_not_found';
  end if;
  perform public.lock_hosted_room(room, me);
  return room;
end;
$$;

revoke all on function public.lock_hosted_ai(uuid, uuid) from public, anon, authenticated;

create function public.set_ai_level(p_player uuid, p_level text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := public.require_player();
begin
  perform public.lock_hosted_ai(p_player, me);
  if p_level is null or p_level not in ('easy', 'medium', 'hard') then
    raise exception 'bad_request';
  end if;
  update public.room_players set ai_level = p_level where id = p_player;
end;
$$;

create function public.remove_ai(p_player uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := public.require_player();
begin
  perform public.lock_hosted_ai(p_player, me);
  delete from public.room_players where id = p_player;
end;
$$;

-- Signe de vie du client, toutes les quelques secondes tant que la room est ouverte.
-- Sans signe de vie pendant la partie, le joueur est déclaré forfait (Edge Function).
create function public.heartbeat(p_room uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := public.require_player();
begin
  update public.room_players set last_seen_at = now() where room_id = p_room and user_id = me;
end;
$$;

revoke all on function
  public.create_room(), public.join_room(text), public.leave_room(uuid), public.add_ai(uuid, text),
  public.set_ai_level(uuid, text), public.remove_ai(uuid), public.heartbeat(uuid)
  from public, anon;
grant execute on function
  public.create_room(), public.join_room(text), public.leave_room(uuid), public.add_ai(uuid, text),
  public.set_ai_level(uuid, text), public.remove_ai(uuid), public.heartbeat(uuid)
  to authenticated;

-- Lancement de la partie (Edge Function seulement) --------------------------
-- L'Edge Function crée l'état initial avec le moteur ; cette fonction vérifie
-- la room, attribue les identifiants du moteur dans l'ordre des places et
-- enregistre la partie, le tout dans une seule transaction.

create function public.begin_game(p_room uuid, p_host uuid, p_state jsonb)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  r public.rooms;
  participants int;
  game_id uuid;
begin
  select * into r from public.rooms where id = p_room for update;
  if not found then
    raise exception 'room_not_found';
  end if;
  if r.host_id <> p_host then
    raise exception 'not_host';
  end if;
  if r.status <> 'waiting' then
    raise exception 'room_started';
  end if;
  select count(*) into participants from public.room_players where room_id = p_room;
  if participants < 2 or participants > 6 then
    raise exception 'not_enough_players';
  end if;
  if jsonb_array_length(p_state -> 'players') <> participants then
    raise exception 'bad_request';
  end if;

  update public.room_players rp set player_index = ranked.idx
    from (
      select id, (row_number() over (order by seat) - 1)::smallint as idx
      from public.room_players where room_id = p_room
    ) ranked
    where rp.id = ranked.id;
  insert into public.games (room_id, state) values (p_room, p_state) returning id into game_id;
  update public.rooms set status = 'playing' where id = p_room;
  return game_id;
end;
$$;

revoke all on function public.begin_game(uuid, uuid, jsonb) from public, anon, authenticated;
grant execute on function public.begin_game(uuid, uuid, jsonb) to service_role;
