-- 008: Password reset token fields
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS password_reset_token text;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS password_reset_expires timestamptz;
