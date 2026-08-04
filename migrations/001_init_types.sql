-- SakhGO · 001 — Custom enum types
-- PostgreSQL doesn't support CREATE TYPE IF NOT EXISTS directly;
-- use DO block with exception handler for idempotency.

DO $$ BEGIN
  CREATE TYPE listing_type AS ENUM (
    'property', 'tour', 'fishing', 'rental_gear'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE booking_status AS ENUM (
    'pending', 'confirmed', 'completed', 'cancelled', 'rejected'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE promo_type AS ENUM (
    'top', 'hot', 'highlight'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE banner_slot AS ENUM (
    'home-hero-bottom', 'catalog-sidebar',
    'listing-detail-bottom', 'search-results-top'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE user_role AS ENUM (
    'user', 'admin'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
