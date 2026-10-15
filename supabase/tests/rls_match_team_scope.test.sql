-- pgTAP: match records are scoped to the teams a staff member is assigned to.
BEGIN;
SELECT plan(20);

INSERT INTO auth.users (id, email) VALUES
  ('00000000-0000-4000-8000-0000000000a1', 'admin.a@example.test'),
  ('00000000-0000-4000-8000-0000000000a2', 'coach.a@example.test'),
  ('00000000-0000-4000-8000-0000000000a5', 'coach.a2@example.test'),
  ('00000000-0000-4000-8000-0000000000a6', 'fitness.a@example.test'),
  ('00000000-0000-4000-8000-0000000000a3', 'player.a@example.test'),
  ('00000000-0000-4000-8000-0000000000a4', 'guardian.a@example.test'),
  ('00000000-0000-4000-8000-0000000000b1', 'admin.b@example.test');
INSERT INTO public.clubs (id, name, player_code_prefix) VALUES
  ('10000000-0000-4000-8000-00000000000a', 'Club A', 'A'),
  ('10000000-0000-4000-8000-00000000000b', 'Club B', 'B');
INSERT INTO public.age_groups (id, club_id, name, display_order) VALUES
  ('20000000-0000-4000-8000-00000000000a', '10000000-0000-4000-8000-00000000000a', 'U12', 12),
  ('20000000-0000-4000-8000-00000000000b', '10000000-0000-4000-8000-00000000000b', 'U12', 12);
INSERT INTO public.teams (id, age_group_id, club_id, name) VALUES
  ('30000000-0000-4000-8000-0000000000a1', '20000000-0000-4000-8000-00000000000a', '10000000-0000-4000-8000-00000000000a', 'Team A'),
  ('30000000-0000-4000-8000-0000000000a2', '20000000-0000-4000-8000-00000000000a', '10000000-0000-4000-8000-00000000000a', 'Team B'),
  ('30000000-0000-4000-8000-0000000000b1', '20000000-0000-4000-8000-00000000000b', '10000000-0000-4000-8000-00000000000b', 'B Prem');
INSERT INTO public.club_members (club_id, user_id, role) VALUES
  ('10000000-0000-4000-8000-00000000000a', '00000000-0000-4000-8000-0000000000a1', 'CLUB_ADMIN'),
  ('10000000-0000-4000-8000-00000000000a', '00000000-0000-4000-8000-0000000000a2', 'COACH'),
  ('10000000-0000-4000-8000-00000000000a', '00000000-0000-4000-8000-0000000000a5', 'COACH'),
  ('10000000-0000-4000-8000-00000000000a', '00000000-0000-4000-8000-0000000000a6', 'FITNESS'),
  ('10000000-0000-4000-8000-00000000000a', '00000000-0000-4000-8000-0000000000a3', 'PLAYER'),
  ('10000000-0000-4000-8000-00000000000a', '00000000-0000-4000-8000-0000000000a4', 'GUARDIAN'),
  ('10000000-0000-4000-8000-00000000000b', '00000000-0000-4000-8000-0000000000b1', 'CLUB_ADMIN');
INSERT INTO public.team_staff (team_id, club_id, user_id, role) VALUES
  ('30000000-0000-4000-8000-0000000000a1', '10000000-0000-4000-8000-00000000000a', '00000000-0000-4000-8000-0000000000a2', 'COACH'),
  ('30000000-0000-4000-8000-0000000000a2', '10000000-0000-4000-8000-00000000000a', '00000000-0000-4000-8000-0000000000a5', 'COACH'),
  ('30000000-0000-4000-8000-0000000000a2', '10000000-0000-4000-8000-00000000000a', '00000000-0000-4000-8000-0000000000a6', 'FITNESS');
INSERT INTO public.players (id, club_id, team_id, user_id, first_name, last_name) VALUES
  ('40000000-0000-4000-8000-0000000000a1', '10000000-0000-4000-8000-00000000000a', '30000000-0000-4000-8000-0000000000a1', '00000000-0000-4000-8000-0000000000a3', 'Player', 'One'),
  ('40000000-0000-4000-8000-0000000000a2', '10000000-0000-4000-8000-00000000000a', '30000000-0000-4000-8000-0000000000a2', NULL, 'Player', 'Two'),
  ('40000000-0000-4000-8000-0000000000b1', '10000000-0000-4000-8000-00000000000b', '30000000-0000-4000-8000-0000000000b1', NULL, 'Player', 'Bee');
INSERT INTO public.guardians (club_id, player_id, user_id, full_name, email, phone) VALUES
  ('10000000-0000-4000-8000-00000000000a', '40000000-0000-4000-8000-0000000000a2', '00000000-0000-4000-8000-0000000000a4', 'Guardian Two', 'guardian.a@example.test', '+27 82 000 0000');

INSERT INTO public.club_matches (club_id, local_id, team_id, opponent, player_ids, updated_by, updated_at) VALUES
  ('10000000-0000-4000-8000-00000000000a', 'ma', '30000000-0000-4000-8000-0000000000a1', 'Team A game', '{40000000-0000-4000-8000-0000000000a1}', NULL, '2026-10-15 10:00+00'),
  ('10000000-0000-4000-8000-00000000000a', 'mb', '30000000-0000-4000-8000-0000000000a2', 'Team B game', '{40000000-0000-4000-8000-0000000000a2}', NULL, '2026-10-15 10:00+00'),
  ('10000000-0000-4000-8000-00000000000a', 'legacy', NULL, 'Old upload', '{}', '00000000-0000-4000-8000-0000000000a2', '2026-10-15 10:00+00'),
  ('10000000-0000-4000-8000-00000000000a', 'orphan', NULL, 'Someone else', '{}', NULL, '2026-10-15 10:00+00'),
  ('10000000-0000-4000-8000-00000000000b', 'mx', '30000000-0000-4000-8000-0000000000b1', 'B game', '{40000000-0000-4000-8000-0000000000b1}', NULL, '2026-10-15 10:00+00');

