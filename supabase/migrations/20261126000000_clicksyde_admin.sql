-- Clicksyde website: content managed from the admin panel (admin.html).
-- Run once on the Clicksyde Supabase project, AFTER 20261125000000_clicksyde_leads.sql
-- (it uses public.admins and public.is_admin() from that file).
--
--   site_content  one row ('site') holding contact + social links, client logos, home layout, brand colour
--   posts         Insights articles; visitors only see published ones
--   storage       public "media" bucket for blog covers and client logos; only admins can upload

-- ---------------------------------------------------------------------------
-- Site content
-- ---------------------------------------------------------------------------
create table if not exists public.site_content (
  id          text primary key check (id = 'site'),
  data        jsonb not null default '{}'::jsonb check (jsonb_typeof(data) = 'object'),
  updated_at  timestamptz not null default now(),
  updated_by  uuid references auth.users (id) on delete set null
);

-- ---------------------------------------------------------------------------
-- Blog posts (Insights)
-- ---------------------------------------------------------------------------
create table if not exists public.posts (
  id            text primary key check (id ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and char_length(id) <= 80),  -- the slug: insights.html#<id>
  title         text not null check (char_length(title) between 1 and 200),
  cat           text not null default 'Strategy' check (char_length(cat) between 1 and 40),
  ex            text not null default '' check (char_length(ex) <= 400),                            -- excerpt
  body          jsonb not null default '[]'::jsonb check (jsonb_typeof(body) = 'array'),            -- [["p"|"h"|"q", text], ...]
  color         text not null default '#FF4306' check (color ~* '^#[0-9a-f]{6}$'),
  art           text not null default '' check (char_length(art) <= 24),                            -- big text on the cover
  image_url     text check (image_url is null or (image_url ~ '^https://' and char_length(image_url) <= 1000)),
  mins          int  not null default 3 check (mins between 1 and 120),
  featured      boolean not null default false,
  published     boolean not null default false,
  published_at  timestamptz,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index if not exists posts_published_idx on public.posts (published, published_at desc);

create or replace function public.posts_touch()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at := now();
  if new.published and new.published_at is null then new.published_at := now(); end if;
  return new;
end;
$$;
drop trigger if exists posts_touch on public.posts;
create trigger posts_touch before insert or update on public.posts
  for each row execute function public.posts_touch();

-- ---------------------------------------------------------------------------
-- Row level security
-- ---------------------------------------------------------------------------
alter table public.site_content enable row level security;
alter table public.posts        enable row level security;

grant select on public.site_content, public.posts to anon, authenticated;
grant insert, update, delete on public.site_content, public.posts to authenticated;

drop policy if exists "anyone reads site content" on public.site_content;
create policy "anyone reads site content" on public.site_content
  for select to anon, authenticated using (true);

drop policy if exists "admins add site content" on public.site_content;
create policy "admins add site content" on public.site_content
  for insert to authenticated with check (public.is_admin());

drop policy if exists "admins change site content" on public.site_content;
create policy "admins change site content" on public.site_content
  for update to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists "visitors read published posts" on public.posts;
create policy "visitors read published posts" on public.posts
  for select to anon, authenticated using (published or public.is_admin());

drop policy if exists "admins add posts" on public.posts;
create policy "admins add posts" on public.posts
  for insert to authenticated with check (public.is_admin());

drop policy if exists "admins change posts" on public.posts;
create policy "admins change posts" on public.posts
  for update to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists "admins delete posts" on public.posts;
create policy "admins delete posts" on public.posts
  for delete to authenticated using (public.is_admin());

-- ---------------------------------------------------------------------------
-- Image uploads: public "media" bucket, 5 MB per file, images only
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('media', 'media', true, 5242880, array['image/png', 'image/jpeg', 'image/webp', 'image/gif', 'image/svg+xml'])
on conflict (id) do nothing;

drop policy if exists "admins upload media" on storage.objects;
create policy "admins upload media" on storage.objects
  for insert to authenticated with check (bucket_id = 'media' and public.is_admin());

drop policy if exists "admins change media" on storage.objects;
create policy "admins change media" on storage.objects
  for update to authenticated using (bucket_id = 'media' and public.is_admin()) with check (bucket_id = 'media' and public.is_admin());

drop policy if exists "admins delete media" on storage.objects;
create policy "admins delete media" on storage.objects
  for delete to authenticated using (bucket_id = 'media' and public.is_admin());
