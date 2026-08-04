-- SakhGO · 004 — Foreign key constraints
-- All FKs are declared inline in 002_init_tables.sql via REFERENCES clauses.
-- This file exists as a migration slot for any future ALTER TABLE ADD CONSTRAINT
-- statements that need to be added after the initial table creation.
--
-- When adding a new FK on an existing table, use:
--
--   DO $$ BEGIN
--     ALTER TABLE public.child
--       ADD CONSTRAINT fk_name FOREIGN KEY (col) REFERENCES public.parent(id);
--   EXCEPTION WHEN duplicate_object THEN NULL;
--   END $$;
--
-- Example placeholder:
-- Nothing to do in initial deployment — all FKs are inline.

SELECT 1 AS migration_004_placeholder;