CREATE FUNCTION pg_temp.act_as(p_user uuid) RETURNS void LANGUAGE sql AS $$
  SELECT set_config('request.jwt.claims', json_build_object('sub', p_user, 'role', 'authenticated')::text, true);
  SET LOCAL ROLE authenticated;
$$;

-- Coach of Team A
SELECT pg_temp.act_as('00000000-0000-4000-8000-0000000000a2');
SELECT results_eq('SELECT local_id FROM public.club_matches ORDER BY local_id', $$VALUES ('legacy'::text), ('ma')$$,
  'a coach on team A sees team A matches and their own unassigned upload, not team B');
SELECT throws_ok($$INSERT INTO public.club_matches (club_id, local_id, team_id) VALUES
  ('10000000-0000-4000-8000-00000000000a', 'n1', '30000000-0000-4000-8000-0000000000a2')$$, '42501', NULL,
  'a coach cannot create a match for team B');
SELECT throws_ok($$INSERT INTO public.club_matches (club_id, local_id) VALUES
  ('10000000-0000-4000-8000-00000000000a', 'n2')$$, '42501', NULL, 'staff cannot create unassigned matches');
SELECT lives_ok($$INSERT INTO public.club_matches (club_id, local_id, team_id) VALUES
  ('10000000-0000-4000-8000-00000000000a', 'n3', '30000000-0000-4000-8000-0000000000a1')$$, 'a coach records a team A match');
UPDATE public.club_matches SET opponent = 'hijack' WHERE local_id = 'mb';
DELETE FROM public.club_matches WHERE local_id = 'mb';
SELECT throws_ok($$UPDATE public.club_matches SET team_id = '30000000-0000-4000-8000-0000000000a2' WHERE local_id = 'ma'$$,
  '42501', NULL, 'a coach cannot move a match to a team they do not staff');
SELECT lives_ok($$UPDATE public.club_matches SET team_id = '30000000-0000-4000-8000-0000000000a1' WHERE local_id = 'legacy'$$,
  'a coach assigns their own unassigned upload to their team');
SELECT is((SELECT count(*) FROM public.club_matches WHERE local_id = 'orphan')::int, 0,
  'a coach cannot see unassigned matches uploaded by someone else');
SELECT throws_ok($$INSERT INTO public.club_matches (club_id, local_id, team_id, player_ids) VALUES
  ('10000000-0000-4000-8000-00000000000a', 'n4', '30000000-0000-4000-8000-0000000000a1', '{40000000-0000-4000-8000-0000000000b1}')$$,
  '23503', NULL, 'a match cannot list another club''s player');
RESET ROLE;
SELECT is((SELECT opponent FROM public.club_matches WHERE local_id = 'mb'), 'Team B game', 'team B match unchanged by team A coach');
SELECT is((SELECT team_id FROM public.club_matches WHERE local_id = 'legacy'), '30000000-0000-4000-8000-0000000000a1'::uuid,
  'the legacy match is now on team A');

-- Fitness lead of Team B
SELECT pg_temp.act_as('00000000-0000-4000-8000-0000000000a6');
SELECT results_eq('SELECT local_id FROM public.club_matches', $$VALUES ('mb'::text)$$, 'fitness staff see only their team');
RESET ROLE;

-- Club admin
SELECT pg_temp.act_as('00000000-0000-4000-8000-0000000000a1');
SELECT is((SELECT count(*) FROM public.club_matches)::int, 5, 'the club admin sees every club A match');
SELECT is((SELECT count(*) FROM public.club_matches WHERE team_id IS NULL)::int, 1, 'including the unassigned one');
SELECT lives_ok($$UPDATE public.club_matches SET team_id = '30000000-0000-4000-8000-0000000000a2' WHERE local_id = 'orphan'$$,
  'the admin assigns an unassigned match');
SELECT is((SELECT count(*) FROM public.club_matches WHERE club_id = '10000000-0000-4000-8000-00000000000b')::int, 0,
  'the admin cannot see another club''s matches');
RESET ROLE;

-- Other club admin
SELECT pg_temp.act_as('00000000-0000-4000-8000-0000000000b1');
SELECT results_eq('SELECT local_id FROM public.club_matches', $$VALUES ('mx'::text)$$, 'club B sees only its own match');
SELECT throws_ok($$INSERT INTO public.club_matches (club_id, local_id, team_id) VALUES
  ('10000000-0000-4000-8000-00000000000a', 'evil', '30000000-0000-4000-8000-0000000000a1')$$, '42501', NULL,
  'club B cannot write club A matches');
RESET ROLE;

-- Player (Team A) and guardian (Team B player): read-only, own matches only
SELECT pg_temp.act_as('00000000-0000-4000-8000-0000000000a3');
SELECT results_eq('SELECT local_id FROM public.club_matches', $$VALUES ('ma'::text)$$, 'a player sees only matches they played in');
UPDATE public.club_matches SET opponent = 'edited by player';
RESET ROLE;
SELECT is((SELECT opponent FROM public.club_matches WHERE local_id = 'ma'), 'Team A game', 'players cannot edit matches');
SELECT pg_temp.act_as('00000000-0000-4000-8000-0000000000a4');
SELECT results_eq('SELECT local_id FROM public.club_matches', $$VALUES ('mb'::text)$$, 'a guardian sees only their child''s matches');
RESET ROLE;

SELECT * FROM finish();
ROLLBACK;
