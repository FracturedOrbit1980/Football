-- Multi-club access model.
--
-- Every club-owned row carries club_id. Row level security grants access only through
-- club_members (club roles) and team_staff (team roles). Composite foreign keys of the
-- form (x_id, club_id) stop a row in one club from pointing at another club's rows.
--
-- Roles
--   platform admin  : platform_admins row. Creates clubs and invites their first admin.
--                     Deliberately has NO access to player, guardian, rating, or finance
--                     data (POPIA data minimisation).
--   CLUB_ADMIN      : everything inside their own club.
--   COACH           : team staff. Reads their teams' players; full CRUD on ratings.
--   TEAM_MANAGER    : team staff. Reads their teams' players and guardians; manages
--                     registration details and finance for those players.
--   FITNESS         : optional team staff. Reads their teams' players.
--   PLAYER/GUARDIAN : reads only the linked player record (player portal).

CREATE EXTENSION IF NOT EXISTS citext;

CREATE TYPE public.club_role AS ENUM ('CLUB_ADMIN', 'COACH', 'TEAM_MANAGER', 'FITNESS', 'PLAYER', 'GUARDIAN');
CREATE TYPE public.staff_role AS ENUM ('COACH', 'TEAM_MANAGER', 'FITNESS');
CREATE TYPE public.sponsor_placement AS ENUM ('APP_BACKGROUND', 'PITCH_WATERMARK', 'HEADER', 'STATEMENT', 'KIT');

-- ---------------------------------------------------------------------------
-- Legacy tables from the first slice. They had no club scope, so end users lose
-- direct access. The app now uses the club-scoped tables below.
-- ---------------------------------------------------------------------------
REVOKE ALL ON public.player_details, public.player_evaluations, public.match_sessions,
  public.match_player_minutes, public.drills FROM authenticated, anon;

-- The original policies let every signed-in user read every club's structure.
DROP POLICY IF EXISTS clubs_select_member ON public.clubs;
DROP POLICY IF EXISTS clubs_write_super_admin ON public.clubs;
DROP POLICY IF EXISTS age_groups_select_member ON public.age_groups;
DROP POLICY IF EXISTS age_groups_write_super_admin ON public.age_groups;
DROP POLICY IF EXISTS teams_select_member ON public.teams;
DROP POLICY IF EXISTS teams_write_super_admin ON public.teams;

-- ---------------------------------------------------------------------------
-- Platform and membership
-- ---------------------------------------------------------------------------
CREATE TABLE public.platform_admins (
  user_id uuid PRIMARY KEY REFERENCES auth.users (id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.clubs
  ADD COLUMN IF NOT EXISTS slug text,
  ADD COLUMN IF NOT EXISTS player_code_prefix text NOT NULL DEFAULT 'P',
  ADD COLUMN IF NOT EXISTS created_by uuid REFERENCES auth.users (id) ON DELETE SET NULL;
ALTER TABLE public.clubs ALTER COLUMN name DROP DEFAULT;
CREATE UNIQUE INDEX IF NOT EXISTS clubs_slug_key ON public.clubs (slug) WHERE slug IS NOT NULL;
ALTER TABLE public.clubs ADD CONSTRAINT clubs_prefix_format CHECK (player_code_prefix ~ '^[A-Z0-9]{1,6}$');

CREATE TABLE public.club_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id uuid NOT NULL REFERENCES public.clubs (id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  role public.club_role NOT NULL,
  display_name text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (club_id, user_id, role)
);
CREATE INDEX club_members_user_idx ON public.club_members (user_id);

-- ---------------------------------------------------------------------------
-- Helpers. SECURITY DEFINER so policies can consult membership without recursion.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.is_platform_admin()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.platform_admins WHERE user_id = auth.uid());
$$;

CREATE OR REPLACE FUNCTION public.is_club_member(p_club uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.club_members WHERE club_id = p_club AND user_id = auth.uid());
$$;

CREATE OR REPLACE FUNCTION public.has_club_role(p_club uuid, p_roles public.club_role[])
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.club_members
    WHERE club_id = p_club AND user_id = auth.uid() AND role = ANY (p_roles)
  );
$$;

