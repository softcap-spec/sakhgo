-- Add vk_id for VK ID authentication
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS vk_id TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS avatar_url TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS idx_profiles_vk_id ON profiles(vk_id);
