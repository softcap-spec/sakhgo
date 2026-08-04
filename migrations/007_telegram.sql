-- SakhGO · 007 — Telegram notification support
-- Adds tg_notifications preference and telegram_chat_id to profiles.
-- Columns are already included in the 002_init_tables.sql CREATE TABLE;
-- this migration handles the case where profiles was created before 002
-- was updated (backward compatibility for existing deployments).

ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS email_notifications boolean DEFAULT true;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS tg_notifications boolean DEFAULT false;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS telegram_chat_id text;

COMMENT ON COLUMN public.profiles.email_notifications IS 'Whether user wants email notifications';
COMMENT ON COLUMN public.profiles.tg_notifications IS 'Whether user wants Telegram notifications';
COMMENT ON COLUMN public.profiles.telegram_chat_id IS 'Telegram chat_id for direct user notifications';
