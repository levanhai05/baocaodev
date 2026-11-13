-- Sổ địa chỉ giao hàng. Chạy trong SQL Editor (an toàn khi chạy lại)
create table if not exists addresses (
  id serial primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  label text not null default 'Địa chỉ',
  address text not null,
  is_default boolean default false,
  created_at timestamptz default now()
);
alter table addresses enable row level security;
drop policy if exists "địa chỉ của tôi" on addresses;
create policy "địa chỉ của tôi" on addresses for all using (user_id = auth.uid()) with check (user_id = auth.uid());
grant select, insert, update, delete on public.addresses to authenticated, service_role;
grant usage, select on all sequences in schema public to authenticated;