CREATE OR REPLACE FUNCTION public.is_club_admin(p_club uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.has_club_role(p_club, ARRAY['CLUB_ADMIN']::public.club_role[]);
$$;

-- ---------------------------------------------------------------------------
-- Teams
-- ---------------------------------------------------------------------------
ALTER TABLE public.teams ADD COLUMN IF NOT EXISTS club_id uuid REFERENCES public.clubs (id) ON DELETE CASCADE;
UPDATE public.teams t SET club_id = g.club_id FROM public.age_groups g WHERE g.id = t.age_group_id AND t.club_id IS NULL;
ALTER TABLE public.teams ALTER COLUMN club_id SET NOT NULL;
ALTER TABLE public.teams ADD CONSTRAINT teams_id_club_key UNIQUE (id, club_id);
ALTER TABLE public.age_groups ADD CONSTRAINT age_groups_id_club_key UNIQUE (id, club_id);
ALTER TABLE public.age_groups ALTER COLUMN club_id SET NOT NULL;
-- A team's age group must belong to the same club.
ALTER TABLE public.teams DROP CONSTRAINT IF EXISTS teams_age_group_id_fkey;
ALTER TABLE public.teams ADD CONSTRAINT teams_age_group_same_club
  FOREIGN KEY (age_group_id, club_id) REFERENCES public.age_groups (id, club_id) ON DELETE CASCADE;

CREATE TABLE public.team_staff (
  team_id uuid NOT NULL,
  club_id uuid NOT NULL,
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  role public.staff_role NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (team_id, role),             -- one coach, one manager, one fitness lead per team
  FOREIGN KEY (team_id, club_id) REFERENCES public.teams (id, club_id) ON DELETE CASCADE
);
-- A coach may hold many teams: no uniqueness on user_id.
CREATE INDEX team_staff_user_idx ON public.team_staff (user_id);

CREATE OR REPLACE FUNCTION public.is_team_staff(p_team uuid, p_roles public.staff_role[] DEFAULT NULL)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.team_staff
    WHERE team_id = p_team AND user_id = auth.uid() AND (p_roles IS NULL OR role = ANY (p_roles))
  );
$$;

-- Team staff must hold the matching club role in the same club.
CREATE OR REPLACE FUNCTION public.check_team_staff_member()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.club_members
    WHERE club_id = NEW.club_id AND user_id = NEW.user_id AND role::text = NEW.role::text
  ) THEN
    RAISE EXCEPTION 'User is not a % of this club', NEW.role;
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER team_staff_member_check BEFORE INSERT OR UPDATE ON public.team_staff
  FOR EACH ROW EXECUTE FUNCTION public.check_team_staff_member();

-- ---------------------------------------------------------------------------
-- Players and guardians
-- ---------------------------------------------------------------------------
CREATE TABLE public.club_counters (
  club_id uuid NOT NULL REFERENCES public.clubs (id) ON DELETE CASCADE,
  kind text NOT NULL,
  last_value integer NOT NULL DEFAULT 0,
  PRIMARY KEY (club_id, kind)
);

CREATE TABLE public.players (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id uuid NOT NULL REFERENCES public.clubs (id) ON DELETE CASCADE,
  team_id uuid,
  user_id uuid UNIQUE REFERENCES auth.users (id) ON DELETE SET NULL, -- one club per player account
  player_code text NOT NULL,
  card_ref text,
  card_issued_on date,
  first_name text NOT NULL CHECK (length(trim(first_name)) > 0),
  last_name text NOT NULL CHECK (length(trim(last_name)) > 0),
  date_of_birth date,
  position text,
  squad_number integer CHECK (squad_number BETWEEN 0 AND 999),
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (id, club_id),
  UNIQUE (club_id, player_code),
  UNIQUE (club_id, card_ref),
  FOREIGN KEY (team_id, club_id) REFERENCES public.teams (id, club_id) ON DELETE SET NULL (team_id)
);
CREATE INDEX players_team_idx ON public.players (team_id);

