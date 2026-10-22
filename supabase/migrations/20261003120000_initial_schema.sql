-- Football schema, row level security, signup profile trigger, and the Clubstride club seed.
-- Apply with `supabase db push` after `supabase link`, or paste this file into the Supabase SQL editor.
-- The app builds without running this file. Reference rows below do not depend on auth.users.

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TYPE user_role AS ENUM ('SUPER_ADMIN', 'HEAD_COACH', 'PLAYER');

CREATE TABLE clubs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL DEFAULT 'Clubstride',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE age_groups (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    club_id UUID REFERENCES clubs(id) ON DELETE CASCADE,
    name VARCHAR(50) NOT NULL,
    display_order INT NOT NULL
);

CREATE TABLE teams (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    age_group_id UUID REFERENCES age_groups(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    full_name VARCHAR(255) NOT NULL,
    role user_role NOT NULL DEFAULT 'PLAYER',
    team_id UUID REFERENCES teams(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE player_details (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID UNIQUE REFERENCES profiles(id) ON DELETE CASCADE,
    team_id UUID REFERENCES teams(id) ON DELETE CASCADE,
    squad_number INT,
    preferred_position VARCHAR(50),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE drills (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    title VARCHAR(255) NOT NULL,
    is_club_official BOOLEAN DEFAULT FALSE,
    created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
    target_age_group VARCHAR(50),
    objective_category VARCHAR(100),
    diagram_url TEXT,
    pitch_setup TEXT,
    instructions TEXT,
    coaching_points TEXT[],
    default_duration_seconds INT DEFAULT 300,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE player_evaluations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    player_id UUID REFERENCES player_details(id) ON DELETE CASCADE,
    evaluated_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
    evaluation_date DATE NOT NULL DEFAULT CURRENT_DATE,
    technical_score INT CHECK (technical_score BETWEEN 1 AND 10),
    tactical_score INT CHECK (tactical_score BETWEEN 1 AND 10),
    physical_score INT CHECK (physical_score BETWEEN 1 AND 10),
    mental_score INT CHECK (mental_score BETWEEN 1 AND 10),
    notes TEXT
);

CREATE TABLE match_sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    team_id UUID REFERENCES teams(id) ON DELETE CASCADE,
    opponent VARCHAR(255) NOT NULL,
    match_date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    status VARCHAR(50) DEFAULT 'SCHEDULED' CHECK (status IN ('SCHEDULED', 'LIVE', 'COMPLETED'))
);

CREATE TABLE match_player_minutes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    match_id UUID REFERENCES match_sessions(id) ON DELETE CASCADE,
    player_id UUID REFERENCES player_details(id) ON DELETE CASCADE,
    minutes_played NUMERIC(5,2) DEFAULT 0.0,
    is_on_pitch BOOLEAN DEFAULT FALSE
);

CREATE INDEX age_groups_club_id_idx ON age_groups (club_id);
CREATE INDEX teams_age_group_id_idx ON teams (age_group_id);
CREATE INDEX profiles_team_id_idx ON profiles (team_id);
CREATE INDEX profiles_role_idx ON profiles (role);
CREATE INDEX player_details_team_id_idx ON player_details (team_id);
CREATE INDEX drills_official_idx ON drills (is_club_official);
CREATE INDEX drills_created_by_idx ON drills (created_by);
CREATE INDEX player_evaluations_player_id_idx ON player_evaluations (player_id);
CREATE INDEX match_sessions_team_id_idx ON match_sessions (team_id);
CREATE INDEX match_player_minutes_match_id_idx ON match_player_minutes (match_id);
CREATE INDEX match_player_minutes_player_id_idx ON match_player_minutes (player_id);

-- Security-definer helpers so policies can read profiles without recursive RLS.
CREATE OR REPLACE FUNCTION public.is_super_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE id = auth.uid()
      AND role = 'SUPER_ADMIN'
  );
$$;

CREATE OR REPLACE FUNCTION public.current_profile_role()
RETURNS user_role
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role FROM public.profiles WHERE id = auth.uid();
$$;

CREATE OR REPLACE FUNCTION public.current_team_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT team_id FROM public.profiles WHERE id = auth.uid();
$$;

REVOKE ALL ON FUNCTION public.is_super_admin() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.current_profile_role() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.current_team_id() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_super_admin() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.current_profile_role() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.current_team_id() TO authenticated, service_role;

-- New auth users become players. Promote the first admin with the commented statement at the bottom.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, role)
  VALUES (
    NEW.id,
    COALESCE(
      NULLIF(NEW.raw_user_meta_data->>'full_name', ''),
      NULLIF(split_part(COALESCE(NEW.email, ''), '@', 1), ''),
      'Player'
    ),
    'PLAYER'
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.handle_new_user() TO supabase_auth_admin, service_role;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- Players and coaches cannot change role or team assignment on their own.
CREATE OR REPLACE FUNCTION public.protect_profile_privileges()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_super_admin() THEN
    NEW.role := OLD.role;
    NEW.team_id := OLD.team_id;
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.protect_profile_privileges() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.protect_profile_privileges() TO authenticated, service_role;

CREATE TRIGGER profiles_protect_privileges
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.protect_profile_privileges();

ALTER TABLE clubs ENABLE ROW LEVEL SECURITY;
ALTER TABLE age_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE player_details ENABLE ROW LEVEL SECURITY;
ALTER TABLE drills ENABLE ROW LEVEL SECURITY;
ALTER TABLE player_evaluations ENABLE ROW LEVEL SECURITY;
ALTER TABLE match_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE match_player_minutes ENABLE ROW LEVEL SECURITY;

GRANT USAGE ON SCHEMA public TO authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON clubs TO authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON age_groups TO authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON teams TO authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON profiles TO authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON player_details TO authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON drills TO authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON player_evaluations TO authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON match_sessions TO authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON match_player_minutes TO authenticated, service_role;

-- Clubs, age groups, and teams are club structure. Signed-in members can read them.
-- Only a super admin can change them.
CREATE POLICY clubs_select_member ON clubs
  FOR SELECT TO authenticated
  USING (true);

CREATE POLICY clubs_write_super_admin ON clubs
  FOR ALL TO authenticated
  USING (public.is_super_admin())
  WITH CHECK (public.is_super_admin());

CREATE POLICY age_groups_select_member ON age_groups
  FOR SELECT TO authenticated
  USING (true);

CREATE POLICY age_groups_write_super_admin ON age_groups
  FOR ALL TO authenticated
  USING (public.is_super_admin())
  WITH CHECK (public.is_super_admin());

CREATE POLICY teams_select_member ON teams
  FOR SELECT TO authenticated
  USING (true);

CREATE POLICY teams_write_super_admin ON teams
  FOR ALL TO authenticated
  USING (public.is_super_admin())
  WITH CHECK (public.is_super_admin());

-- Profiles: super admin sees and edits everyone. A coach reads their own team.
-- A player reads only their own row. Writes to role and team_id are blocked above
-- unless the caller is a super admin.
CREATE POLICY profiles_select ON profiles
  FOR SELECT TO authenticated
  USING (
    id = auth.uid()
    OR public.is_super_admin()
    OR (
      public.current_profile_role() = 'HEAD_COACH'
      AND public.current_team_id() IS NOT NULL
      AND team_id = public.current_team_id()
    )
  );

CREATE POLICY profiles_update_self ON profiles
  FOR UPDATE TO authenticated
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

CREATE POLICY profiles_update_super_admin ON profiles
  FOR UPDATE TO authenticated
  USING (public.is_super_admin())
  WITH CHECK (public.is_super_admin());

CREATE POLICY profiles_delete_super_admin ON profiles
  FOR DELETE TO authenticated
  USING (public.is_super_admin());

-- Roster rows follow the team. Players can read their own row and cannot write it.
CREATE POLICY player_details_super_admin ON player_details
  FOR ALL TO authenticated
  USING (public.is_super_admin())
  WITH CHECK (public.is_super_admin());

CREATE POLICY player_details_coach ON player_details
  FOR ALL TO authenticated
  USING (
    public.current_profile_role() = 'HEAD_COACH'
    AND public.current_team_id() IS NOT NULL
    AND team_id = public.current_team_id()
  )
  WITH CHECK (
    public.current_profile_role() = 'HEAD_COACH'
    AND public.current_team_id() IS NOT NULL
    AND team_id = public.current_team_id()
  );

CREATE POLICY player_details_player_select ON player_details
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

-- Official club drills are readable by coaches. Coaches may keep their own unofficial drills.
-- Only a super admin can publish or edit official drills.
CREATE POLICY drills_super_admin ON drills
  FOR ALL TO authenticated
  USING (public.is_super_admin())
  WITH CHECK (public.is_super_admin());

CREATE POLICY drills_coach_select ON drills
  FOR SELECT TO authenticated
  USING (
    public.current_profile_role() = 'HEAD_COACH'
    AND (
      is_club_official = true
      OR created_by = auth.uid()
    )
  );

CREATE POLICY drills_coach_insert ON drills
  FOR INSERT TO authenticated
  WITH CHECK (
    public.current_profile_role() = 'HEAD_COACH'
    AND created_by = auth.uid()
    AND COALESCE(is_club_official, false) = false
  );

CREATE POLICY drills_coach_update ON drills
  FOR UPDATE TO authenticated
  USING (
    public.current_profile_role() = 'HEAD_COACH'
    AND created_by = auth.uid()
    AND COALESCE(is_club_official, false) = false
  )
  WITH CHECK (
    public.current_profile_role() = 'HEAD_COACH'
    AND created_by = auth.uid()
    AND COALESCE(is_club_official, false) = false
  );

CREATE POLICY drills_coach_delete ON drills
  FOR DELETE TO authenticated
  USING (
    public.current_profile_role() = 'HEAD_COACH'
    AND created_by = auth.uid()
    AND COALESCE(is_club_official, false) = false
  );

-- Evaluations belong to a player on a team. Coaches of that team write them.
-- The player can read their own scores and notes, and cannot write anyone else's.
CREATE POLICY evaluations_super_admin ON player_evaluations
  FOR ALL TO authenticated
  USING (public.is_super_admin())
  WITH CHECK (public.is_super_admin());

CREATE POLICY evaluations_coach_write ON player_evaluations
  FOR ALL TO authenticated
  USING (
    public.current_profile_role() = 'HEAD_COACH'
    AND EXISTS (
      SELECT 1
      FROM public.player_details AS details
      WHERE details.id = player_evaluations.player_id
        AND details.team_id = public.current_team_id()
    )
  )
  WITH CHECK (
    public.current_profile_role() = 'HEAD_COACH'
    AND EXISTS (
      SELECT 1
      FROM public.player_details AS details
      WHERE details.id = player_evaluations.player_id
        AND details.team_id = public.current_team_id()
    )
  );

CREATE POLICY evaluations_player_select ON player_evaluations
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.player_details AS details
      WHERE details.id = player_evaluations.player_id
        AND details.user_id = auth.uid()
    )
  );

