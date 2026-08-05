-- SakhGO · 011 — Expand user_role from ENUM('user','admin') to TEXT

DO $$
BEGIN
  -- Step 1: Add a temp column
  ALTER TABLE profiles ADD COLUMN role_new text;
  
  -- Step 2: Copy values
  UPDATE profiles SET role_new = role::text;
  
  -- Step 3: Drop old column
  ALTER TABLE profiles DROP COLUMN role;
  
  -- Step 4: Rename new column
  ALTER TABLE profiles RENAME COLUMN role_new TO role;
  
  -- Step 5: Add NOT NULL
  ALTER TABLE profiles ALTER COLUMN role SET NOT NULL;
  
  -- Step 6: Add default
  ALTER TABLE profiles ALTER COLUMN role SET DEFAULT 'user';
END $$;

-- Drop the old enum type (after all tables no longer depend on it)
DROP TYPE IF EXISTS user_role CASCADE;