CREATE TABLE public.guardians (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id uuid NOT NULL,
  player_id uuid NOT NULL,
  user_id uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  full_name text NOT NULL CHECK (length(trim(full_name)) > 0),
  relationship text,
  email citext NOT NULL CHECK (email ~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$'),
  phone text NOT NULL CHECK (phone ~ '^\+?[0-9 ()-]{9,20}$'),
  alt_phone text CHECK (alt_phone IS NULL OR alt_phone ~ '^\+?[0-9 ()-]{9,20}$'),
  is_primary boolean NOT NULL DEFAULT true,
  -- POPIA: processing a child's personal information needs a competent person's consent.
  consent_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (player_id, club_id) REFERENCES public.players (id, club_id) ON DELETE CASCADE
);
CREATE INDEX guardians_player_idx ON public.guardians (player_id);
CREATE INDEX guardians_user_idx ON public.guardians (user_id);

CREATE OR REPLACE FUNCTION public.next_club_number(p_club uuid, p_kind text)
RETURNS integer LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  INSERT INTO public.club_counters AS c (club_id, kind, last_value) VALUES (p_club, p_kind, 1)
  ON CONFLICT (club_id, kind) DO UPDATE SET last_value = c.last_value + 1
  RETURNING last_value;
$$;
REVOKE ALL ON FUNCTION public.next_club_number(uuid, text) FROM PUBLIC, authenticated, anon;

-- Player ids are generated per club (e.g. P00001) and cannot be changed by users.
CREATE OR REPLACE FUNCTION public.players_assign_code()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    NEW.player_code := (SELECT player_code_prefix FROM public.clubs WHERE id = NEW.club_id)
      || lpad(public.next_club_number(NEW.club_id, 'player')::text, 5, '0');
  ELSE
    IF NEW.club_id <> OLD.club_id THEN RAISE EXCEPTION 'A player cannot move between clubs'; END IF;
    NEW.player_code := OLD.player_code;
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.players_assign_code() FROM PUBLIC;
CREATE TRIGGER players_assign_code BEFORE INSERT OR UPDATE ON public.players
  FOR EACH ROW EXECUTE FUNCTION public.players_assign_code();

-- Account links (user_id) are only made by claim_my_invites() (SECURITY DEFINER, so
-- current_user is the owner there), never by a direct client write.
CREATE OR REPLACE FUNCTION public.players_protect_user()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF current_user IN ('authenticated', 'anon') THEN
    IF TG_OP = 'INSERT' AND NEW.user_id IS NOT NULL THEN
      RAISE EXCEPTION 'Player accounts are linked by invitation only';
    END IF;
    IF TG_OP = 'UPDATE' AND NEW.user_id IS DISTINCT FROM OLD.user_id THEN
      RAISE EXCEPTION 'Player accounts are linked by invitation only';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER players_protect_user BEFORE INSERT OR UPDATE ON public.players
  FOR EACH ROW EXECUTE FUNCTION public.players_protect_user();

CREATE OR REPLACE FUNCTION public.guardians_before_write()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF current_user IN ('authenticated', 'anon') THEN
    IF TG_OP = 'INSERT' AND NEW.user_id IS NOT NULL THEN
      RAISE EXCEPTION 'Guardian accounts are linked by invitation only';
    END IF;
    IF TG_OP = 'UPDATE' AND NEW.user_id IS DISTINCT FROM OLD.user_id THEN
      RAISE EXCEPTION 'Guardian accounts are linked by invitation only';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER guardians_before_write BEFORE INSERT OR UPDATE ON public.guardians
  FOR EACH ROW EXECUTE FUNCTION public.guardians_before_write();

CREATE OR REPLACE FUNCTION public.player_team(p_player uuid)
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT team_id FROM public.players WHERE id = p_player;
$$;

CREATE OR REPLACE FUNCTION public.is_own_player(p_player uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.players WHERE id = p_player AND user_id = auth.uid())
      OR EXISTS (SELECT 1 FROM public.guardians WHERE player_id = p_player AND user_id = auth.uid());
$$;

-- Staff of the player's current team, optionally limited to some staff roles.
CREATE OR REPLACE FUNCTION public.staffs_player(p_player uuid, p_roles public.staff_role[] DEFAULT NULL)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.players p
    JOIN public.team_staff s ON s.team_id = p.team_id
    WHERE p.id = p_player AND s.user_id = auth.uid() AND (p_roles IS NULL OR s.role = ANY (p_roles))
  );
$$;

-- Issue (or re-issue) a player card. Card references are unique per club.
CREATE OR REPLACE FUNCTION public.issue_player_card(p_player uuid)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_club uuid;
  v_ref text;
