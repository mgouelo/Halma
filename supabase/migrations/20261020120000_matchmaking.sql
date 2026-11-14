-- Matchmaking : « Trouver une partie ».
--
-- - matchmaking_queue : joueurs en recherche (arrivée, dernier signe de vie).
--   Être en file compte comme être dans une room active : create_room et
--   join_room refusent (« already_searching »), join_matchmaking refuse un
--   joueur déjà dans une room active (« already_in_room »).
-- - Dès que 2 joueurs sont en recherche, ils sont placés dans une même room
--   (rooms.matchmaking = true, statut « waiting ») dont le départ est prévu
--   15 s plus tard (rooms.starts_at, heure du serveur). Pendant ce compte à
--   rebours, les joueurs qui arrivent en file rejoignent cette room, jusqu'à
--   6. Premier arrivé, premier servi. Pas d'IA, pas de réglages (valeurs par
--   défaut), pas d'hôte à gérer : host_id n'est qu'un joueur de la room.
-- - Un joueur qui quitte pendant le compte à rebours (ou qui ne donne plus
--   signe de vie depuis 20 s) sort de la room ; s'il reste moins de 2 joueurs,
--   la room est dissoute et les restants sont remis en file (à leur rang
--   d'origine).
-- - Le lancement se fait par l'Edge Function game-action (action « start »),
--   demandée par les clients à la fin du compte à rebours : begin_game refuse
--   avant l'heure prévue (« start_too_early ») et une room déjà lancée est
--   simplement renvoyée (idempotent).
-- - Tout se passe sous un verrou global (pg_advisory_xact_lock) : les
--   appariements sont sérialisés, aucun joueur ne peut se retrouver dans deux
--   rooms. Les clients ne peuvent rien écrire directement : fonctions security
--   definer join_matchmaking, leave_matchmaking, matchmaking_heartbeat et
--   get_matchmaking_status.
-- - cleanup_abandoned_rooms supprime en plus les rooms de matchmaking jamais
--   lancées et retire de la file les joueurs sans signe de vie.

-- Constantes ---------------------------------------------------------------------------

create function public.matchmaking_countdown() returns interval language sql immutable as $$ select interval '15 seconds' $$;
create function public.matchmaking_stale_after() returns interval language sql immutable as $$ select interval '20 seconds' $$;
create function public.matchmaking_max_players() returns int language sql immutable as $$ select 6 $$;

revoke all on function public.matchmaking_countdown(), public.matchmaking_stale_after(), public.matchmaking_max_players()
  from public, anon, authenticated;

-- Tables ----------------------------------------------------------------------------------

alter table public.rooms
  add column matchmaking boolean not null default false,
  -- Départ prévu d'une room de matchmaking (heure du serveur) ; null pour une room classique.
  add column starts_at timestamptz,
  add constraint rooms_matchmaking_start check (matchmaking = (starts_at is not null));

comment on column public.rooms.matchmaking is 'Room créée par le matchmaking : pas d''IA, pas de réglages, lancement à starts_at.';
comment on column public.rooms.starts_at is 'Départ prévu (matchmaking) : 15 s après l''appariement, heure du serveur.';

create table public.matchmaking_queue (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  joined_at timestamptz not null default clock_timestamp(),
  last_seen_at timestamptz not null default clock_timestamp()
);

create index matchmaking_queue_order on public.matchmaking_queue (joined_at, user_id);

comment on table public.matchmaking_queue is 'Joueurs en recherche d''une partie (premier arrivé, premier servi).';

alter table public.matchmaking_queue enable row level security;

create policy "Chacun lit sa place dans la file"
  on public.matchmaking_queue for select
  to authenticated
  using ((select auth.uid()) = user_id);

revoke all on public.matchmaking_queue from anon, authenticated;
grant select on public.matchmaking_queue to authenticated;
grant select, insert, update, delete on public.matchmaking_queue to service_role;

-- Realtime : la sortie de file (appariement) est signalée au joueur.
alter table public.matchmaking_queue replica identity full;
alter publication supabase_realtime add table public.matchmaking_queue;

-- Outils internes ----------------------------------------------------------------------------

-- Verrou global : un seul appariement à la fois.
create function public.matchmaking_lock()
returns void
language sql
volatile
set search_path = ''
as $$
  select pg_advisory_xact_lock(hashtextextended('halma-matchmaking', 0));
$$;

revoke all on function public.matchmaking_lock() from public, anon, authenticated;

-- Room de matchmaking en compte à rebours (attente) dont le joueur fait partie.
create function public.matchmaking_room_of(p_user uuid)
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select ro.id from public.rooms ro
  join public.room_players rp on rp.room_id = ro.id
  where rp.user_id = p_user and ro.matchmaking and ro.status = 'waiting'
  limit 1;
$$;

revoke all on function public.matchmaking_room_of(uuid) from public, anon, authenticated;

-- Retire un joueur d'une room de matchmaking en attente. S'il reste moins de 2
-- joueurs, la room est dissoute et les restants retournent en file, à leur rang
-- (l'heure de création de la room) ; sinon, l'hôte nominal passe à un autre joueur.
create function public.matchmaking_remove_from_room(p_room uuid, p_user uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  r public.rooms;
begin
  select * into r from public.rooms where id = p_room and matchmaking and status = 'waiting' for update;
  if not found then
    return;
  end if;
  delete from public.room_players where room_id = p_room and user_id = p_user;
  if (select count(*) from public.room_players where room_id = p_room and user_id is not null) < 2 then
    insert into public.matchmaking_queue (user_id, joined_at, last_seen_at)
      select rp.user_id, r.created_at, rp.last_seen_at
      from public.room_players rp
      where rp.room_id = p_room and rp.user_id is not null
        and rp.last_seen_at > clock_timestamp() - public.matchmaking_stale_after()
      on conflict (user_id) do nothing;
    delete from public.rooms where id = p_room;
  elsif r.host_id = p_user then
    update public.rooms set host_id = (
      select user_id from public.room_players where room_id = p_room and user_id is not null order by seat limit 1
    ) where id = p_room;
  end if;
end;
$$;

revoke all on function public.matchmaking_remove_from_room(uuid, uuid) from public, anon, authenticated;

-- Fait entrer en room les joueurs en file (verrou global déjà pris) :
-- 1. retire les joueurs sans signe de vie (file et rooms en compte à rebours) ;
-- 2. complète les rooms en compte à rebours (jusqu'à 6), plus anciennes d'abord ;
-- 3. tant qu'au moins 2 joueurs attendent, crée une room avec les plus anciens.
create function public.matchmaking_run()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  stale record;
  r public.rooms;
  next_user uuid;
  seat_no smallint;
  new_code text;
  new_room uuid;
  first_user uuid;
begin
  delete from public.matchmaking_queue where last_seen_at < clock_timestamp() - public.matchmaking_stale_after();
  for stale in
    select rp.room_id, rp.user_id from public.room_players rp
    join public.rooms ro on ro.id = rp.room_id
    where ro.matchmaking and ro.status = 'waiting' and rp.user_id is not null
      and rp.last_seen_at < clock_timestamp() - public.matchmaking_stale_after()
  loop
    perform public.matchmaking_remove_from_room(stale.room_id, stale.user_id);
  end loop;
  -- (Les restants d'une room dissoute viennent d'être remis en file ; on les retire s'ils sont absents.)
  delete from public.matchmaking_queue where last_seen_at < clock_timestamp() - public.matchmaking_stale_after();

  -- Rooms en compte à rebours, qui ont encore de la place.
  for r in
    select * from public.rooms
    where matchmaking and status = 'waiting' and starts_at > clock_timestamp()
    order by created_at
    for update
  loop
    loop
      exit when (select count(*) from public.room_players where room_id = r.id) >= public.matchmaking_max_players();
      select user_id into next_user from public.matchmaking_queue order by joined_at, user_id limit 1;
      exit when next_user is null;
      delete from public.matchmaking_queue where user_id = next_user;
      seat_no := public.free_seat(r.id);
      insert into public.room_players (room_id, seat, user_id) values (r.id, seat_no, next_user);
      next_user := null;
    end loop;
  end loop;

  -- Nouvelles rooms.
  while (select count(*) from public.matchmaking_queue) >= 2 loop
    select user_id into first_user from public.matchmaking_queue order by joined_at, user_id limit 1;
    loop
      new_code := public.generate_room_code();
      exit when not exists (select 1 from public.rooms where code = new_code);
    end loop;
    insert into public.rooms (code, host_id, matchmaking, starts_at)
      values (new_code, first_user, true, clock_timestamp() + public.matchmaking_countdown())
      returning id into new_room;
    with moved as (
      delete from public.matchmaking_queue
      where user_id in (
        select user_id from public.matchmaking_queue order by joined_at, user_id limit public.matchmaking_max_players()
      )
      returning user_id, joined_at
    )
    insert into public.room_players (room_id, seat, user_id)
      select new_room, (row_number() over (order by m.joined_at, m.user_id) - 1)::smallint, m.user_id from moved m;
  end loop;
end;
$$;

revoke all on function public.matchmaking_run() from public, anon, authenticated;

-- État de recherche d'un joueur ---------------------------------------------------------------
-- status :
-- - « idle » : ni en file ni en room de matchmaking ;
-- - « searching » : en file depuis joined_at ;
-- - « matched » : dans la room room_id, départ prévu à starts_at, players joueurs ;
-- - « started » : la partie de la room de matchmaking room_id est lancée.
-- server_now : heure du serveur, pour afficher le compte à rebours sans dépendre
-- de l'horloge du téléphone.

create function public.matchmaking_status_of(p_user uuid)
returns table (status text, joined_at timestamptz, room_id uuid, starts_at timestamptz, players int, server_now timestamptz)
language plpgsql
stable
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  q public.matchmaking_queue;
  r public.rooms;
begin
  select ro.* into r from public.rooms ro
    join public.room_players rp on rp.room_id = ro.id
    where rp.user_id = p_user and ro.matchmaking and ro.status = 'waiting'
    limit 1;
  if found then
    return query select 'matched'::text, null::timestamptz, r.id, r.starts_at,
      (select count(*)::int from public.room_players where room_id = r.id), clock_timestamp();
    return;
  end if;
  select * into q from public.matchmaking_queue where user_id = p_user;
  if found then
    return query select 'searching'::text, q.joined_at, null::uuid, null::timestamptz, 0, clock_timestamp();
    return;
  end if;
  select ro.* into r from public.active_rooms_of(p_user) a join public.rooms ro on ro.id = a.id
    where ro.matchmaking and ro.status = 'playing'
    limit 1;
  if found then
    return query select 'started'::text, null::timestamptz, r.id, r.starts_at,
      (select count(*)::int from public.room_players where room_id = r.id), clock_timestamp();
    return;
  end if;
  return query select 'idle'::text, null::timestamptz, null::uuid, null::timestamptz, 0, clock_timestamp();
end;
$$;

revoke all on function public.matchmaking_status_of(uuid) from public, anon, authenticated;

-- Fonctions appelées par l'application -----------------------------------------------------------

-- Entrer en file (ou y rester : idempotent). Refusé si le joueur est déjà dans une room active.
create function public.join_matchmaking()
returns table (status text, joined_at timestamptz, room_id uuid, starts_at timestamptz, players int, server_now timestamptz)
language plpgsql
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  me uuid := public.require_player();
begin
  perform public.lock_player(me);
  perform public.matchmaking_lock();
  if exists (select 1 from public.matchmaking_queue q where q.user_id = me) then
    update public.matchmaking_queue q set last_seen_at = clock_timestamp() where q.user_id = me;
  elsif public.matchmaking_room_of(me) is null then
    if exists (select 1 from public.active_rooms_of(me)) then
      raise exception 'already_in_room';
    end if;
    insert into public.matchmaking_queue (user_id) values (me);
  end if;
  perform public.matchmaking_run();
  return query select * from public.matchmaking_status_of(me);
end;
$$;

-- Quitter la recherche : la file, ou la room en compte à rebours (dissoute s'il reste moins de 2 joueurs).
-- Sans effet une fois la partie lancée (on abandonne alors depuis l'écran de jeu).
create function public.leave_matchmaking()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := public.require_player();
  room uuid;
begin
  perform public.lock_player(me);
  perform public.matchmaking_lock();
  delete from public.matchmaking_queue where user_id = me;
  room := public.matchmaking_room_of(me);
  if room is not null then
    perform public.matchmaking_remove_from_room(room, me);
  end if;
  perform public.matchmaking_run();
end;
$$;

-- Signe de vie (toutes les quelques secondes pendant la recherche et le compte à
-- rebours) : garde sa place, fait avancer les appariements, renvoie l'état.
create function public.matchmaking_heartbeat()
returns table (status text, joined_at timestamptz, room_id uuid, starts_at timestamptz, players int, server_now timestamptz)
language plpgsql
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  me uuid := public.require_player();
begin
  perform public.matchmaking_lock();
  update public.matchmaking_queue q set last_seen_at = clock_timestamp() where q.user_id = me;
  update public.room_players rp set last_seen_at = clock_timestamp()
    where rp.user_id = me and rp.room_id = public.matchmaking_room_of(me);
  perform public.matchmaking_run();
  return query select * from public.matchmaking_status_of(me);
end;
$$;

-- Lecture seule de l'état de recherche (écran « Jouer en ligne », relecture de secours).
create function public.get_matchmaking_status()
returns table (status text, joined_at timestamptz, room_id uuid, starts_at timestamptz, players int, server_now timestamptz)
language sql
stable
security definer
set search_path = ''
as $$
  select * from public.matchmaking_status_of(public.require_player());
$$;

revoke all on function public.join_matchmaking(), public.leave_matchmaking(), public.matchmaking_heartbeat(),
  public.get_matchmaking_status() from public, anon;
grant execute on function public.join_matchmaking(), public.leave_matchmaking(), public.matchmaking_heartbeat(),
  public.get_matchmaking_status() to authenticated;

-- Rooms classiques : refusées pendant une recherche ----------------------------------------------

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
  perform public.lock_player(me);
  if exists (select 1 from public.matchmaking_queue where user_id = me) then
    raise exception 'already_searching';
  end if;
  if exists (select 1 from public.active_rooms_of(me)) then
    raise exception 'already_in_room';
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
  perform public.lock_player(me);
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
  if exists (select 1 from public.matchmaking_queue where user_id = me) then
    raise exception 'already_searching';
  end if;
  if exists (select 1 from public.active_rooms_of(me)) then
    raise exception 'already_in_room';
  end if;
  -- Une room de matchmaking ne se rejoint pas par son code.
  if r.matchmaking then
    raise exception 'room_not_found';
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

-- Quitter une room de matchmaking en attente : comme leave_matchmaking (pas de fermeture par l'hôte).
create or replace function public.leave_room(p_room uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := public.require_player();
  r public.rooms;
begin
  select * into r from public.rooms where id = p_room;
  if found and r.matchmaking then
    perform public.matchmaking_lock();
  end if;
  select * into r from public.rooms where id = p_room for update;
  if not found or not public.is_room_member(p_room) then
    raise exception 'room_not_found';
  end if;
  if r.status = 'playing' then
    raise exception 'room_started';
  end if;

  if r.matchmaking and r.status = 'waiting' then
    perform public.matchmaking_remove_from_room(p_room, me);
  elsif r.status = 'waiting' and r.host_id = me then
    -- L'hôte ferme la room : participants et partie partent en cascade.
    delete from public.rooms where id = p_room;
  else
    delete from public.room_players where room_id = p_room and user_id = me;
  end if;
end;
$$;

-- Pas d'IA ni de réglages dans une room de matchmaking : personne n'y est hôte pour
-- add_ai, set_ai_level, remove_ai et set_room_settings.
create or replace function public.lock_hosted_room(p_room uuid, me uuid)
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
  if r.host_id <> me or r.matchmaking then
    raise exception 'not_host';
  end if;
  if r.status <> 'waiting' then
    raise exception 'room_started';
  end if;
  return r;
end;
$$;

-- Lancement : une room de matchmaking part à l'heure prévue, à la demande de n'importe lequel de ses joueurs.
create or replace function public.begin_game(p_room uuid, p_host uuid, p_state jsonb)
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
  select * into r from public.rooms where id = p_room;
  if not found then
    raise exception 'room_not_found';
  end if;
  -- Même ordre de verrous que le matchmaking (verrou global, puis la room).
  if r.matchmaking then
    perform public.matchmaking_lock();
  end if;
  select * into r from public.rooms where id = p_room for update;
  if not found then
    raise exception 'room_not_found';
  end if;
  if r.matchmaking then
    if not exists (select 1 from public.room_players where room_id = p_room and user_id = p_host) then
      raise exception 'not_in_game';
    end if;
    if clock_timestamp() < r.starts_at then
      raise exception 'start_too_early';
    end if;
  elsif r.host_id <> p_host then
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

  insert into public.player_stats as s (user_id, games_started, games_started_at)
    select user_id, 1, now() from public.room_players where room_id = p_room and user_id is not null
    on conflict (user_id) do update set games_started = s.games_started + 1, games_started_at = now();
  return game_id;
end;
$$;

-- Nettoyage : rooms de matchmaking jamais lancées et file sans signe de vie, en plus du reste.
create or replace function public.cleanup_abandoned_rooms(
  p_waiting interval default interval '1 day',
  p_playing interval default interval '7 days',
  p_finished interval default interval '30 days'
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  deleted integer;
  mm_deleted integer;
begin
  delete from public.rooms ro
  where (
      ro.status in ('waiting', 'playing')
      and not exists (
        select 1 from public.room_players rp
        where rp.room_id = ro.id
          and rp.user_id is not null
          and rp.last_seen_at > now() - case when ro.status = 'waiting' then p_waiting else p_playing end
      )
    )
    or (ro.status = 'finished' and ro.updated_at < now() - p_finished);
  get diagnostics deleted = row_count;

  -- Room de matchmaking restée en attente plus de 10 minutes après l'heure prévue : personne ne l'a lancée.
  delete from public.rooms
    where matchmaking and status = 'waiting' and starts_at < now() - interval '10 minutes';
  get diagnostics mm_deleted = row_count;
  delete from public.matchmaking_queue where last_seen_at < now() - public.matchmaking_stale_after();

  delete from public.room_join_failures where attempted_at < now() - interval '1 day';
  return deleted + mm_deleted;
end;
$$;
