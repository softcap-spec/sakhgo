ALTER TABLE profiles ADD COLUMN IF NOT EXISTS email_verified BOOLEAN DEFAULT false;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS email_verification_code TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS email_verification_expires TIMESTAMPTZ;
UPDATE profiles SET email_verified = true WHERE password_hash IS NOT NULL AND email_verified = false;
