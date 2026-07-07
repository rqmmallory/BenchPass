-- Cross-tenant isolation test for BenchPass RLS.
-- Run in the Supabase SQL editor (or psql) against a database with the
-- 0001_init migration applied. Every assertion raises on failure, so a clean
-- run (no errors, final NOTICE) means tenant isolation holds.

begin;

-- Two fake auth users (bypassing the auth API for test purposes).
insert into auth.users (id, email)
values
  ('00000000-0000-0000-0000-0000000000a1', 'a@test.local'),
  ('00000000-0000-0000-0000-0000000000b1', 'b@test.local')
on conflict (id) do nothing;

-- Two shops with one user each, plus one customer/ticket per shop.
insert into shops (id, name) values
  ('00000000-0000-0000-0000-00000000aa01', 'Shop A'),
  ('00000000-0000-0000-0000-00000000bb01', 'Shop B');

insert into users (id, shop_id, email) values
  ('00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-00000000aa01', 'a@test.local'),
  ('00000000-0000-0000-0000-0000000000b1', '00000000-0000-0000-0000-00000000bb01', 'b@test.local');

insert into customers (id, shop_id, name) values
  ('00000000-0000-0000-0000-00000000aac1', '00000000-0000-0000-0000-00000000aa01', 'Customer A'),
  ('00000000-0000-0000-0000-00000000bbc1', '00000000-0000-0000-0000-00000000bb01', 'Customer B');

insert into tickets (shop_id, customer_id, problem) values
  ('00000000-0000-0000-0000-00000000aa01', '00000000-0000-0000-0000-00000000aac1', 'Ticket A'),
  ('00000000-0000-0000-0000-00000000bb01', '00000000-0000-0000-0000-00000000bbc1', 'Ticket B');

-- Impersonate user A.
set local role authenticated;
set local request.jwt.claims to '{"sub": "00000000-0000-0000-0000-0000000000a1", "role": "authenticated"}';

do $$
declare
  leak_count int;
begin
  -- A must see exactly their own rows and nothing from shop B.
  select count(*) into leak_count from shops where name = 'Shop B';
  if leak_count > 0 then raise exception 'LEAK: user A can read shop B'; end if;

  select count(*) into leak_count from customers where name = 'Customer B';
  if leak_count > 0 then raise exception 'LEAK: user A can read customer B'; end if;

  select count(*) into leak_count from tickets where problem = 'Ticket B';
  if leak_count > 0 then raise exception 'LEAK: user A can read ticket B'; end if;

  select count(*) into leak_count from tickets where problem = 'Ticket A';
  if leak_count <> 1 then raise exception 'RLS broke legitimate access for user A'; end if;

  -- A must not be able to write into shop B.
  begin
    insert into customers (shop_id, name)
    values ('00000000-0000-0000-0000-00000000bb01', 'Injected');
    raise exception 'LEAK: user A inserted a customer into shop B';
  exception
    when insufficient_privilege or check_violation then
      null; -- expected: RLS with-check rejected it
  end;

  raise notice 'RLS isolation tests passed';
end $$;

rollback;
