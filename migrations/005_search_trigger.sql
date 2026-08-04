-- SakhGO · 005 — Functions, triggers, and full-text search
-- Consolidated from 000001_initial_schema + 000002_fulltext_search
--
-- This migration replaces old separate slug/search triggers with a single
-- BEFORE INSERT OR UPDATE trigger for listings, and adds booking overlap
-- checks plus counter-cache triggers.

-- ═══════════════════════════════════════════════════════════════════════
-- 1. Slug + search_vector generation (BEFORE INSERT)
-- ═══════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.generate_slug()
RETURNS trigger AS $$
DECLARE
  base   text;
  suffix text;
BEGIN
  base   := lower(regexp_replace(NEW.title, '[^a-zA-Zа-яА-Я0-9]+', '-', 'g'));
  suffix := substring(replace(NEW.id::text, '-', ''), 1, 8);
  NEW.slug           := base || '-' || suffix;
  NEW.search_vector  := to_tsvector('russian',
    coalesce(NEW.title, '') || ' ' ||
    coalesce(NEW.description, '') || ' ' ||
    coalesce(NEW.location, '')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_generate_slug ON public.listings;
CREATE TRIGGER trg_generate_slug
  BEFORE INSERT ON public.listings
  FOR EACH ROW EXECUTE FUNCTION public.generate_slug();

-- ═══════════════════════════════════════════════════════════════════════
-- 2. Search vector update on title/description/location change
-- ═══════════════════════════════════════════════════════════════════════

-- Drop the old separate update trigger if it still exists
DROP TRIGGER IF EXISTS trg_update_search_vector ON public.listings;
DROP FUNCTION IF EXISTS public.update_search_vector();

CREATE OR REPLACE FUNCTION public.listings_search_update()
RETURNS trigger AS $$
BEGIN
  NEW.search_vector := to_tsvector('russian',
    coalesce(NEW.title, '') || ' ' ||
    coalesce(NEW.description, '') || ' ' ||
    coalesce(NEW.location, '')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_listings_search ON public.listings;
CREATE TRIGGER trg_listings_search
  BEFORE INSERT OR UPDATE ON public.listings
  FOR EACH ROW EXECUTE FUNCTION public.listings_search_update();

-- Backfill search_vector for any existing rows that may have null values
UPDATE public.listings
SET search_vector = to_tsvector('russian',
  coalesce(title, '') || ' ' ||
  coalesce(description, '') || ' ' ||
  coalesce(location, '')
)
WHERE search_vector IS NULL;

-- ═══════════════════════════════════════════════════════════════════════
-- 3. Booking overlap check
-- ═══════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.check_booking_overlap()
RETURNS trigger AS $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.bookings
    WHERE listing_id = NEW.listing_id
      AND status IN ('pending', 'confirmed')
      AND id != coalesce(NEW.id, '00000000-0000-0000-0000-000000000000'::uuid)
      AND check_in < NEW.check_out
      AND check_out > NEW.check_in
  ) THEN
    RAISE EXCEPTION 'Dates overlap with existing booking';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_check_booking_overlap ON public.bookings;
CREATE TRIGGER trg_check_booking_overlap
  BEFORE INSERT OR UPDATE ON public.bookings
  FOR EACH ROW EXECUTE FUNCTION public.check_booking_overlap();

-- ═══════════════════════════════════════════════════════════════════════
-- 4. Counter cache: listings bookings_count
-- ═══════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.update_listing_bookings_count()
RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.listings
    SET bookings_count = bookings_count + 1
    WHERE id = NEW.listing_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.listings
    SET bookings_count = greatest(bookings_count - 1, 0)
    WHERE id = OLD.listing_id;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_listing_bookings_count ON public.bookings;
CREATE TRIGGER trg_listing_bookings_count
  AFTER INSERT OR DELETE ON public.bookings
  FOR EACH ROW EXECUTE FUNCTION public.update_listing_bookings_count();

-- ═══════════════════════════════════════════════════════════════════════
-- 5. Counter cache: listings reviews_count + rating
-- ═══════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.update_listing_review_stats()
RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.listings
    SET reviews_count = reviews_count + 1,
        rating = (
          SELECT round(avg(r.rating)::numeric, 2)
          FROM public.reviews r
          WHERE r.listing_id = NEW.listing_id
        )
    WHERE id = NEW.listing_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.listings
    SET reviews_count = greatest(reviews_count - 1, 0),
        rating = (
          SELECT round(avg(r.rating)::numeric, 2)
          FROM public.reviews r
          WHERE r.listing_id = OLD.listing_id
        )
    WHERE id = OLD.listing_id;
  ELSIF TG_OP = 'UPDATE' THEN
    UPDATE public.listings
    SET rating = (
      SELECT round(avg(r.rating)::numeric, 2)
      FROM public.reviews r
      WHERE r.listing_id = NEW.listing_id
    )
    WHERE id = NEW.listing_id;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_listing_review_stats ON public.reviews;
CREATE TRIGGER trg_listing_review_stats
  AFTER INSERT OR UPDATE OR DELETE ON public.reviews
  FOR EACH ROW EXECUTE FUNCTION public.update_listing_review_stats();