BEGIN
  SELECT club_id INTO v_club FROM public.players WHERE id = p_player;
  IF v_club IS NULL OR NOT (public.is_club_admin(v_club) OR public.staffs_player(p_player, ARRAY['TEAM_MANAGER']::public.staff_role[])) THEN
    RAISE EXCEPTION 'Not allowed';
  END IF;
  v_ref := 'C' || to_char(now(), 'YYYY') || '-' || lpad(public.next_club_number(v_club, 'card')::text, 5, '0');
  UPDATE public.players SET card_ref = v_ref, card_issued_on = current_date WHERE id = p_player;
  RETURN v_ref;
END;
$$;

-- ---------------------------------------------------------------------------
-- Ratings
-- ---------------------------------------------------------------------------
CREATE TABLE public.player_ratings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id uuid NOT NULL,
  player_id uuid NOT NULL,
  rated_by uuid DEFAULT auth.uid() REFERENCES auth.users (id) ON DELETE SET NULL,
  rated_on date NOT NULL DEFAULT current_date,
  technical smallint NOT NULL CHECK (technical BETWEEN 1 AND 10),
  tactical smallint NOT NULL CHECK (tactical BETWEEN 1 AND 10),
  physical smallint NOT NULL CHECK (physical BETWEEN 1 AND 10),
  mental smallint NOT NULL CHECK (mental BETWEEN 1 AND 10),
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (player_id, club_id) REFERENCES public.players (id, club_id) ON DELETE CASCADE
);
CREATE INDEX player_ratings_player_idx ON public.player_ratings (player_id);

-- ---------------------------------------------------------------------------
-- Finance (amounts in cents, ZAR)
-- ---------------------------------------------------------------------------
CREATE TABLE public.budget_lines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id uuid NOT NULL,
  player_id uuid NOT NULL,
  description text NOT NULL CHECK (length(trim(description)) > 0),
  amount_cents integer NOT NULL,
  due_on date,
  created_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (player_id, club_id) REFERENCES public.players (id, club_id) ON DELETE CASCADE
);

CREATE TABLE public.kit_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id uuid NOT NULL REFERENCES public.clubs (id) ON DELETE CASCADE,
  name text NOT NULL CHECK (length(trim(name)) > 0),
  size text NOT NULL DEFAULT '',
  unit_value_cents integer NOT NULL CHECK (unit_value_cents >= 0),
  UNIQUE (id, club_id),
  UNIQUE (club_id, name, size)
);

CREATE TABLE public.kit_allocations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id uuid NOT NULL,
  player_id uuid NOT NULL,
  kit_item_id uuid NOT NULL,
  quantity integer NOT NULL DEFAULT 1 CHECK (quantity > 0),
  unit_value_cents integer NOT NULL CHECK (unit_value_cents >= 0),
  issued_on date NOT NULL DEFAULT current_date,
  returned_on date,
  FOREIGN KEY (player_id, club_id) REFERENCES public.players (id, club_id) ON DELETE CASCADE,
  FOREIGN KEY (kit_item_id, club_id) REFERENCES public.kit_items (id, club_id) ON DELETE RESTRICT
);

CREATE TABLE public.subs_charges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id uuid NOT NULL,
  player_id uuid NOT NULL,
  period text NOT NULL CHECK (period ~ '^[0-9]{4}-(0[1-9]|1[0-2])$'),
  amount_cents integer NOT NULL CHECK (amount_cents >= 0),
  paid boolean NOT NULL DEFAULT false,
  paid_on date,
  method text,
  UNIQUE (player_id, period),
  FOREIGN KEY (player_id, club_id) REFERENCES public.players (id, club_id) ON DELETE CASCADE
);

