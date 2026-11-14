-- Amis : demandes d'ami et amitiés, réservées aux comptes e-mail.
--
-- - friend_requests : demandes en attente (expéditeur, destinataire, date) ;
--   au plus 10 en attente par destinataire (la plus ancienne laisse sa place à
--   la nouvelle) et au plus 20 envoyées en attente par joueur.
-- - friendships : une ligne par paire, dans l'ordre canonique (user_a < user_b).
-- - friend_request_refusals : après un refus, l'expéditeur attend 24 heures
--   avant de pouvoir redemander la même personne.
-- - Lecture (RLS) : chacun lit les lignes qui le concernent. AUCUNE écriture
--   directe par les clients : tout passe par des fonctions security definer
--   qui vérifient l'identité (auth.uid()) : send_friend_request,
--   respond_friend_request, remove_friend, get_friends, get_friend_requests.
-- - Invités (connexion anonyme) : ni expéditeurs ni destinataires.
-- - Recherche par pseudo avec la clé d'unicité (pseudo_key après clean_pseudo) :
--   « zoe » trouve « Zoé ».
-- - Suppression du compte : amitiés, demandes et refus suivent (cascade).
-- - Realtime : friend_requests et friendships sont publiées (une nouvelle
--   demande, une demande acceptée apparaissent sans recharger ; la RLS filtre).

-- Constantes ---------------------------------------------------------------------------

create function public.friend_max_pending_received() returns int language sql immutable as $$ select 10 $$;
create function public.friend_max_pending_sent() returns int language sql immutable as $$ select 20 $$;
create function public.friend_refusal_cooldown() returns interval language sql immutable as $$ select interval '24 hours' $$;

revoke all on function public.friend_max_pending_received(), public.friend_max_pending_sent(), public.friend_refusal_cooldown()
  from public, anon, authenticated;

-- Tables --------------------------------------------------------------------------------

create table public.friend_requests (
  id uuid primary key default gen_random_uuid(),
  sender_id uuid not null references public.profiles (id) on delete cascade,
  recipient_id uuid not null references public.profiles (id) on delete cascade,
  -- clock_timestamp : deux demandes d'une même transaction restent ordonnées.
  created_at timestamptz not null default clock_timestamp(),
  constraint friend_requests_not_self check (sender_id <> recipient_id),
  constraint friend_requests_unique unique (sender_id, recipient_id)
);

create index friend_requests_recipient on public.friend_requests (recipient_id, created_at desc);

comment on table public.friend_requests is 'Demandes d''ami en attente (comptes e-mail seulement).';

create table public.friendships (
  id uuid primary key default gen_random_uuid(),
  user_a uuid not null references public.profiles (id) on delete cascade,
  user_b uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  -- Paire canonique : une seule ligne par amitié, quel que soit le sens.
  constraint friendships_canonical check (user_a < user_b),
  constraint friendships_unique unique (user_a, user_b)
);

create index friendships_user_b on public.friendships (user_b);

comment on table public.friendships is 'Amitiés (une ligne par paire, user_a < user_b).';

create table public.friend_request_refusals (
  sender_id uuid not null references public.profiles (id) on delete cascade,
  recipient_id uuid not null references public.profiles (id) on delete cascade,
  refused_at timestamptz not null default now(),
  primary key (sender_id, recipient_id)
);

comment on table public.friend_request_refusals is 'Dernier refus d''une demande d''ami (délai de 24 h avant une nouvelle demande).';

-- Row Level Security ------------------------------------------------------------------------

alter table public.friend_requests enable row level security;
alter table public.friendships enable row level security;
alter table public.friend_request_refusals enable row level security;

create policy "Demandes lisibles par l'expéditeur et le destinataire"
  on public.friend_requests for select
  to authenticated
  using ((select auth.uid()) in (sender_id, recipient_id));

create policy "Amitiés lisibles par les deux amis"
  on public.friendships for select
  to authenticated
  using ((select auth.uid()) in (user_a, user_b));

