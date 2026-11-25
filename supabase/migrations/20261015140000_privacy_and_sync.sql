-- POPIA records (per-club notice settings, consent log, data subject requests) and
-- offline-first sync tables for drills and matches.
-- Access follows the same club-scoped model as 20261015130000_multi_club.sql.

-- ---------------------------------------------------------------------------
-- Privacy notice settings per club (the club is the responsible party)
-- ---------------------------------------------------------------------------
CREATE TABLE public.club_privacy (
  club_id uuid PRIMARY KEY REFERENCES public.clubs (id) ON DELETE CASCADE,
  responsible_party text,
  physical_address text,
  info_officer_name text,
  info_officer_email citext CHECK (info_officer_email IS NULL OR info_officer_email ~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$'),
  info_officer_phone text,
  hosting_region text NOT NULL DEFAULT 'Supabase project region (set by the club)',
  retention_months integer NOT NULL DEFAULT 24 CHECK (retention_months BETWEEN 1 AND 120),
  policy_version text NOT NULL DEFAULT '2026-10-15',
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.club_privacy ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE ON public.club_privacy TO authenticated;
CREATE POLICY club_privacy_select ON public.club_privacy FOR SELECT TO authenticated
  USING (public.is_club_member(club_id));
CREATE POLICY club_privacy_admin ON public.club_privacy FOR ALL TO authenticated
  USING (public.is_club_admin(club_id)) WITH CHECK (public.is_club_admin(club_id));

-- The notice must be readable before sign-in (e.g. from a registration link), so this
-- returns only the public notice fields for one club, including to anonymous visitors.
CREATE OR REPLACE FUNCTION public.get_privacy_notice(p_club uuid)
RETURNS TABLE (
  club_name text, responsible_party text, physical_address text, info_officer_name text,
  info_officer_email text, info_officer_phone text, hosting_region text, retention_months integer,
  policy_version text
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT c.name, p.responsible_party, p.physical_address, p.info_officer_name, p.info_officer_email::text,
         p.info_officer_phone, p.hosting_region, p.retention_months, p.policy_version
  FROM public.clubs c LEFT JOIN public.club_privacy p ON p.club_id = c.id
  WHERE c.id = p_club;
$$;
REVOKE ALL ON FUNCTION public.get_privacy_notice(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_privacy_notice(uuid) TO anon, authenticated;

-- ---------------------------------------------------------------------------
-- Consent log
-- ---------------------------------------------------------------------------
ALTER TABLE public.guardians ADD COLUMN IF NOT EXISTS consent_version text;

CREATE TABLE public.consents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id uuid NOT NULL REFERENCES public.clubs (id) ON DELETE CASCADE,
  player_id uuid,
  user_id uuid DEFAULT auth.uid() REFERENCES auth.users (id) ON DELETE SET NULL,
  kind text NOT NULL CHECK (kind IN ('REGISTRATION', 'PORTAL_NOTICE')),
  policy_version text NOT NULL,
  given_by_name text,
  given_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (player_id, club_id) REFERENCES public.players (id, club_id) ON DELETE CASCADE
);
CREATE INDEX consents_player_idx ON public.consents (player_id);
ALTER TABLE public.consents ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT ON public.consents TO authenticated;  -- append-only for users
CREATE POLICY consents_select ON public.consents FOR SELECT TO authenticated
  USING (public.is_club_admin(club_id)
         OR (player_id IS NOT NULL AND public.staffs_player(player_id, ARRAY['TEAM_MANAGER']::public.staff_role[]))
         OR (player_id IS NOT NULL AND public.is_own_player(player_id))
         OR user_id = auth.uid());
CREATE POLICY consents_insert ON public.consents FOR INSERT TO authenticated
  WITH CHECK (
    given_at > now() - interval '5 minutes'
    AND (
      public.is_club_admin(club_id)
      OR (player_id IS NOT NULL AND public.staffs_player(player_id, ARRAY['TEAM_MANAGER']::public.staff_role[]))
      OR (kind = 'PORTAL_NOTICE' AND user_id = auth.uid() AND player_id IS NOT NULL AND public.is_own_player(player_id))
    )
  );

DROP FUNCTION IF EXISTS public.register_player(uuid, uuid, text, text, date, text, integer, text, text, text, text, text, boolean);
CREATE OR REPLACE FUNCTION public.register_player(
  p_club uuid, p_team uuid, p_first_name text, p_last_name text, p_date_of_birth date,
  p_position text, p_squad_number integer,
  p_guardian_name text, p_guardian_relationship text, p_guardian_email text,
  p_guardian_phone text, p_guardian_alt_phone text, p_guardian_consent boolean,
  p_policy_version text
)
RETURNS uuid LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
DECLARE
  v_player uuid;
BEGIN
  IF COALESCE(trim(p_guardian_email), '') = '' THEN RAISE EXCEPTION 'Guardian email is required'; END IF;
  IF p_guardian_consent IS NOT TRUE THEN RAISE EXCEPTION 'Guardian consent is required'; END IF;
  IF COALESCE(trim(p_policy_version), '') = '' THEN RAISE EXCEPTION 'Privacy notice version is required'; END IF;
  INSERT INTO public.players (club_id, team_id, first_name, last_name, date_of_birth, position, squad_number)
  VALUES (p_club, p_team, trim(p_first_name), trim(p_last_name), p_date_of_birth, p_position, p_squad_number)
  RETURNING id INTO v_player;
  INSERT INTO public.guardians (club_id, player_id, full_name, relationship, email, phone, alt_phone, consent_at, consent_version)
  VALUES (p_club, v_player, trim(p_guardian_name), p_guardian_relationship, lower(trim(p_guardian_email)),
          trim(p_guardian_phone), NULLIF(trim(COALESCE(p_guardian_alt_phone, '')), ''), now(), p_policy_version);
  INSERT INTO public.consents (club_id, player_id, kind, policy_version, given_by_name)
  VALUES (p_club, v_player, 'REGISTRATION', p_policy_version, trim(p_guardian_name));
  RETURN v_player;
END;
$$;
REVOKE ALL ON FUNCTION public.register_player(uuid, uuid, text, text, date, text, integer, text, text, text, text, text, boolean, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.register_player(uuid, uuid, text, text, date, text, integer, text, text, text, text, text, boolean, text) TO authenticated;

-- ---------------------------------------------------------------------------
-- Data subject requests (access, correction, deletion)
-- ---------------------------------------------------------------------------
CREATE TABLE public.data_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id uuid NOT NULL,
  player_id uuid NOT NULL,
  requested_by uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users (id) ON DELETE CASCADE,
  kind text NOT NULL CHECK (kind IN ('ACCESS', 'CORRECTION', 'DELETION')),
  details text,
  status text NOT NULL DEFAULT 'OPEN' CHECK (status IN ('OPEN', 'DONE', 'REJECTED')),
  response text,
  created_at timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz,
  -- Kept if the player is deleted so the club can show it handled the request.
  FOREIGN KEY (club_id) REFERENCES public.clubs (id) ON DELETE CASCADE
);
ALTER TABLE public.data_requests ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE ON public.data_requests TO authenticated;
CREATE POLICY data_requests_select ON public.data_requests FOR SELECT TO authenticated
  USING (public.is_club_admin(club_id) OR requested_by = auth.uid());
CREATE POLICY data_requests_insert ON public.data_requests FOR INSERT TO authenticated
  WITH CHECK (requested_by = auth.uid() AND status = 'OPEN' AND public.is_own_player(player_id)
              AND EXISTS (SELECT 1 FROM public.players p WHERE p.id = player_id AND p.club_id = data_requests.club_id));
CREATE POLICY data_requests_admin_update ON public.data_requests FOR UPDATE TO authenticated
  USING (public.is_club_admin(club_id)) WITH CHECK (public.is_club_admin(club_id));

-- ---------------------------------------------------------------------------
-- Offline-first sync: drills and matches.
-- Conflict rule: last write wins on updated_at (set by the device at edit time).
-- An update carrying an older updated_at than the stored row is ignored.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.sync_last_write_wins()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.club_id <> OLD.club_id OR NEW.local_id <> OLD.local_id THEN
    RAISE EXCEPTION 'Synced records cannot move between clubs';
  END IF;
  IF NEW.updated_at < OLD.updated_at THEN
    RETURN NULL; -- stale write: keep the newer row
  END IF;
  NEW.updated_by := auth.uid();
  RETURN NEW;
END;
$$;

CREATE TABLE public.club_drills (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id uuid NOT NULL REFERENCES public.clubs (id) ON DELETE CASCADE,
  local_id text NOT NULL CHECK (length(local_id) BETWEEN 1 AND 120),
  title text NOT NULL DEFAULT '',
  drill jsonb NOT NULL,
  board jsonb,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid DEFAULT auth.uid() REFERENCES auth.users (id) ON DELETE SET NULL,
  deleted_at timestamptz,
  UNIQUE (club_id, local_id),
  CHECK (octet_length(drill::text) + COALESCE(octet_length(board::text), 0) < 2000000)
);
CREATE TRIGGER club_drills_lww BEFORE UPDATE ON public.club_drills
  FOR EACH ROW EXECUTE FUNCTION public.sync_last_write_wins();

CREATE TABLE public.club_matches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id uuid NOT NULL REFERENCES public.clubs (id) ON DELETE CASCADE,
  local_id text NOT NULL CHECK (length(local_id) BETWEEN 1 AND 120),
  team_id uuid,
  team_label text,
  opponent text NOT NULL DEFAULT '',
  played_on text,
  kickoff_at timestamptz,
  duration_seconds integer CHECK (duration_seconds IS NULL OR duration_seconds >= 0),
  our_score smallint CHECK (our_score IS NULL OR our_score >= 0),
  their_score smallint CHECK (their_score IS NULL OR their_score >= 0),
  formation text,
  -- players, minutes, substitutions (rotation events), and pitch layout
  detail jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid DEFAULT auth.uid() REFERENCES auth.users (id) ON DELETE SET NULL,
  deleted_at timestamptz,
  UNIQUE (club_id, local_id),
  FOREIGN KEY (team_id, club_id) REFERENCES public.teams (id, club_id) ON DELETE SET NULL (team_id),
  CHECK (octet_length(detail::text) < 1000000)
);
CREATE TRIGGER club_matches_lww BEFORE UPDATE ON public.club_matches
  FOR EACH ROW EXECUTE FUNCTION public.sync_last_write_wins();

CREATE OR REPLACE FUNCTION public.is_club_staff(p_club uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.has_club_role(p_club, ARRAY['CLUB_ADMIN', 'COACH', 'TEAM_MANAGER', 'FITNESS']::public.club_role[]);
$$;
REVOKE ALL ON FUNCTION public.is_club_staff(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_club_staff(uuid) TO authenticated;

ALTER TABLE public.club_drills ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.club_matches ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE ON public.club_drills, public.club_matches TO authenticated;
GRANT DELETE ON public.club_drills, public.club_matches TO authenticated;

-- Drills are club coaching material: every staff role in the club, never players or other clubs.
CREATE POLICY club_drills_staff ON public.club_drills FOR ALL TO authenticated
  USING (public.is_club_staff(club_id)) WITH CHECK (public.is_club_staff(club_id));

-- Matches hold squad names and minutes: the club admin, staff of that team, or any staff
-- member for matches not yet tied to a club team.
CREATE POLICY club_matches_staff ON public.club_matches FOR ALL TO authenticated
  USING (public.is_club_admin(club_id)
         OR (team_id IS NOT NULL AND public.is_team_staff(team_id))
         OR (team_id IS NULL AND public.is_club_staff(club_id)))
  WITH CHECK (public.is_club_admin(club_id)
         OR (team_id IS NOT NULL AND public.is_team_staff(team_id))
         OR (team_id IS NULL AND public.is_club_staff(club_id)));
