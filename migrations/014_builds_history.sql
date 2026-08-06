-- 014_builds_history.sql
-- Таблица истории сборок для админки

CREATE TABLE IF NOT EXISTS public.builds (
  id            SERIAL PRIMARY KEY,
  version       text NOT NULL,
  date          text NOT NULL,
  description   text NOT NULL,
  hash          text NOT NULL,
  changes       jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at    timestamptz NOT NULL DEFAULT now()
);

-- Индекс для сортировки по дате создания
CREATE INDEX IF NOT EXISTS idx_builds_created_at ON public.builds (created_at DESC);