-- Aucune écriture directe ; les refus ne sont pas lisibles non plus.
revoke all on public.friend_requests, public.friendships, public.friend_request_refusals from anon, authenticated;
grant select on public.friend_requests, public.friendships to authenticated;
grant select, insert, update, delete on public.friend_requests, public.friendships, public.friend_request_refusals
  to service_role;

-- Realtime : les suppressions doivent porter les colonnes filtrées (destinataire, amis).
alter table public.friend_requests replica identity full;
alter table public.friendships replica identity full;
alter publication supabase_realtime add table public.friend_requests, public.friendships;

-- Fonctions ---------------------------------------------------------------------------------

-- Joueur connecté avec un compte e-mail ; un invité est refusé (« guest_not_allowed »).
create function public.require_email_player()
returns uuid
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  me uuid := public.require_player();
begin
  if exists (select 1 from auth.users u where u.id = me and u.is_anonymous) then
    raise exception 'guest_not_allowed';
  end if;
  return me;
end;
$$;

revoke all on function public.require_email_player() from public, anon, authenticated;

-- Crée l'amitié entre deux joueurs (paire canonique), sans doublon.
create function public.make_friends(p_one uuid, p_two uuid)
returns void
language sql
security definer
set search_path = ''
as $$
  insert into public.friendships (user_a, user_b)
    values (least(p_one, p_two), greatest(p_one, p_two))
    on conflict (user_a, user_b) do nothing;
$$;

revoke all on function public.make_friends(uuid, uuid) from public, anon, authenticated;

-- Envoyer une demande d'ami à un pseudo ---------------------------------------------------------
-- Renvoie « sent », ou « accepted » si l'autre avait déjà fait une demande
-- (demande croisée : les deux deviennent amis). Erreurs (message court) :
-- guest_not_allowed, pseudo_unknown, self_request, not_eligible (le destinataire
-- joue en invité), already_friends, already_requested, recently_refused,
-- too_many_sent.

create function public.send_friend_request(p_pseudo text)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := public.require_email_player();
  target uuid;
  oldest uuid;
begin
  select p.id into target
    from public.profiles p
    where public.pseudo_key(p.pseudo) = public.pseudo_key(public.clean_pseudo(coalesce(p_pseudo, '')))
    limit 1;
  if target is null then
    raise exception 'pseudo_unknown';
  end if;
  if target = me then
    raise exception 'self_request';
  end if;
  if exists (select 1 from auth.users u where u.id = target and u.is_anonymous) then
    raise exception 'not_eligible';
  end if;

  -- Verrou des deux profils, toujours dans le même ordre : les envois simultanés
  -- vers un même joueur (limite de 10) ou depuis un même joueur (limite de 20)
  -- passent l'un après l'autre.
  perform 1 from public.profiles where id in (me, target) order by id for update;

  if exists (select 1 from public.friendships where user_a = least(me, target) and user_b = greatest(me, target)) then
    raise exception 'already_friends';
  end if;
  if exists (select 1 from public.friend_requests where sender_id = me and recipient_id = target) then
    raise exception 'already_requested';
  end if;

  -- Demande croisée : l'autre m'avait déjà demandé. On devient amis.
  if exists (select 1 from public.friend_requests where sender_id = target and recipient_id = me) then
    delete from public.friend_requests where sender_id = target and recipient_id = me;
    perform public.make_friends(me, target);
    return 'accepted';
  end if;

  if exists (
    select 1 from public.friend_request_refusals
    where sender_id = me and recipient_id = target and refused_at > now() - public.friend_refusal_cooldown()
  ) then
    raise exception 'recently_refused';
  end if;
  if (select count(*) from public.friend_requests where sender_id = me) >= public.friend_max_pending_sent() then
    raise exception 'too_many_sent';
  end if;

  -- Boîte du destinataire pleine : la plus ancienne demande laisse sa place.
  if (select count(*) from public.friend_requests where recipient_id = target) >= public.friend_max_pending_received() then
    select id into oldest from public.friend_requests
      where recipient_id = target
      order by created_at asc, id asc
      limit 1;
    delete from public.friend_requests where id = oldest;
  end if;

  insert into public.friend_requests (sender_id, recipient_id) values (me, target);
  return 'sent';