-- ---------------------------------------------------------------------------
-- Sponsors and branding (files live in storage under <club_id>/...)
-- ---------------------------------------------------------------------------
CREATE TABLE public.sponsors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id uuid NOT NULL REFERENCES public.clubs (id) ON DELETE CASCADE,
  name text NOT NULL CHECK (length(trim(name)) > 0),
  website text CHECK (website IS NULL OR website ~ '^https://'),
  logo_path text CHECK (logo_path IS NULL OR logo_path LIKE club_id::text || '/%'),
  placement public.sponsor_placement NOT NULL DEFAULT 'HEADER',
  active boolean NOT NULL DEFAULT true,
  starts_on date,
  ends_on date,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.club_branding (
  club_id uuid PRIMARY KEY REFERENCES public.clubs (id) ON DELETE CASCADE,
  logo_path text CHECK (logo_path IS NULL OR logo_path LIKE club_id::text || '/%'),
  watermark_path text CHECK (watermark_path IS NULL OR watermark_path LIKE club_id::text || '/%'),
  backdrop_path text CHECK (backdrop_path IS NULL OR backdrop_path LIKE club_id::text || '/%'),
  watermark_opacity numeric(3,2) NOT NULL DEFAULT 0.12 CHECK (watermark_opacity BETWEEN 0 AND 1),
  primary_color text CHECK (primary_color IS NULL OR primary_color ~ '^#[0-9a-fA-F]{6}$'),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------------
-- Invitations: the only way accounts join clubs or link to players.
-- ---------------------------------------------------------------------------
CREATE TABLE public.club_invites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id uuid NOT NULL REFERENCES public.clubs (id) ON DELETE CASCADE,
  email citext NOT NULL CHECK (email ~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$'),
  role public.club_role NOT NULL,
  team_id uuid,
  player_id uuid,
  invited_by uuid DEFAULT auth.uid() REFERENCES auth.users (id) ON DELETE SET NULL,
  accepted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (team_id, club_id) REFERENCES public.teams (id, club_id) ON DELETE CASCADE,
  FOREIGN KEY (player_id, club_id) REFERENCES public.players (id, club_id) ON DELETE CASCADE,
  CHECK (role NOT IN ('PLAYER', 'GUARDIAN') OR player_id IS NOT NULL),
  CHECK (team_id IS NULL OR role IN ('COACH', 'TEAM_MANAGER', 'FITNESS'))
);
CREATE INDEX club_invites_email_idx ON public.club_invites (email) WHERE accepted_at IS NULL;

-- Called by the app after sign-in. Matches pending invites to the verified email.
CREATE OR REPLACE FUNCTION public.claim_my_invites()
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_email text := lower(COALESCE(auth.jwt() ->> 'email', ''));
  v_invite public.club_invites;
  v_count integer := 0;
BEGIN
  IF v_uid IS NULL OR v_email = '' THEN RETURN 0; END IF;
  FOR v_invite IN
    SELECT * FROM public.club_invites WHERE lower(email::text) = v_email AND accepted_at IS NULL FOR UPDATE
  LOOP
    INSERT INTO public.club_members (club_id, user_id, role, display_name)
    VALUES (v_invite.club_id, v_uid, v_invite.role, v_email)
    ON CONFLICT (club_id, user_id, role) DO NOTHING;

    IF v_invite.team_id IS NOT NULL THEN
      INSERT INTO public.team_staff (team_id, club_id, user_id, role)
      VALUES (v_invite.team_id, v_invite.club_id, v_uid, v_invite.role::text::public.staff_role)
      ON CONFLICT (team_id, role) DO UPDATE SET user_id = EXCLUDED.user_id;
    END IF;

    IF v_invite.role = 'PLAYER' THEN
      UPDATE public.players SET user_id = v_uid WHERE id = v_invite.player_id AND user_id IS NULL;
    ELSIF v_invite.role = 'GUARDIAN' THEN
      UPDATE public.guardians SET user_id = v_uid
      WHERE player_id = v_invite.player_id AND lower(email::text) = v_email AND user_id IS NULL;
    END IF;

    UPDATE public.club_invites SET accepted_at = now() WHERE id = v_invite.id;
    v_count := v_count + 1;
  END LOOP;
  RETURN v_count;
END;
$$;

-- Platform admin creates a club and invites its first admin.
CREATE OR REPLACE FUNCTION public.create_club(p_name text, p_admin_email text, p_prefix text DEFAULT 'P')
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_club uuid;
BEGIN
  IF NOT public.is_platform_admin() THEN RAISE EXCEPTION 'Only a platform admin can create clubs'; END IF;
  INSERT INTO public.clubs (name, player_code_prefix, created_by)
  VALUES (trim(p_name), upper(COALESCE(NULLIF(trim(p_prefix), ''), 'P')), auth.uid())
  RETURNING id INTO v_club;
  INSERT INTO public.club_branding (club_id) VALUES (v_club);
  INSERT INTO public.club_invites (club_id, email, role) VALUES (v_club, lower(trim(p_admin_email)), 'CLUB_ADMIN');
  RETURN v_club;
END;
$$;

-- Registration: a player and a guardian with a mandatory email, in one transaction.
CREATE OR REPLACE FUNCTION public.register_player(
  p_club uuid, p_team uuid, p_first_name text, p_last_name text, p_date_of_birth date,
  p_position text, p_squad_number integer,
  p_guardian_name text, p_guardian_relationship text, p_guardian_email text,
  p_guardian_phone text, p_guardian_alt_phone text, p_guardian_consent boolean
)
RETURNS uuid LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
DECLARE
  v_player uuid;
BEGIN
  IF COALESCE(trim(p_guardian_email), '') = '' THEN RAISE EXCEPTION 'Guardian email is required'; END IF;
  IF p_guardian_consent IS NOT TRUE THEN RAISE EXCEPTION 'Guardian consent is required'; END IF;
  INSERT INTO public.players (club_id, team_id, first_name, last_name, date_of_birth, position, squad_number)
  VALUES (p_club, p_team, trim(p_first_name), trim(p_last_name), p_date_of_birth, p_position, p_squad_number)
  RETURNING id INTO v_player;
  INSERT INTO public.guardians (club_id, player_id, full_name, relationship, email, phone, alt_phone, consent_at)
  VALUES (p_club, v_player, trim(p_guardian_name), p_guardian_relationship, lower(trim(p_guardian_email)),
          trim(p_guardian_phone), NULLIF(trim(COALESCE(p_guardian_alt_phone, '')), ''), now());
  RETURN v_player;
END;
$$;

-- ---------------------------------------------------------------------------
-- Grants and row level security
-- ---------------------------------------------------------------------------
REVOKE ALL ON FUNCTION public.is_platform_admin(), public.is_club_member(uuid),
  public.has_club_role(uuid, public.club_role[]), public.is_club_admin(uuid),
  public.is_team_staff(uuid, public.staff_role[]), public.player_team(uuid),
  public.is_own_player(uuid), public.staffs_player(uuid, public.staff_role[]),
  public.issue_player_card(uuid), public.claim_my_invites(), public.create_club(text, text, text),
  public.register_player(uuid, uuid, text, text, date, text, integer, text, text, text, text, text, boolean),
  public.check_team_staff_member() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_platform_admin(), public.is_club_member(uuid),
  public.has_club_role(uuid, public.club_role[]), public.is_club_admin(uuid),
  public.is_team_staff(uuid, public.staff_role[]), public.player_team(uuid),
  public.is_own_player(uuid), public.staffs_player(uuid, public.staff_role[]),
  public.issue_player_card(uuid), public.claim_my_invites(), public.create_club(text, text, text),
  public.register_player(uuid, uuid, text, text, date, text, integer, text, text, text, text, text, boolean)
  TO authenticated;

ALTER TABLE public.platform_admins ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.club_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.team_staff ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.club_counters ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.players ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.guardians ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.player_ratings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.budget_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.kit_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.kit_allocations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subs_charges ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sponsors ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.club_branding ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.club_invites ENABLE ROW LEVEL SECURITY;

GRANT SELECT ON public.platform_admins TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.club_members, public.team_staff, public.players,
  public.guardians, public.player_ratings, public.budget_lines, public.kit_items, public.kit_allocations,
  public.subs_charges, public.sponsors, public.club_branding, public.club_invites TO authenticated;
REVOKE ALL ON public.club_counters FROM authenticated, anon;
REVOKE ALL ON public.clubs, public.age_groups, public.teams FROM anon;

CREATE POLICY platform_admins_self ON public.platform_admins FOR SELECT TO authenticated
  USING (user_id = auth.uid());

-- Clubs: members see their own club; platform admins see the list. Clubs are created by create_club().
CREATE POLICY clubs_select ON public.clubs FOR SELECT TO authenticated
  USING (public.is_club_member(id) OR public.is_platform_admin());
CREATE POLICY clubs_update_admin ON public.clubs FOR UPDATE TO authenticated
  USING (public.is_club_admin(id)) WITH CHECK (public.is_club_admin(id));

CREATE POLICY age_groups_select ON public.age_groups FOR SELECT TO authenticated
  USING (public.is_club_member(club_id));
CREATE POLICY age_groups_admin ON public.age_groups FOR ALL TO authenticated
  USING (public.is_club_admin(club_id)) WITH CHECK (public.is_club_admin(club_id));

CREATE POLICY teams_select ON public.teams FOR SELECT TO authenticated
  USING (public.is_club_member(club_id));
CREATE POLICY teams_admin ON public.teams FOR ALL TO authenticated
  USING (public.is_club_admin(club_id)) WITH CHECK (public.is_club_admin(club_id));

CREATE POLICY club_members_select ON public.club_members FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_club_admin(club_id)
         OR public.has_club_role(club_id, ARRAY['COACH', 'TEAM_MANAGER', 'FITNESS']::public.club_role[])
         OR public.is_platform_admin());
