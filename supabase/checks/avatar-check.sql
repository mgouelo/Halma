-- Vérifications de la migration profile_avatar.
-- À lancer après auth-stub.sql et les migrations : voir scripts/check-db.sh.

\set ON_ERROR_STOP on

insert into auth.users (id, email, raw_user_meta_data) values
  ('a1000000-0000-0000-0000-000000000001', 'ava@example.com', '{"pseudo": "Ava"}'),
  ('b1000000-0000-0000-0000-000000000002', 'ben@example.com', '{"pseudo": "Benji"}');

set role authenticated;
set request.jwt.claim.sub = 'a1000000-0000-0000-0000-000000000001';
do $$
declare n int;
begin
  update public.profiles
    set avatar = '{"v":1,"selections":{"head":"hm1-p-000020"},"colors":{"hair":"4A3728"},"background":"FDECF1"}'
    where id = 'a1000000-0000-0000-0000-000000000001';
  get diagnostics n = row_count;
  assert n = 1, 'Ava enregistre son avatar';

  update public.profiles set avatar = 'graine' where id = 'b1000000-0000-0000-0000-000000000002';
  get diagnostics n = row_count;
  assert n = 0, 'Ava ne modifie pas l’avatar de Benji';

  assert (select avatar from public.profiles where id = 'a1000000-0000-0000-0000-000000000001') like '{"v":1,%',
    'l’avatar est relu tel quel';
end $$;

do $$
begin
  update public.profiles set avatar = repeat('x', 1001) where id = 'a1000000-0000-0000-0000-000000000001';
  raise exception 'un avatar trop long aurait dû être refusé';
exception when check_violation then null;
end $$;

-- Revenir à l'avatar par défaut.
update public.profiles set avatar = null where id = 'a1000000-0000-0000-0000-000000000001';
reset role;

-- Les vérifications partagent la même base : on laisse la place nette.
delete from auth.users where id in ('a1000000-0000-0000-0000-000000000001', 'b1000000-0000-0000-0000-000000000002');

\echo 'avatar : toutes les vérifications sont passées.'
