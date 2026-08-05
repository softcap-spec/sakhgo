-- Migration 012: ЮKassa payment integration
-- Adds payment tracking columns to promotions table

ALTER TABLE public.promotions
  ADD COLUMN IF NOT EXISTS payment_id        text UNIQUE,         -- ЮKassa payment UUID
  ADD COLUMN IF NOT EXISTS idempotency_key   text UNIQUE,         -- prevents double-activation
  ADD COLUMN IF NOT EXISTS payment_url       text,                -- confirmation URL → redirect host
  ADD COLUMN IF NOT EXISTS paid_at           timestamptz,
  ADD COLUMN IF NOT EXISTS refunded_at       timestamptz,
  ADD COLUMN IF NOT EXISTS webhook_event_id  text;                -- ЮKassa event id for idempotency

CREATE INDEX IF NOT EXISTS idx_promotions_payment_id
  ON public.promotions(payment_id) WHERE payment_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_promotions_status_expires
  ON public.promotions(status, expires_at) WHERE status = 'active';

-- Webhook event log — one row per incoming notification.
-- Prevents double-processing if ЮKassa retries the same event.
CREATE TABLE IF NOT EXISTS public.payment_events (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id      text NOT NULL UNIQUE,   -- ЮKassa event id (idempotency key)
  event_type    text NOT NULL,          -- payment.succeeded | payment.canceled | refund.succeeded
  payment_id    text NOT NULL,
  promotion_id  uuid REFERENCES public.promotions(id),
  raw_body      jsonb NOT NULL,
  processed_at  timestamptz NOT NULL DEFAULT now()
);
