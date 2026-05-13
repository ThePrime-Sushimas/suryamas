-- Migration: Create auth_users table (replaces Supabase auth.users)

CREATE TABLE IF NOT EXISTS auth_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) UNIQUE NOT NULL,
  encrypted_password VARCHAR(255) NOT NULL,
  reset_token VARCHAR(255),
  reset_token_expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_auth_users_email ON auth_users (email);
CREATE INDEX IF NOT EXISTS idx_auth_users_reset_token ON auth_users (reset_token) WHERE reset_token IS NOT NULL;

-- Migrate existing users from Supabase auth.users (run once on migration day)
-- INSERT INTO auth_users (id, email, encrypted_password, created_at, updated_at)
-- SELECT id, email, encrypted_password, created_at, updated_at
-- FROM auth.users;
