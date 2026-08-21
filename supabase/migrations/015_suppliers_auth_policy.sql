-- ============================================================
-- Migration 015: Add missing authenticated RLS policy on suppliers
--
-- The suppliers table only had an anon_all policy.
-- Migration 011 tried to add auth_all but it was never applied,
-- causing the manual stock form to fail with RLS errors when
-- logged-in users (authenticated role) tried to read/create suppliers.
--
-- The PDF seeder worked because it uses the anon key directly,
-- bypassing this issue.
-- ============================================================

-- Add authenticated policy (idempotent — won't fail if already exists)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'suppliers' AND policyname = 'auth_all'
  ) THEN
    EXECUTE 'CREATE POLICY auth_all ON suppliers FOR ALL TO authenticated USING (true) WITH CHECK (true)';
  END IF;
END $$;

-- Also fix missing profiles policies from migration 010
-- (profiles_update_owner and profiles_insert_owner were defined but not applied)

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'profiles' AND policyname = 'profiles_update_owner'
  ) THEN
    EXECUTE 'CREATE POLICY profiles_update_owner ON profiles FOR UPDATE USING (is_owner())';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'profiles' AND policyname = 'profiles_insert_owner'
  ) THEN
    EXECUTE 'CREATE POLICY profiles_insert_owner ON profiles FOR INSERT WITH CHECK (
      EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = ''owner'')
    )';
  END IF;
END $$;
