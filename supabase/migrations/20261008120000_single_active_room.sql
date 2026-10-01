-- Une seule room active par joueur.
--
-- Un joueur est « dans une room active » quand il a une place dans :
-- - une salle d'attente (statut « waiting »), ou
-- - une partie en cours (statut « playing ») dont il n'a pas abandonné ni été
--   déclaré forfait (son identifiant de joueur n'est pas dans games.forfeited).
-- Les rooms finies ne comptent pas. Cette migration remplace la limite de
-- 5 salles d'attente par joueur (« too_many_rooms ») par cette règle :
-- - create_room et join_room refusent avec « already_in_room » si le joueur est
--   déjà dans une autre room active ; rejoindre la room dont on fait déjà partie
--   reste permis (reprise de partie) ;
-- - leave_room : l'hôte qui quitte la salle d'attente SUPPRIME la room (avec ses
--   participants), un autre joueur la quitte et elle reste ouverte. L'hôte ne
--   passe plus à un autre joueur. Pendant la partie, on abandonne (Edge Function).
-- Le nettoyage des rooms abandonnées (cleanup_abandoned_rooms) est inchangé.

-- Room active d'un joueur ------------------------------------------------------

-- Room active la plus récente du joueur (aucune ligne s'il n'en a pas).
create function public.active_rooms_of(p_user uuid)
returns table (id uuid, code text, status text, host_id uuid, created_at timestamptz)
language sql
stable
security definer
set search_path = ''
as $$
  select ro.id, ro.code, ro.status, ro.host_id, ro.created_at
  from public.rooms ro
  join public.room_players rp on rp.room_id = ro.id
  left join public.games g on g.room_id = ro.id
  where rp.user_id = p_user
    and (
      ro.status = 'waiting'
      or (
        ro.status = 'playing'
        and not coalesce(rp.player_index = any (g.forfeited), false)
      )
    )
  order by ro.created_at desc;
$$;

revoke all on function public.active_rooms_of(uuid) from public, anon, authenticated;
grant execute on function public.active_rooms_of(uuid) to service_role;

-- Room active de l'utilisateur connecté, pour l'écran « Jouer en ligne ».
create function public.my_active_room()
returns table (id uuid, code text, status text, host_id uuid, created_at timestamptz)
language sql
stable
security definer
set search_path = ''
as $$
  select * from public.active_rooms_of((select auth.uid())) limit 1;
$$;

revoke all on function public.my_active_room() from public, anon;
grant execute on function public.my_active_room() to authenticated;

-- Deux appels simultanés du même joueur ne doivent pas créer deux rooms.
create function public.lock_player(p_user uuid)
returns void
language sql
volatile
set search_path = ''
as $$
  select pg_advisory_xact_lock(hashtextextended(p_user::text, 0));
$$;

revoke all on function public.lock_player(uuid) from public, anon, authenticated;

-- create_room : refusée si le joueur est déjà dans une room active -----------------

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

-- join_room : idem, sauf pour la room dont on fait déjà partie (reprise) -----------

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
  if exists (select 1 from public.active_rooms_of(me)) then
    raise exception 'already_in_room';
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

-- leave_room : l'hôte ferme la room, un autre joueur la quitte ---------------------

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
  select * into r from public.rooms where id = p_room for update;
  if not found or not public.is_room_member(p_room) then
    raise exception 'room_not_found';
  end if;
  if r.status = 'playing' then
    raise exception 'room_started';
  end if;

  if r.status = 'waiting' and r.host_id = me then
    -- L'hôte ferme la room : participants et partie partent en cascade.
    delete from public.rooms where id = p_room;
  else
    delete from public.room_players where room_id = p_room and user_id = me;
  end if;
end;
$$;
