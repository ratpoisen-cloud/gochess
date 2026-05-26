-- Fix profiles INSERT policy: SECURITY DEFINER function already bypasses RLS,
-- so a separate INSERT policy is unnecessary and dangerous (allows any auth user to insert).
DROP POLICY IF EXISTS "Trigger can insert profiles" ON public.profiles;

NOTIFY pgrst, 'reload schema';