CREATE POLICY club_members_admin_update ON public.club_members FOR UPDATE TO authenticated
  USING (public.is_club_admin(club_id)) WITH CHECK (public.is_club_admin(club_id));
CREATE POLICY club_members_admin_delete ON public.club_members FOR DELETE TO authenticated
  USING (public.is_club_admin(club_id) AND user_id <> auth.uid());

CREATE POLICY team_staff_select ON public.team_staff FOR SELECT TO authenticated
  USING (public.is_club_member(club_id));
CREATE POLICY team_staff_admin ON public.team_staff FOR ALL TO authenticated
  USING (public.is_club_admin(club_id)) WITH CHECK (public.is_club_admin(club_id));

-- Players: club admin, staff of the player's team, or the player/guardian themselves.
CREATE POLICY players_select ON public.players FOR SELECT TO authenticated
  USING (public.is_club_admin(club_id) OR public.is_team_staff(team_id) OR public.is_own_player(id));
CREATE POLICY players_admin ON public.players FOR ALL TO authenticated
  USING (public.is_club_admin(club_id)) WITH CHECK (public.is_club_admin(club_id));
CREATE POLICY players_manager_insert ON public.players FOR INSERT TO authenticated
  WITH CHECK (public.is_team_staff(team_id, ARRAY['TEAM_MANAGER']::public.staff_role[]));
