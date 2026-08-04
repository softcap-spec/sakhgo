-- SakhGO · PostgreSQL native schema (no Supabase dependency)
-- Designed for: Docker PostgreSQL 17, Next.js, direct pg connection

-- ── Types ──
create type listing_type as enum ('property', 'tour', 'fishing', 'rental_gear');
create type booking_status as enum ('pending', 'confirmed', 'completed', 'cancelled', 'rejected');
create type promo_type as enum ('top', 'hot', 'highlight');
create type banner_slot as enum ('home-hero-bottom', 'catalog-sidebar', 'listing-detail-bottom', 'search-results-top');
create type user_role as enum ('user', 'admin');

-- ── Profiles ──
create table public.profiles (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  email text not null unique,
  phone text,
  phone_verified boolean default false,
  role user_role not null default 'user',
  avatar_url text,
  location_tag text,
  bio text,
  listings_count int default 0,
  bookings_count int default 0,
  rating numeric(3,2),
  password_hash text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ── Listings ──
create table public.listings (
  id uuid primary key default gen_random_uuid(),
  host_id uuid not null references public.profiles(id) on delete cascade,
  title text not null check (char_length(title) <= 200),
  slug text not null,
  type listing_type not null,
  location text not null,
  price int not null check (price >= 0),
  currency text default '₽',
  price_unit text,
  rating numeric(3,2),
  reviews_count int default 0,
  views int default 0,
  bookings_count int default 0,
  active boolean default true,
  verified boolean default false,
  promo promo_type,
  promo_expires_at timestamptz,
  description text,
  max_guests int check (max_guests > 0),
  rooms_count int,
  beds_count int,
  amenities text[] default '{}',
  cover_image text,
  requires_border_permit boolean default false,
  season text,
  transport_type text,
  tour_duration_hours int,
  tour_duration_days int,
  difficulty_level text,
  includes text[] default '{}',
  fishing_type text,
  fish_species text[] default '{}',
  fishing_method text,
  gear_included boolean default false,
  catch_guarantee text,
  license_required boolean default false,
  boat_included boolean default false,
  meals_included boolean default false,
  gear_condition text,
  equipment_list text[] default '{}',
  search_vector tsvector,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(host_id, slug)
);

-- Auto-generate slug + search_vector on insert
create or replace function public.generate_slug()
returns trigger as $$
declare
  base text;
  suffix text;
begin
  base := lower(regexp_replace(new.title, '[^a-zA-Zа-яА-Я0-9]+', '-', 'g'));
  suffix := substring(replace(new.id::text, '-', ''), 1, 8);
  new.slug := base || '-' || suffix;
  new.search_vector := to_tsvector('russian', coalesce(new.title, '') || ' ' || coalesce(new.description, '') || ' ' || coalesce(new.location, ''));
  return new;
end;
$$ language plpgsql;

create trigger trg_generate_slug
  before insert on public.listings
  for each row execute function public.generate_slug();

create or replace function public.update_search_vector()
returns trigger as $$
begin
  new.search_vector := to_tsvector('russian', coalesce(new.title, '') || ' ' || coalesce(new.description, '') || ' ' || coalesce(new.location, ''));
  return new;
end;
$$ language plpgsql;

create trigger trg_update_search_vector
  before update of title, description, location on public.listings
  for each row execute function public.update_search_vector();

-- ── Listing Images ──
create table public.listing_images (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references public.listings(id) on delete cascade,
  storage_path text not null,
  width int,
  height int,
  file_size int,
  is_cover boolean default false,
  sort_order int default 0,
  created_at timestamptz not null default now()
);

-- ── Bookings ──
create table public.bookings (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references public.listings(id) on delete cascade,
  listing_title text not null,
  listing_type listing_type not null,
  location text not null,
  guest_id uuid not null references public.profiles(id) on delete cascade,
  guest_name text not null,
  host_id uuid not null references public.profiles(id) on delete cascade,
  host_name text not null,
  check_in date not null,
  check_out date not null,
  guests int not null default 1 check (guests > 0),
  total_price int not null check (total_price >= 0),
  status booking_status not null default 'pending',
  guest_message text,
  created_at timestamptz not null default now()
);

-- Prevent overlapping bookings
create or replace function public.check_booking_overlap()
returns trigger as $$
begin
  if exists (
    select 1 from public.bookings
    where listing_id = new.listing_id
      and status in ('pending', 'confirmed')
      and id != coalesce(new.id, '00000000-0000-0000-0000-000000000000'::uuid)
      and check_in < new.check_out
      and check_out > new.check_in
  ) then
    raise exception 'Dates overlap with existing booking';
  end if;
  return new;
end;
$$ language plpgsql;

create trigger trg_check_booking_overlap
  before insert or update on public.bookings
  for each row execute function public.check_booking_overlap();

-- ── Messages ──
create table public.messages (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references public.bookings(id) on delete cascade,
  sender_id uuid not null references public.profiles(id),
  text text not null check (char_length(text) <= 5000),
  created_at timestamptz not null default now()
);

-- ── Reviews ──
create table public.reviews (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references public.listings(id) on delete cascade,
  booking_id uuid references public.bookings(id) on delete set null,
  guest_id uuid not null references public.profiles(id),
  rating int not null check (rating >= 1 and rating <= 5),
  text text check (char_length(text) <= 2000),
  created_at timestamptz not null default now()
);

-- ── Favorites ──
create table public.favorites (
  user_id uuid not null references public.profiles(id) on delete cascade,
  listing_id uuid not null references public.listings(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, listing_id)
);

-- ── Promotions ──
create table public.promotions (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references public.listings(id) on delete cascade,
  host_id uuid not null references public.profiles(id),
  promo_type promo_type not null,
  status text not null default 'draft' check (status in ('draft', 'active', 'expired', 'paid')),
  starts_at timestamptz,
  expires_at timestamptz,
  budget_rub int not null default 0 check (budget_rub >= 0),
  created_at timestamptz not null default now()
);

-- ── Banners ──
create table public.banners (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  image_url text,
  link_url text not null,
  slot banner_slot not null,
  active boolean default true,
  impressions int default 0,
  clicks int default 0,
  start_date timestamptz,
  end_date timestamptz,
  created_at timestamptz not null default now()
);

-- ── Pending Edits ──
create table public.pending_edits (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references public.listings(id) on delete cascade,
  listing_title text not null,
  host_id uuid not null references public.profiles(id) on delete cascade,
  host_name text not null,
  changes jsonb not null default '{}',
  submitted_at timestamptz not null default now(),
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected'))
);

-- ── Help Content ──
create table public.help_content (
  key text primary key,
  content text not null default '',
  updated_at timestamptz not null default now()
);

insert into public.help_content (key, content) values
  ('howItWorks', ''), ('faq', ''), ('cancelPolicy', ''),
  ('support', ''), ('hostInfo', ''), ('rules', '');

-- ═══ Indexes ═══

create index idx_profiles_email on public.profiles(email);
create index idx_profiles_role on public.profiles(role);

create index idx_listings_host on public.listings(host_id);
create index idx_listings_verified_active on public.listings(verified, active)
  where verified = true and active = true;
create index idx_listings_type_active on public.listings(type, active) where active = true;
create index idx_listings_location on public.listings(location);
create index idx_listings_rating on public.listings(rating desc nulls last);
create index idx_listings_created on public.listings(created_at desc);
create index idx_listings_search on public.listings using gin(search_vector);
create index idx_listings_price on public.listings(price) where active = true and verified = true;

create index idx_listing_images_listing on public.listing_images(listing_id, sort_order) include (storage_path, is_cover);

create index idx_bookings_guest on public.bookings(guest_id, status, created_at desc);
create index idx_bookings_host on public.bookings(host_id, status, created_at desc);
create index idx_bookings_status on public.bookings(status);
create index idx_bookings_dates on public.bookings(listing_id, check_in, check_out);
create index idx_bookings_overlap on public.bookings(listing_id, check_in, check_out) where status in ('pending', 'confirmed');

create index idx_messages_booking on public.messages(booking_id, created_at);
create index idx_reviews_listing on public.reviews(listing_id, created_at desc);
create index idx_reviews_guest on public.reviews(guest_id);
create index idx_favorites_user on public.favorites(user_id);
create index idx_promotions_listing on public.promotions(listing_id);
create index idx_promotions_status on public.promotions(status) where status = 'active';
create index idx_pending_edits_status on public.pending_edits(status, submitted_at desc);
create index idx_pending_edits_host on public.pending_edits(host_id);

-- ═══ Counter cache triggers ═══

create or replace function public.update_listing_bookings_count()
returns trigger as $$
begin
  if tg_op = 'INSERT' then
    update public.listings set bookings_count = bookings_count + 1 where id = new.listing_id;
  elsif tg_op = 'DELETE' then
    update public.listings set bookings_count = greatest(bookings_count - 1, 0) where id = old.listing_id;
  end if;
  return null;
end;
$$ language plpgsql;

create trigger trg_listing_bookings_count
  after insert or delete on public.bookings
  for each row execute function public.update_listing_bookings_count();

create or replace function public.update_listing_review_stats()
returns trigger as $$
begin
  if tg_op = 'INSERT' then
    update public.listings
    set reviews_count = reviews_count + 1,
        rating = (select round(avg(r.rating)::numeric, 2) from public.reviews r where r.listing_id = new.listing_id)
    where id = new.listing_id;
  elsif tg_op = 'DELETE' then
    update public.listings
    set reviews_count = greatest(reviews_count - 1, 0),
        rating = (select round(avg(r.rating)::numeric, 2) from public.reviews r where r.listing_id = old.listing_id)
    where id = old.listing_id;
  elsif tg_op = 'UPDATE' then
    update public.listings
    set rating = (select round(avg(r.rating)::numeric, 2) from public.reviews r where r.listing_id = new.listing_id)
    where id = new.listing_id;
  end if;
  return null;
end;
$$ language plpgsql;

create trigger trg_listing_review_stats
  after insert or update or delete on public.reviews
  for each row execute function public.update_listing_review_stats();

-- ═══ Seed: demo admin ═══
insert into public.profiles (id, name, email, phone, role, location_tag) values
  ('a0000000-0000-0000-0000-000000000001', 'Администратор', 'admin@sakhgo.ru', '+79990000000', 'admin', 'Южно-Сахалинск'),
  ('a0000000-0000-0000-0000-000000000002', 'Елена М.', 'elena@example.com', '+79020000001', 'user', 'Южно-Сахалинск'),
  ('a0000000-0000-0000-0000-000000000003', 'Сергей К.', 'sergey@example.com', '+79020000002', 'user', 'Корсаков');
