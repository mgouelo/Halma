-- Nettoyage automatique des rooms abandonnées.
--
-- cleanup_abandoned_rooms() supprime (avec leurs participants et leur partie) :
-- - les salles d'attente sans signe de vie d'aucun humain depuis 1 jour ;
-- - les parties en cours sans signe de vie d'aucun humain depuis 7 jours ;
-- - les rooms finies depuis plus de 30 jours ;
-- et vide les essais de codes de room de plus d'un jour.
-- Les statistiques déjà comptées (player_stats) ne changent pas.
--
-- Planning : toutes les heures (à la minute 17) avec pg_cron, si l'extension
-- est disponible (c'est le cas sur Supabase). Sinon, voir le README : activer
-- « Cron » dans le tableau de bord, puis :
--   select cron.schedule('halma-cleanup-abandoned-rooms', '17 * * * *',
--                        'select public.cleanup_abandoned_rooms()');

create function public.cleanup_abandoned_rooms(
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

  delete from public.room_join_failures where attempted_at < now() - interval '1 day';
  return deleted;
end;
$$;

comment on function public.cleanup_abandoned_rooms(interval, interval, interval) is
  'Supprime les rooms abandonnées (attente 1 j, partie 7 j sans signe de vie, finies depuis 30 j). Planifiée par pg_cron.';

revoke all on function public.cleanup_abandoned_rooms(interval, interval, interval) from public, anon, authenticated;
grant execute on function public.cleanup_abandoned_rooms(interval, interval, interval) to service_role;

-- Planning pg_cron (sans effet si l'extension n'existe pas, par exemple sur le
-- Postgres local de scripts/check-db.sh). cron.schedule remplace une tâche de même nom.
do $$
begin
  if exists (select 1 from pg_available_extensions where name = 'pg_cron') then
    create extension if not exists pg_cron;
    perform cron.schedule('halma-cleanup-abandoned-rooms', '17 * * * *', 'select public.cleanup_abandoned_rooms()');
  else
    raise notice 'pg_cron indisponible : planifier cleanup_abandoned_rooms() à la main (voir le README).';
  end if;
exception when others then
  raise notice 'Planning pg_cron non créé (%) : le faire à la main (voir le README).', sqlerrm;
end $$;