CREATE POLICY players_manager_update ON public.players FOR UPDATE TO authenticated
  USING (public.is_team_staff(team_id, ARRAY['TEAM_MANAGER']::public.staff_role[]))
  WITH CHECK (public.is_team_staff(team_id, ARRAY['TEAM_MANAGER']::public.staff_role[]));

-- Guardians: contact details are visible to the club admin, the team manager, and the family.
CREATE POLICY guardians_select ON public.guardians FOR SELECT TO authenticated
  USING (public.is_club_admin(club_id)
         OR public.staffs_player(player_id, ARRAY['TEAM_MANAGER', 'COACH']::public.staff_role[])
         OR public.is_own_player(player_id));
CREATE POLICY guardians_write ON public.guardians FOR ALL TO authenticated
  USING (public.is_club_admin(club_id) OR public.staffs_player(player_id, ARRAY['TEAM_MANAGER']::public.staff_role[]))
  WITH CHECK (public.is_club_admin(club_id) OR public.staffs_player(player_id, ARRAY['TEAM_MANAGER']::public.staff_role[]));

-- Ratings: coaches have full CRUD for their own teams' players; the player reads their own.
CREATE POLICY ratings_select ON public.player_ratings FOR SELECT TO authenticated
  USING (public.is_club_admin(club_id) OR public.staffs_player(player_id) OR public.is_own_player(player_id));
CREATE POLICY ratings_coach_write ON public.player_ratings FOR ALL TO authenticated
  USING (public.is_club_admin(club_id) OR public.staffs_player(player_id, ARRAY['COACH']::public.staff_role[]))
  WITH CHECK (public.is_club_admin(club_id) OR public.staffs_player(player_id, ARRAY['COACH']::public.staff_role[]));

-- Finance: club admin and the team manager write; the player/guardian reads their own lines.
CREATE POLICY budget_select ON public.budget_lines FOR SELECT TO authenticated
  USING (public.is_club_admin(club_id) OR public.staffs_player(player_id, ARRAY['TEAM_MANAGER']::public.staff_role[]) OR public.is_own_player(player_id));
CREATE POLICY budget_write ON public.budget_lines FOR ALL TO authenticated
  USING (public.is_club_admin(club_id) OR public.staffs_player(player_id, ARRAY['TEAM_MANAGER']::public.staff_role[]))
  WITH CHECK (public.is_club_admin(club_id) OR public.staffs_player(player_id, ARRAY['TEAM_MANAGER']::public.staff_role[]));

CREATE POLICY kit_items_select ON public.kit_items FOR SELECT TO authenticated
  USING (public.is_club_member(club_id));
CREATE POLICY kit_items_admin ON public.kit_items FOR ALL TO authenticated
  USING (public.is_club_admin(club_id)) WITH CHECK (public.is_club_admin(club_id));

