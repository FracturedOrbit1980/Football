-- Match records are scoped to real club teams.
--
-- * Team staff (coach, manager, fitness) read and write matches of the teams they are assigned to.
-- * Club admins read and write every match in their club, including UNASSIGNED ones (team_id NULL).
-- * Staff can no longer create unassigned matches. Rows synced before this migration with no team stay
--   visible to the admin (flagged as unassigned) and to the staff member who uploaded them, who may
--   only fix them by setting one of their own teams.
-- * Players and guardians read (never write) matches their player took part in (player_ids).
-- * Other clubs are always denied (team FK is composite with club_id; every check is club-scoped).
-- Match events, minutes and substitutions live in club_matches.detail, so these rules cover them too.

ALTER TABLE public.club_matches ADD COLUMN IF NOT EXISTS player_ids uuid[] NOT NULL DEFAULT '{}';
CREATE INDEX IF NOT EXISTS club_matches_team_idx ON public.club_matches (team_id);
CREATE INDEX IF NOT EXISTS club_matches_player_ids_idx ON public.club_matches USING gin (player_ids);

-- player_ids may only name players of the same club.
CREATE OR REPLACE FUNCTION public.check_match_players()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM unnest(NEW.player_ids) AS pid
    WHERE NOT EXISTS (SELECT 1 FROM public.players p WHERE p.id = pid AND p.club_id = NEW.club_id)
  ) THEN
    RAISE EXCEPTION 'match players must belong to the club' USING ERRCODE = '23503';
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS club_matches_players ON public.club_matches;
CREATE TRIGGER club_matches_players BEFORE INSERT OR UPDATE OF player_ids, club_id ON public.club_matches
  FOR EACH ROW EXECUTE FUNCTION public.check_match_players();

CREATE OR REPLACE FUNCTION public.plays_in_match(p_players uuid[])
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.players WHERE id = ANY (p_players) AND user_id = auth.uid())
      OR EXISTS (SELECT 1 FROM public.guardians WHERE player_id = ANY (p_players) AND user_id = auth.uid());
$$;
REVOKE ALL ON FUNCTION public.plays_in_match(uuid[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.plays_in_match(uuid[]) TO authenticated;

DROP POLICY IF EXISTS club_matches_staff ON public.club_matches;

CREATE POLICY club_matches_select ON public.club_matches FOR SELECT TO authenticated
  USING (public.is_club_admin(club_id)
         OR (team_id IS NOT NULL AND public.is_team_staff(team_id))
         OR (team_id IS NULL AND updated_by = auth.uid() AND public.is_club_staff(club_id))
         OR (deleted_at IS NULL AND cardinality(player_ids) > 0 AND public.plays_in_match(player_ids)));

CREATE POLICY club_matches_insert ON public.club_matches FOR INSERT TO authenticated
  WITH CHECK (public.is_club_admin(club_id)
              OR (team_id IS NOT NULL AND public.is_team_staff(team_id)));

CREATE POLICY club_matches_update ON public.club_matches FOR UPDATE TO authenticated
  USING (public.is_club_admin(club_id)
         OR (team_id IS NOT NULL AND public.is_team_staff(team_id))
         OR (team_id IS NULL AND updated_by = auth.uid() AND public.is_club_staff(club_id)))
  WITH CHECK (public.is_club_admin(club_id)
              OR (team_id IS NOT NULL AND public.is_team_staff(team_id)));

CREATE POLICY club_matches_delete ON public.club_matches FOR DELETE TO authenticated
  USING (public.is_club_admin(club_id)
         OR (team_id IS NOT NULL AND public.is_team_staff(team_id)));
