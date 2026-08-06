-- 013_phone_verification_attempts.sql
-- Добавляет колонку verification_attempts для ограничения попыток ввода кода

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS verification_attempts int NOT NULL DEFAULT 0;
