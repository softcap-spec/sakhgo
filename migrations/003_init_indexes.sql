-- SakhGO · 003 — Performance indexes
-- All CREATE INDEX statements use IF NOT EXISTS for idempotency.

-- Profiles
CREATE INDEX IF NOT EXISTS idx_profiles_email ON public.profiles(email);
CREATE INDEX IF NOT EXISTS idx_profiles_role  ON public.profiles(role);

-- Listings
CREATE INDEX IF NOT EXISTS idx_listings_host
  ON public.listings(host_id);

CREATE INDEX IF NOT EXISTS idx_listings_verified_active
  ON public.listings(verified, active)
  WHERE verified = true AND active = true;

CREATE INDEX IF NOT EXISTS idx_listings_type_active
  ON public.listings(type, active)
  WHERE active = true;

CREATE INDEX IF NOT EXISTS idx_listings_location
  ON public.listings(location);

CREATE INDEX IF NOT EXISTS idx_listings_rating
  ON public.listings(rating DESC NULLS LAST);

CREATE INDEX IF NOT EXISTS idx_listings_created
  ON public.listings(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_listings_search
  ON public.listings USING gin(search_vector);

CREATE INDEX IF NOT EXISTS idx_listings_price
  ON public.listings(price)
  WHERE active = true AND verified = true;

-- Listing Images
CREATE INDEX IF NOT EXISTS idx_listing_images_listing
  ON public.listing_images(listing_id, sort_order)
  INCLUDE (storage_path, is_cover);

-- Bookings
CREATE INDEX IF NOT EXISTS idx_bookings_guest
  ON public.bookings(guest_id, status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_bookings_host
  ON public.bookings(host_id, status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_bookings_status
  ON public.bookings(status);

CREATE INDEX IF NOT EXISTS idx_bookings_dates
  ON public.bookings(listing_id, check_in, check_out);

CREATE INDEX IF NOT EXISTS idx_bookings_overlap
  ON public.bookings(listing_id, check_in, check_out)
  WHERE status IN ('pending', 'confirmed');

-- Messages
CREATE INDEX IF NOT EXISTS idx_messages_booking
  ON public.messages(booking_id, created_at);

-- Reviews
CREATE INDEX IF NOT EXISTS idx_reviews_listing
  ON public.reviews(listing_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_reviews_guest
  ON public.reviews(guest_id);

-- Favorites
CREATE INDEX IF NOT EXISTS idx_favorites_user
  ON public.favorites(user_id);

-- Promotions
CREATE INDEX IF NOT EXISTS idx_promotions_listing
  ON public.promotions(listing_id);

CREATE INDEX IF NOT EXISTS idx_promotions_status
  ON public.promotions(status)
  WHERE status = 'active';

-- Pending Edits
CREATE INDEX IF NOT EXISTS idx_pending_edits_status
  ON public.pending_edits(status, submitted_at DESC);

CREATE INDEX IF NOT EXISTS idx_pending_edits_host
  ON public.pending_edits(host_id);