CREATE POLICY match_sessions_super_admin ON match_sessions
  FOR ALL TO authenticated
  USING (public.is_super_admin())
  WITH CHECK (public.is_super_admin());

CREATE POLICY match_sessions_coach ON match_sessions
  FOR ALL TO authenticated
  USING (
    public.current_profile_role() = 'HEAD_COACH'
    AND public.current_team_id() IS NOT NULL
    AND team_id = public.current_team_id()
  )
  WITH CHECK (
    public.current_profile_role() = 'HEAD_COACH'
    AND public.current_team_id() IS NOT NULL
    AND team_id = public.current_team_id()
  );

CREATE POLICY match_sessions_player_select ON match_sessions
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.match_player_minutes AS minutes
      JOIN public.player_details AS details ON details.id = minutes.player_id
      WHERE minutes.match_id = match_sessions.id
        AND details.user_id = auth.uid()
    )
  );

CREATE POLICY match_minutes_super_admin ON match_player_minutes
  FOR ALL TO authenticated
  USING (public.is_super_admin())
  WITH CHECK (public.is_super_admin());

CREATE POLICY match_minutes_coach ON match_player_minutes
  FOR ALL TO authenticated
  USING (
    public.current_profile_role() = 'HEAD_COACH'
    AND EXISTS (
      SELECT 1
      FROM public.match_sessions AS sessions
      WHERE sessions.id = match_player_minutes.match_id
        AND sessions.team_id = public.current_team_id()
    )
    AND EXISTS (
      SELECT 1
      FROM public.player_details AS details
      WHERE details.id = match_player_minutes.player_id
        AND details.team_id = public.current_team_id()
    )
  )
  WITH CHECK (
    public.current_profile_role() = 'HEAD_COACH'
    AND EXISTS (
      SELECT 1
      FROM public.match_sessions AS sessions
      WHERE sessions.id = match_player_minutes.match_id
        AND sessions.team_id = public.current_team_id()
    )
    AND EXISTS (
      SELECT 1
      FROM public.player_details AS details
      WHERE details.id = match_player_minutes.player_id
        AND details.team_id = public.current_team_id()
    )
  );

