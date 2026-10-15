-- Freddie's Library database: one list of books and toys, some marked as wishes.
-- Anyone with the link can read the list and claim a wish. Only the admin (a signed-in
-- account whose email is in `editors`) can add, change or remove items.

create table public.editors (
  email text primary key
);
alter table public.editors enable row level security;
-- no policies: only reachable from is_editor() and the dashboard

create or replace function public.is_editor() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.editors where lower(email) = lower(coalesce(auth.jwt() ->> 'email', '')));
$$;
grant execute on function public.is_editor() to anon, authenticated;

create table public.items (
  id uuid primary key default gen_random_uuid(),
  kind text not null default 'book' check (kind in ('book', 'toy')),
  title text not null check (char_length(title) between 1 and 200),
  author text check (char_length(author) <= 200),
  isbn text check (char_length(isbn) <= 20),
  photo text check (char_length(photo) <= 200000), -- a link or a small JPEG data URL
  note text check (char_length(note) <= 500),
  wish boolean not null default false,
  claimed_by text check (char_length(claimed_by) <= 40),
  created_at timestamptz not null default now()
);
alter table public.items enable row level security;
create policy "anyone with the link can read" on public.items for select to anon, authenticated using (true);
create policy "admin can add" on public.items for insert to authenticated with check (public.is_editor());
create policy "admin can change" on public.items for update to authenticated using (public.is_editor()) with check (public.is_editor());
create policy "admin can remove" on public.items for delete to authenticated using (public.is_editor());

-- Family claim a wish without an account; only unclaimed wishes can be claimed.
create or replace function public.claim_wish(p_id uuid, p_name text) returns public.items
language sql security definer set search_path = public as $$
  update public.items set claimed_by = left(trim(p_name), 40)
  where id = p_id and wish and claimed_by is null and char_length(trim(p_name)) > 0
  returning *;
$$;
create or replace function public.unclaim_wish(p_id uuid) returns public.items
language sql security definer set search_path = public as $$
  update public.items set claimed_by = null where id = p_id returning *;
$$;
grant execute on function public.claim_wish(uuid, text) to anon, authenticated;
grant execute on function public.unclaim_wish(uuid) to anon, authenticated;
