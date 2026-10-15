-- Freddie's Library database. Applied to the Supabase project as migration "init_library".
-- The whole catalog is one JSON document; editors (listed by email) can change it,
-- everyone else can read it. Wishlist claims go through functions so family can
-- claim without an account, and only the person who claimed can undo it.

create table public.editors (
  email text primary key
);
alter table public.editors enable row level security;
-- no policies: only reachable from security definer functions and the dashboard

create or replace function public.is_editor() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.editors where lower(email) = lower(coalesce(auth.jwt() ->> 'email', '')));
$$;
grant execute on function public.is_editor() to anon, authenticated;

create table public.library (
  id int primary key default 1 check (id = 1),
  data jsonb not null,
  updated_at timestamptz not null default now()
);
alter table public.library enable row level security;
create policy "anyone can read the library" on public.library for select to anon, authenticated using (true);
create policy "editors can update the library" on public.library for update to authenticated using (public.is_editor()) with check (public.is_editor());
create policy "editors can create the library" on public.library for insert to authenticated with check (public.is_editor());

create table public.claims (
  item_id text primary key,
  name text not null check (char_length(name) between 1 and 40),
  token text not null,
  created_at timestamptz not null default now()
);
alter table public.claims enable row level security;
-- no direct table access; see functions below

create or replace function public.list_claims(p_token text default null)
returns table (item_id text, name text, created_at timestamptz, mine boolean)
language sql stable security definer set search_path = public as $$
  select c.item_id, c.name, c.created_at, (p_token is not null and c.token = p_token)
  from public.claims c;
$$;

create or replace function public.claim_item(p_item_id text, p_name text, p_token text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if char_length(coalesce(p_token, '')) < 16 then raise exception 'bad token'; end if;
  if not exists (
    select 1 from public.library l, jsonb_array_elements(l.data -> 'items') it
    where it ->> 'id' = p_item_id and it ->> 'list' = 'wish'
  ) then raise exception 'not on the wishlist'; end if;
  insert into public.claims (item_id, name, token) values (p_item_id, trim(p_name), p_token);
end $$;

create or replace function public.unclaim_item(p_item_id text, p_token text)
returns void language sql security definer set search_path = public as $$
  delete from public.claims where item_id = p_item_id and (token = p_token or public.is_editor());
$$;

grant execute on function public.list_claims(text) to anon, authenticated;
grant execute on function public.claim_item(text, text, text) to anon, authenticated;
grant execute on function public.unclaim_item(text, text) to anon, authenticated;

-- Photos: public to view, editors upload
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('photos', 'photos', true, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;
create policy "editors upload photos" on storage.objects for insert to authenticated
  with check (bucket_id = 'photos' and public.is_editor());
create policy "editors replace photos" on storage.objects for update to authenticated
  using (bucket_id = 'photos' and public.is_editor());
create policy "editors delete photos" on storage.objects for delete to authenticated
  using (bucket_id = 'photos' and public.is_editor());
