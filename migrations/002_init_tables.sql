-- SakhGO · 002 — Core tables
-- Foreign keys are inline; 004_init_fks.sql is reserved for any future
-- ALTER TABLE ADD CONSTRAINT migration not captured at creation time.

-- ── Profiles ──

CREATE TABLE IF NOT EXISTS public.profiles (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name            text NOT NULL,
  email           text NOT NULL UNIQUE,
  phone           text,
  phone_verified  boolean DEFAULT false,
  verification_code text,
  role            user_role NOT NULL DEFAULT 'user',
  avatar_url      text,
  location_tag    text,
  bio             text,
  listings_count  int DEFAULT 0,
  bookings_count  int DEFAULT 0,
  rating          numeric(3,2),
  password_hash   text,
  email_notifications boolean DEFAULT true,
  tg_notifications    boolean DEFAULT false,
  telegram_chat_id    text,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

COMMENT ON COLUMN public.profiles.email_notifications IS 'Whether user wants email notifications';
COMMENT ON COLUMN public.profiles.tg_notifications IS 'Whether user wants Telegram notifications';
COMMENT ON COLUMN public.profiles.telegram_chat_id IS 'Telegram chat_id for direct user notifications';

-- ── Listings ──

CREATE TABLE IF NOT EXISTS public.listings (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  host_id         uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  title           text NOT NULL CHECK (char_length(title) <= 200),
  slug            text NOT NULL,
  type            listing_type NOT NULL,
  location        text NOT NULL,
  price           int NOT NULL CHECK (price >= 0),
  currency        text DEFAULT '₽',
  price_unit      text,
  rating          numeric(3,2),
  reviews_count   int DEFAULT 0,
  views           int DEFAULT 0,
  bookings_count  int DEFAULT 0,
  active          boolean DEFAULT true,
  verified        boolean DEFAULT false,
  promo           promo_type,
  promo_expires_at timestamptz,
  description     text,
  max_guests      int CHECK (max_guests > 0),
  rooms_count     int,
  beds_count      int,
  amenities       text[] DEFAULT '{}',
  cover_image     text,
  requires_border_permit boolean DEFAULT false,
  season          text,
  transport_type  text,
  tour_duration_hours int,
  tour_duration_days  int,
  difficulty_level text,
  includes        text[] DEFAULT '{}',
  fishing_type    text,
  fish_species    text[] DEFAULT '{}',
  fishing_method  text,
  gear_included   boolean DEFAULT false,
  catch_guarantee text,
  license_required boolean DEFAULT false,
  boat_included   boolean DEFAULT false,
  meals_included  boolean DEFAULT false,
  gear_condition  text,
  equipment_list  text[] DEFAULT '{}',
  search_vector   tsvector,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE(host_id, slug)
);

-- ── Listing Images ──

CREATE TABLE IF NOT EXISTS public.listing_images (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id    uuid NOT NULL REFERENCES public.listings(id) ON DELETE CASCADE,
  storage_path  text NOT NULL,
  width         int,
  height        int,
  file_size     int,
  is_cover      boolean DEFAULT false,
  sort_order    int DEFAULT 0,
  created_at    timestamptz NOT NULL DEFAULT now()
);

-- ── Bookings ──

CREATE TABLE IF NOT EXISTS public.bookings (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id    uuid NOT NULL REFERENCES public.listings(id) ON DELETE CASCADE,
  listing_title text NOT NULL,
  listing_type  listing_type NOT NULL,
  location      text NOT NULL,
  guest_id      uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  guest_name    text NOT NULL,
  host_id       uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  host_name     text NOT NULL,
  check_in      date NOT NULL,
  check_out     date NOT NULL,
  guests        int NOT NULL DEFAULT 1 CHECK (guests > 0),
  total_price   int NOT NULL CHECK (total_price >= 0),
  status        booking_status NOT NULL DEFAULT 'pending',
  guest_message text,
  created_at    timestamptz NOT NULL DEFAULT now()
);

-- ── Messages ──

CREATE TABLE IF NOT EXISTS public.messages (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id  uuid NOT NULL REFERENCES public.bookings(id) ON DELETE CASCADE,
  sender_id   uuid NOT NULL REFERENCES public.profiles(id),
  text        text NOT NULL CHECK (char_length(text) <= 5000),
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- ── Reviews ──

CREATE TABLE IF NOT EXISTS public.reviews (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id  uuid NOT NULL REFERENCES public.listings(id) ON DELETE CASCADE,
  booking_id  uuid REFERENCES public.bookings(id) ON DELETE SET NULL,
  guest_id    uuid NOT NULL REFERENCES public.profiles(id),
  rating      int NOT NULL CHECK (rating >= 1 AND rating <= 5),
  text        text CHECK (char_length(text) <= 2000),
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- ── Favorites ──

CREATE TABLE IF NOT EXISTS public.favorites (
  user_id     uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  listing_id  uuid NOT NULL REFERENCES public.listings(id) ON DELETE CASCADE,
  created_at  timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, listing_id)
);

-- ── Promotions ──

CREATE TABLE IF NOT EXISTS public.promotions (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id  uuid NOT NULL REFERENCES public.listings(id) ON DELETE CASCADE,
  host_id     uuid NOT NULL REFERENCES public.profiles(id),
  promo_type  promo_type NOT NULL,
  status      text NOT NULL DEFAULT 'draft'
                CHECK (status IN ('draft', 'active', 'expired', 'paid')),
  starts_at   timestamptz,
  expires_at  timestamptz,
  budget_rub  int NOT NULL DEFAULT 0 CHECK (budget_rub >= 0),
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- ── Banners ──

CREATE TABLE IF NOT EXISTS public.banners (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title       text NOT NULL,
  image_url   text,
  link_url    text NOT NULL,
  slot        banner_slot NOT NULL,
  active      boolean DEFAULT true,
  impressions int DEFAULT 0,
  clicks      int DEFAULT 0,
  start_date  timestamptz,
  end_date    timestamptz,
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- ── Pending Edits ──

CREATE TABLE IF NOT EXISTS public.pending_edits (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id    uuid NOT NULL REFERENCES public.listings(id) ON DELETE CASCADE,
  listing_title text NOT NULL,
  host_id       uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  host_name     text NOT NULL,
  changes       jsonb NOT NULL DEFAULT '{}',
  submitted_at  timestamptz NOT NULL DEFAULT now(),
  status        text NOT NULL DEFAULT 'pending'
                  CHECK (status IN ('pending', 'approved', 'rejected'))
);

-- ── Help Content ──

CREATE TABLE IF NOT EXISTS public.help_content (
  key       text PRIMARY KEY,
  content   text NOT NULL DEFAULT '',
  updated_at timestamptz NOT NULL DEFAULT now()
);
