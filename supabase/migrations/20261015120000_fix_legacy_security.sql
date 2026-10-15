-- Fixes two problems in 20261003120000_initial_schema.sql.
--
-- 1. Admin promotion. protect_profile_privileges() reverted every role change made
--    without a signed-in super admin, including the documented first-admin UPDATE
--    run from the SQL editor (auth.uid() is NULL there) and service-role updates.
--    Trusted sessions with no end-user JWT may now change role and team_id.
--
-- 2. player_details.user_id hole. The coach policy allowed FOR ALL, so a coach could
--    point a roster row at any auth user and give that account read access to the
--    player's scores and minutes. Only a super admin (or a trusted session) may set
--    or change user_id now.
--
-- The multi-club model in 20261015130000_multi_club.sql supersedes these legacy
-- tables for the app; they are kept so existing projects migrate cleanly.

CREATE OR REPLACE FUNCTION public.is_trusted_session()
RETURNS boolean
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  -- No end-user JWT subject: SQL editor, migrations, or the service role.
  SELECT auth.uid() IS NULL
    AND COALESCE(NULLIF(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role', 'service_role')
        IN ('service_role', 'supabase_admin', 'postgres');
$$;

REVOKE ALL ON FUNCTION public.is_trusted_session() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_trusted_session() TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.protect_profile_privileges()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT (public.is_trusted_session() OR public.is_super_admin()) THEN
    NEW.role := OLD.role;
    NEW.team_id := OLD.team_id;
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.protect_player_details_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF public.is_trusted_session() OR public.is_super_admin() THEN
    RETURN NEW;
  END IF;
  IF TG_OP = 'INSERT' AND NEW.user_id IS NOT NULL THEN
    RAISE EXCEPTION 'Only a club admin can link a roster row to an account';
  END IF;
  IF TG_OP = 'UPDATE' AND NEW.user_id IS DISTINCT FROM OLD.user_id THEN
    RAISE EXCEPTION 'Only a club admin can link a roster row to an account';
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.protect_player_details_user() FROM PUBLIC;

DROP TRIGGER IF EXISTS player_details_protect_user ON public.player_details;
CREATE TRIGGER player_details_protect_user
  BEFORE INSERT OR UPDATE ON public.player_details
  FOR EACH ROW
  EXECUTE FUNCTION public.protect_player_details_user();