end;
$$;

revoke all on function public.send_friend_request(text) from public, anon;
grant execute on function public.send_friend_request(text) to authenticated;

-- Accepter ou refuser une demande reçue ---------------------------------------------------------
-- Renvoie « accepted » ou « refused ». Erreur : request_not_found (pas une demande reçue par moi).

create function public.respond_friend_request(p_request uuid, p_accept boolean)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := public.require_email_player();
  req public.friend_requests;
begin
  delete from public.friend_requests where id = p_request and recipient_id = me returning * into req;
  if not found then
    raise exception 'request_not_found';
  end if;
  if p_accept then
    perform public.make_friends(req.sender_id, me);
    -- Un ancien refus n'a plus de raison d'être.
    delete from public.friend_request_refusals where sender_id = req.sender_id and recipient_id = me;
    return 'accepted';
  end if;
  insert into public.friend_request_refusals (sender_id, recipient_id, refused_at) values (req.sender_id, me, now())
    on conflict (sender_id, recipient_id) do update set refused_at = excluded.refused_at;
  return 'refused';
end;
$$;

revoke all on function public.respond_friend_request(uuid, boolean) from public, anon;
grant execute on function public.respond_friend_request(uuid, boolean) to authenticated;

-- Retirer un ami (identifiant de l'amitié, renvoyé par get_friends) ------------------------------

create function public.remove_friend(p_friendship uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := public.require_email_player();
begin
  delete from public.friendships where id = p_friendship and me in (user_a, user_b);
  if not found then
    raise exception 'friend_not_found';
  end if;
end;
$$;

revoke all on function public.remove_friend(uuid) from public, anon;
grant execute on function public.remove_friend(uuid) to authenticated;

-- Liste d'amis -------------------------------------------------------------------------------------
-- Pseudo, avatar, points et rang parmi tous les joueurs classés (null avant
-- la première partie classée), triés par points ; rien d'autre (jamais l'e-mail).
-- friendship_id sert à retirer l'ami.

create function public.get_friends()
returns table (friendship_id uuid, pseudo text, avatar text, points int, rank int)
language plpgsql
stable
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  me uuid := public.require_email_player();
begin
  return query
    select f.id, p.pseudo, coalesce(p.avatar, p.id::text), coalesce(s.mmr, 0), r.rank
    from public.friendships f
    join public.profiles p on p.id = case when f.user_a = me then f.user_b else f.user_a end
    left join public.player_stats s on s.user_id = p.id
    left join public.points_ranking() r on r.user_id = p.id
    where me in (f.user_a, f.user_b)
    order by coalesce(s.mmr, 0) desc, r.rank asc nulls last, lower(p.pseudo), p.pseudo;
end;
$$;

revoke all on function public.get_friends() from public, anon;
grant execute on function public.get_friends() to authenticated;

-- Demandes reçues, de la plus récente à la plus ancienne ---------------------------------------------

create function public.get_friend_requests()
returns table (request_id uuid, pseudo text, avatar text, created_at timestamptz)
language plpgsql
stable
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  me uuid := public.require_email_player();
begin
  return query
    select fr.id, p.pseudo, coalesce(p.avatar, p.id::text), fr.created_at
    from public.friend_requests fr
    join public.profiles p on p.id = fr.sender_id
    where fr.recipient_id = me
    order by fr.created_at desc, fr.id desc;
end;
$$;

revoke all on function public.get_friend_requests() from public, anon;
grant execute on function public.get_friend_requests() to authenticated;