CREATE POLICY kit_alloc_select ON public.kit_allocations FOR SELECT TO authenticated
  USING (public.is_club_admin(club_id) OR public.staffs_player(player_id, ARRAY['TEAM_MANAGER']::public.staff_role[]) OR public.is_own_player(player_id));
CREATE POLICY kit_alloc_write ON public.kit_allocations FOR ALL TO authenticated
  USING (public.is_club_admin(club_id) OR public.staffs_player(player_id, ARRAY['TEAM_MANAGER']::public.staff_role[]))
  WITH CHECK (public.is_club_admin(club_id) OR public.staffs_player(player_id, ARRAY['TEAM_MANAGER']::public.staff_role[]));

CREATE POLICY subs_select ON public.subs_charges FOR SELECT TO authenticated
  USING (public.is_club_admin(club_id) OR public.staffs_player(player_id, ARRAY['TEAM_MANAGER']::public.staff_role[]) OR public.is_own_player(player_id));
CREATE POLICY subs_write ON public.subs_charges FOR ALL TO authenticated
  USING (public.is_club_admin(club_id) OR public.staffs_player(player_id, ARRAY['TEAM_MANAGER']::public.staff_role[]))
  WITH CHECK (public.is_club_admin(club_id) OR public.staffs_player(player_id, ARRAY['TEAM_MANAGER']::public.staff_role[]));

CREATE POLICY sponsors_select ON public.sponsors FOR SELECT TO authenticated
  USING (public.is_club_member(club_id));
CREATE POLICY sponsors_admin ON public.sponsors FOR ALL TO authenticated
  USING (public.is_club_admin(club_id)) WITH CHECK (public.is_club_admin(club_id));

CREATE POLICY branding_select ON public.club_branding FOR SELECT TO authenticated
  USING (public.is_club_member(club_id));
CREATE POLICY branding_admin ON public.club_branding FOR ALL TO authenticated
  USING (public.is_club_admin(club_id)) WITH CHECK (public.is_club_admin(club_id));

CREATE POLICY invites_select ON public.club_invites FOR SELECT TO authenticated
  USING (public.is_club_admin(club_id) OR public.is_platform_admin());
CREATE POLICY invites_admin ON public.club_invites FOR ALL TO authenticated
  USING (public.is_club_admin(club_id)) WITH CHECK (public.is_club_admin(club_id) AND accepted_at IS NULL);

-- Names of fellow club members for staff screens.
CREATE POLICY profiles_select_same_club ON public.profiles FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.club_members mine
    JOIN public.club_members theirs ON theirs.club_id = mine.club_id
    WHERE mine.user_id = auth.uid() AND theirs.user_id = profiles.id
      AND mine.role IN ('CLUB_ADMIN', 'COACH', 'TEAM_MANAGER', 'FITNESS')
  ));

-- ---------------------------------------------------------------------------
-- Storage: private buckets, files under <club_id>/...
-- ---------------------------------------------------------------------------
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES
  ('club-logos', 'club-logos', false, 1048576, ARRAY['image/png', 'image/jpeg', 'image/webp']),
  ('club-backdrops', 'club-backdrops', false, 3145728, ARRAY['image/png', 'image/jpeg', 'image/webp'])
ON CONFLICT (id) DO NOTHING;

CREATE OR REPLACE FUNCTION public.club_from_path(p_name text)
RETURNS uuid LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE WHEN split_part(p_name, '/', 1) ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
              THEN split_part(p_name, '/', 1)::uuid END;
$$;
GRANT EXECUTE ON FUNCTION public.club_from_path(text) TO authenticated;

CREATE POLICY club_assets_read ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id IN ('club-logos', 'club-backdrops') AND public.is_club_member(public.club_from_path(name)));
CREATE POLICY club_assets_insert ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id IN ('club-logos', 'club-backdrops') AND public.is_club_admin(public.club_from_path(name)));
CREATE POLICY club_assets_update ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id IN ('club-logos', 'club-backdrops') AND public.is_club_admin(public.club_from_path(name)))
  WITH CHECK (bucket_id IN ('club-logos', 'club-backdrops') AND public.is_club_admin(public.club_from_path(name)));
CREATE POLICY club_assets_delete ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id IN ('club-logos', 'club-backdrops') AND public.is_club_admin(public.club_from_path(name)));