CREATE POLICY match_minutes_player_select ON match_player_minutes
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.player_details AS details
      WHERE details.id = match_player_minutes.player_id
        AND details.user_id = auth.uid()
    )
  );

-- Reference data for Clubstride. No auth.users ids.
INSERT INTO clubs (id, name)
VALUES ('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'Clubstride')
ON CONFLICT (id) DO NOTHING;

INSERT INTO age_groups (id, club_id, name, display_order)
VALUES
  ('b1111111-1111-4111-8111-111111111111', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'Under 11', 1),
  ('b2222222-2222-4222-8222-222222222222', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'Under 13', 2),
  ('b3333333-3333-4333-8333-333333333333', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'Under 15', 3),
  ('b4444444-4444-4444-8444-444444444444', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'Under 17', 4)
ON CONFLICT (id) DO NOTHING;

INSERT INTO teams (id, age_group_id, name)
VALUES
  ('c1111111-1111-4111-8111-111111111111', 'b1111111-1111-4111-8111-111111111111', 'U11 Academy'),
  ('c2222222-2222-4222-8222-222222222222', 'b2222222-2222-4222-8222-222222222222', 'U13 Premier'),
  ('c3333333-3333-4333-8333-333333333333', 'b2222222-2222-4222-8222-222222222222', 'U13 Academy'),
  ('c4444444-4444-4444-8444-444444444444', 'b3333333-3333-4333-8333-333333333333', 'U15 Premier'),
  ('c5555555-5555-4555-8555-555555555555', 'b4444444-4444-4444-8444-444444444444', 'U17 Development')
ON CONFLICT (id) DO NOTHING;

INSERT INTO drills (
  id,
  title,
  is_club_official,
  created_by,
  target_age_group,
  objective_category,
  pitch_setup,
  instructions,
  coaching_points,
  default_duration_seconds
)
VALUES
  (
    'd1111111-1111-4111-8111-111111111111',
    'First-touch square',
    true,
    NULL,
    'Under 13',
    'Technical',
    '10m square, one ball, four cones.',
    'Play two-touch around the square. The receiver checks off their cone, opens their body, and passes to the next corner.',
    ARRAY['First touch out of pressure', 'Head up before the pass', 'Weight of pass into feet'],
    300
  ),
  (
    'd2222222-2222-4222-8222-222222222222',
    '1v1 to goal',
    true,
    NULL,
    'Under 13',
    'Technical',
    'Channel from the halfway line to one goal. Balls at the start cone.',
    'Attacker receives facing forward and tries to score. Defender delays, then tackles when the touch is heavy.',
    ARRAY['Attack the front foot', 'Finish early', 'Defender stays side-on'],
    300
  ),
  (
    'd3333333-3333-4333-8333-333333333333',
    '4v2 rondo',
    true,
    NULL,
    'Under 15',
    'Tactical',
    '12m square. Four outside, two inside.',
    'Outside players keep the ball. Two touches max. A defender who wins it swaps with the passer.',
    ARRAY['Body shape to play forward', 'Split the two defenders', 'Immediate press after loss'],
    360
  ),
  (
    'd4444444-4444-4444-8444-444444444444',
    'Pressing triggers',
    true,
    NULL,
    'Under 17',
    'Tactical',
    'Half pitch with a goalkeeper and a back four against six.',
    'The press starts on a backwards pass or a poor first touch. Jump together, then recover the shape if the ball goes wide.',
    ARRAY['One trigger, everyone jumps', 'Cover the pass inside', 'Recover in a line'],
    420
  ),
  (
    'd5555555-5555-4555-8555-555555555555',
    'Repeated sprint lanes',
    true,
    NULL,
    'Under 17',
    'Physical',
    'Four 30m lanes. One player per lane.',
    'Sprint the lane, walk back, and go again on the whistle. Eight reps.',
    ARRAY['Full effort each rep', 'Walk the recovery', 'Stop if form breaks down'],
    240
  ),
  (
    'd6666666-6666-4666-8666-666666666666',
    'Corner delivery',
    true,
    NULL,
    'Under 15',
    'Set Piece',
    'One corner arc, six attackers, four defenders, goalkeeper.',
    'Call the delivery, then attack near-post, penalty spot, and back-post zones. Restart quickly.',
    ARRAY['Delivery to a zone, not a player', 'Attack the ball', 'Second-ball shape'],
    300
  )
ON CONFLICT (id) DO NOTHING;

-- First super admin, after someone has signed up.
-- The signup trigger inserts profiles with role PLAYER. Run this once in the SQL editor,
-- then leave it commented. Replace the email with the account that should run the club.
--
-- UPDATE public.profiles
-- SET role = 'SUPER_ADMIN'
-- WHERE id = (
--   SELECT id FROM auth.users WHERE email = 'you@club.example'
-- );
--
-- After that, Club admin → People can set other accounts to HEAD_COACH or PLAYER
-- and attach a team. Choosing PLAYER also creates the player_details roster row.
