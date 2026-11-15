-- Profils publics : ouvrir le profil d'un autre joueur depuis le classement,
-- la liste d'amis ou les demandes d'ami reçues.
--
-- - get_leaderboards, get_friends et get_friend_requests renvoient en plus
--   l'identifiant du joueur (colonne user_id, ajoutée EN DERNIER : les anciennes
--   colonnes gardent leur nom et leur ordre, l'application déjà installée
--   continue de fonctionner). Changer le type de retour d'une fonction impose
--   de la supprimer puis de la recréer : les droits d'origine sont refaits.
-- - get_public_profile(p_user) : profil public d'un joueur dont on connaît
--   l'identifiant (pas de liste, pas de recherche : aucune énumération).
--   Réservée aux comptes e-mail connectés (invité : guest_not_allowed). Renvoie
--   pseudo, avatar, points, rang aux points (null avant la première partie
--   classée), victoires, plus longue série de connexion, et la relation avec le
--   joueur connecté. Joueur inconnu ou invité : player_not_found (aucune
--   différence entre les deux). Jamais l'e-mail, les parties lancées ni aucune
--   autre donnée privée.
-- - Toujours aucune écriture directe par les clients : rien ne change côté
--   tables, les amitiés passent toujours par send_friend_request,
--   respond_friend_request et remove_friend.

-- Classements : Points, Victoires, Série, avec l'identifiant de chaque joueur ----------

drop function public.get_leaderboards();

create function public.get_leaderboards()
returns table (board text, rank int, pseudo text, avatar text, score int, is_me boolean, user_id uuid)
language plpgsql
stable
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  me uuid := public.require_player();
begin
  if exists (select 1 from auth.users u where u.id = me and u.is_anonymous) then
    raise exception 'guest_not_ranked';
  end if;

  return query
  with boards (board) as (
    values ('points'), ('wins'), ('best_streak')
  ),
  scores as (
    select p.id, p.pseudo, coalesce(p.avatar, p.id::text) as avatar, b.board, b.score, b.reached_at
    from public.player_stats s
    join public.profiles p on p.id = s.user_id
    -- Invités exclus : seuls les comptes e-mail sont classés.
    join auth.users u on u.id = s.user_id and not u.is_anonymous
    cross join lateral (values
      ('points', s.mmr, s.mmr_at, s.ranked_games > 0),
      ('wins', s.wins, s.wins_at, s.wins > 0),
      ('best_streak', s.best_streak, s.best_streak_at, s.best_streak > 0)
    ) as b (board, score, reached_at, listed)
    where b.listed
  ),
  ranked as (
    select sc.*, row_number() over (
      partition by sc.board
      order by sc.score desc, sc.reached_at asc nulls last, lower(sc.pseudo), sc.pseudo, sc.id
    )::int as position
    from scores sc
  )
  select r.board, r.position, r.pseudo, r.avatar, r.score, r.id = me, r.id
    from ranked r
    where r.position <= 50 or r.id = me
  union all
  -- Pas encore dans ce classement : ligne du joueur sans rang.
  select b.board, null::int, p.pseudo, coalesce(p.avatar, p.id::text),
      case when b.board = 'points' then coalesce((select s.mmr from public.player_stats s where s.user_id = me), 0) else 0 end,
      true, me
    from boards b
    join public.profiles p on p.id = me
    where not exists (select 1 from ranked r where r.board = b.board and r.id = me)
  order by 1, 2 nulls last;
end;
$$;

revoke all on function public.get_leaderboards() from public, anon;
grant execute on function public.get_leaderboards() to authenticated;

-- Liste d'amis, avec l'identifiant de chaque ami ------------------------------------------

drop function public.get_friends();

create function public.get_friends()
returns table (friendship_id uuid, pseudo text, avatar text, points int, rank int, user_id uuid)
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
    select f.id, p.pseudo, coalesce(p.avatar, p.id::text), coalesce(s.mmr, 0), r.rank, p.id
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

-- Demandes reçues, avec l'identifiant de l'expéditeur ----------------------------------------

drop function public.get_friend_requests();

create function public.get_friend_requests()
returns table (request_id uuid, pseudo text, avatar text, created_at timestamptz, user_id uuid)
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
    select fr.id, p.pseudo, coalesce(p.avatar, p.id::text), fr.created_at, p.id
    from public.friend_requests fr
    join public.profiles p on p.id = fr.sender_id
    where fr.recipient_id = me
    order by fr.created_at desc, fr.id desc;
end;
$$;

revoke all on function public.get_friend_requests() from public, anon;
grant execute on function public.get_friend_requests() to authenticated;

-- Profil public d'un joueur ----------------------------------------------------------------
-- relation : « self » (c'est moi), « friends » (avec friendship_id),
-- « request_sent » (j'ai demandé), « request_received » (il m'a demandé, avec
-- request_id) ou « none ». friendship_id et request_id sont null sinon.
-- Erreurs : not_authenticated, guest_not_allowed (l'appelant est un invité),
-- player_not_found (identifiant inconnu, ou compte invité : même réponse).

create function public.get_public_profile(p_user uuid)
returns table (
  pseudo text,
  avatar text,
  points int,
  rank int,
  wins int,
  best_streak int,
  relation text,
  friendship_id uuid,
  request_id uuid
)
language plpgsql
stable
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  me uuid := public.require_email_player();
  target public.profiles;
  friendship uuid;
  received uuid;
  rel text;
begin
  select p.* into target
    from public.profiles p
    join auth.users u on u.id = p.id and not u.is_anonymous
    where p.id = p_user;
  if not found then
    raise exception 'player_not_found';
  end if;

  if target.id = me then
    rel := 'self';
  else
    select f.id into friendship from public.friendships f
      where f.user_a = least(me, target.id) and f.user_b = greatest(me, target.id);
    if friendship is not null then
      rel := 'friends';
    elsif exists (select 1 from public.friend_requests fr where fr.sender_id = me and fr.recipient_id = target.id) then
      rel := 'request_sent';
    else
      select fr.id into received from public.friend_requests fr
        where fr.sender_id = target.id and fr.recipient_id = me;
      rel := case when received is not null then 'request_received' else 'none' end;
    end if;
  end if;

  return query
    select target.pseudo, coalesce(target.avatar, target.id::text), coalesce(s.mmr, 0), r.rank,
        coalesce(s.wins, 0), coalesce(s.best_streak, 0), rel, friendship, received
      from (select target.id as id) t
      left join public.player_stats s on s.user_id = t.id
      left join public.points_ranking() r on r.user_id = t.id;
end;
$$;

revoke all on function public.get_public_profile(uuid) from public, anon;
grant execute on function public.get_public_profile(uuid) to authenticated;
