-- pgTAP: club isolation and player self-access.
-- Run with `npx supabase test db` or scripts/test-db.sh.
BEGIN;
SELECT plan(41);

-- Fixture (as the migration owner, so RLS does not apply yet).
INSERT INTO auth.users (id, email) VALUES
  ('00000000-0000-4000-8000-0000000000a1', 'admin.a@example.test'),
  ('00000000-0000-4000-8000-0000000000a2', 'coach.a@example.test'),
  ('00000000-0000-4000-8000-0000000000a3', 'player.a@example.test'),
  ('00000000-0000-4000-8000-0000000000a4', 'guardian.a@example.test'),
  ('00000000-0000-4000-8000-0000000000b1', 'admin.b@example.test'),
  ('00000000-0000-4000-8000-0000000000f1', 'platform@example.test');

INSERT INTO public.platform_admins (user_id) VALUES ('00000000-0000-4000-8000-0000000000f1');

INSERT INTO public.clubs (id, name, player_code_prefix) VALUES
  ('10000000-0000-4000-8000-00000000000a', 'Club A', 'A'),
  ('10000000-0000-4000-8000-00000000000b', 'Club B', 'B');
INSERT INTO public.age_groups (id, club_id, name, display_order) VALUES
  ('20000000-0000-4000-8000-00000000000a', '10000000-0000-4000-8000-00000000000a', 'U12', 12),
  ('20000000-0000-4000-8000-00000000000b', '10000000-0000-4000-8000-00000000000b', 'U12', 12);
INSERT INTO public.teams (id, age_group_id, club_id, name) VALUES
  ('30000000-0000-4000-8000-0000000000a1', '20000000-0000-4000-8000-00000000000a', '10000000-0000-4000-8000-00000000000a', 'A Prem'),
  ('30000000-0000-4000-8000-0000000000a2', '20000000-0000-4000-8000-00000000000a', '10000000-0000-4000-8000-00000000000a', 'A Div 1'),
  ('30000000-0000-4000-8000-0000000000b1', '20000000-0000-4000-8000-00000000000b', '10000000-0000-4000-8000-00000000000b', 'B Prem');
INSERT INTO public.club_members (club_id, user_id, role) VALUES
  ('10000000-0000-4000-8000-00000000000a', '00000000-0000-4000-8000-0000000000a1', 'CLUB_ADMIN'),
  ('10000000-0000-4000-8000-00000000000a', '00000000-0000-4000-8000-0000000000a2', 'COACH'),
  ('10000000-0000-4000-8000-00000000000a', '00000000-0000-4000-8000-0000000000a3', 'PLAYER'),
  ('10000000-0000-4000-8000-00000000000a', '00000000-0000-4000-8000-0000000000a4', 'GUARDIAN'),
  ('10000000-0000-4000-8000-00000000000b', '00000000-0000-4000-8000-0000000000b1', 'CLUB_ADMIN');
-- One coach, two teams.
INSERT INTO public.team_staff (team_id, club_id, user_id, role) VALUES
  ('30000000-0000-4000-8000-0000000000a1', '10000000-0000-4000-8000-00000000000a', '00000000-0000-4000-8000-0000000000a2', 'COACH');
INSERT INTO public.players (id, club_id, team_id, user_id, first_name, last_name) VALUES
  ('40000000-0000-4000-8000-0000000000a1', '10000000-0000-4000-8000-00000000000a', '30000000-0000-4000-8000-0000000000a1', '00000000-0000-4000-8000-0000000000a3', 'Player', 'One'),
  ('40000000-0000-4000-8000-0000000000a2', '10000000-0000-4000-8000-00000000000a', '30000000-0000-4000-8000-0000000000a1', NULL, 'Player', 'Two'),
  ('40000000-0000-4000-8000-0000000000a3', '10000000-0000-4000-8000-00000000000a', '30000000-0000-4000-8000-0000000000a2', NULL, 'Player', 'Three'),
  ('40000000-0000-4000-8000-0000000000b1', '10000000-0000-4000-8000-00000000000b', '30000000-0000-4000-8000-0000000000b1', NULL, 'Player', 'Bee');
INSERT INTO public.guardians (club_id, player_id, user_id, full_name, email, phone) VALUES
  ('10000000-0000-4000-8000-00000000000a', '40000000-0000-4000-8000-0000000000a2', '00000000-0000-4000-8000-0000000000a4', 'Guardian Two', 'guardian.a@example.test', '+27 82 000 0000'),
  ('10000000-0000-4000-8000-00000000000b', '40000000-0000-4000-8000-0000000000b1', NULL, 'Guardian Bee', 'g.b@example.test', '+27 82 111 1111');
INSERT INTO public.player_ratings (club_id, player_id, technical, tactical, physical, mental) VALUES
  ('10000000-0000-4000-8000-00000000000a', '40000000-0000-4000-8000-0000000000a1', 7, 7, 7, 7),
  ('10000000-0000-4000-8000-00000000000a', '40000000-0000-4000-8000-0000000000a2', 6, 6, 6, 6),
  ('10000000-0000-4000-8000-00000000000b', '40000000-0000-4000-8000-0000000000b1', 5, 5, 5, 5);
INSERT INTO public.subs_charges (club_id, player_id, period, amount_cents) VALUES
  ('10000000-0000-4000-8000-00000000000a', '40000000-0000-4000-8000-0000000000a1', '2026-10', 25000),
  ('10000000-0000-4000-8000-00000000000a', '40000000-0000-4000-8000-0000000000a2', '2026-10', 25000),
  ('10000000-0000-4000-8000-00000000000b', '40000000-0000-4000-8000-0000000000b1', '2026-10', 30000);

SELECT is((SELECT player_code FROM public.players WHERE id = '40000000-0000-4000-8000-0000000000b1'), 'B00001',
  'player ids are numbered per club');
SELECT throws_ok($$INSERT INTO public.guardians (club_id, player_id, full_name, email, phone)
  VALUES ('10000000-0000-4000-8000-00000000000a', '40000000-0000-4000-8000-0000000000a1', 'No Mail', NULL, '0820000000')$$,
  '23502', NULL, 'guardian email is mandatory');
SELECT throws_ok($$INSERT INTO public.players (club_id, team_id, first_name, last_name)
  VALUES ('10000000-0000-4000-8000-00000000000a', '30000000-0000-4000-8000-0000000000b1', 'Cross', 'Club')$$,
  '23503', NULL, 'a player cannot join another club''s team');

CREATE FUNCTION pg_temp.act_as(p_user uuid, p_email text) RETURNS void LANGUAGE sql AS $$
  SELECT set_config('request.jwt.claims',
    json_build_object('sub', p_user, 'email', p_email, 'role', 'authenticated')::text, true);
  SET LOCAL ROLE authenticated;
$$;

-- ---- Club B admin cannot see Club A --------------------------------------
SELECT pg_temp.act_as('00000000-0000-4000-8000-0000000000b1', 'admin.b@example.test');
SELECT is((SELECT count(*) FROM public.clubs)::int, 1, 'club B admin sees only club B');
SELECT is((SELECT count(*) FROM public.players WHERE club_id = '10000000-0000-4000-8000-00000000000a')::int, 0,
  'club B admin cannot read club A players');
SELECT is((SELECT count(*) FROM public.guardians WHERE club_id = '10000000-0000-4000-8000-00000000000a')::int, 0,
  'club B admin cannot read club A guardians');
SELECT is((SELECT count(*) FROM public.player_ratings WHERE club_id = '10000000-0000-4000-8000-00000000000a')::int, 0,
  'club B admin cannot read club A ratings');
SELECT is((SELECT count(*) FROM public.subs_charges WHERE club_id = '10000000-0000-4000-8000-00000000000a')::int, 0,
  'club B admin cannot read club A finance');
SELECT is((SELECT count(*) FROM public.teams WHERE club_id = '10000000-0000-4000-8000-00000000000a')::int, 0,
  'club B admin cannot read club A teams');
SELECT is((SELECT count(*) FROM public.club_members WHERE club_id = '10000000-0000-4000-8000-00000000000a')::int, 0,
  'club B admin cannot read club A members');
SELECT throws_ok($$INSERT INTO public.players (club_id, team_id, first_name, last_name)
  VALUES ('10000000-0000-4000-8000-00000000000a', NULL, 'Sneaky', 'Insert')$$,
  '42501', NULL, 'club B admin cannot add a player to club A');
UPDATE public.players SET first_name = 'Hacked' WHERE id = '40000000-0000-4000-8000-0000000000a1';
SELECT is((SELECT count(*) FROM public.players)::int, 1, 'club B admin still sees only their own player');
SELECT is(public.is_own_player('40000000-0000-4000-8000-0000000000a1'), false, 'helper does not leak ownership');
RESET ROLE;
SELECT is((SELECT first_name FROM public.players WHERE id = '40000000-0000-4000-8000-0000000000a1'), 'Player',
  'cross-club update changed nothing');

-- ---- Player sees only their own record ------------------------------------
SELECT pg_temp.act_as('00000000-0000-4000-8000-0000000000a3', 'player.a@example.test');
SELECT results_eq('SELECT id FROM public.players', $$VALUES ('40000000-0000-4000-8000-0000000000a1'::uuid)$$,
  'a player reads only their own player record');
SELECT is((SELECT count(*) FROM public.player_ratings)::int, 1, 'a player reads only their own ratings');
SELECT is((SELECT count(*) FROM public.subs_charges)::int, 1, 'a player reads only their own subs');
SELECT is((SELECT count(*) FROM public.guardians)::int, 0, 'a player cannot read other families');
SELECT is((SELECT count(*) FROM public.club_members)::int, 1, 'a player sees only their own membership');
SELECT throws_ok($$INSERT INTO public.player_ratings (club_id, player_id, technical, tactical, physical, mental)
  VALUES ('10000000-0000-4000-8000-00000000000a', '40000000-0000-4000-8000-0000000000a1', 10, 10, 10, 10)$$,
  '42501', NULL, 'a player cannot rate themselves');
RESET ROLE;

-- ---- Guardian sees only their child ---------------------------------------
SELECT pg_temp.act_as('00000000-0000-4000-8000-0000000000a4', 'guardian.a@example.test');
SELECT results_eq('SELECT id FROM public.players', $$VALUES ('40000000-0000-4000-8000-0000000000a2'::uuid)$$,
  'a guardian reads only their child');
RESET ROLE;

-- ---- Coach: own teams only, full CRUD on ratings --------------------------
SELECT pg_temp.act_as('00000000-0000-4000-8000-0000000000a2', 'coach.a@example.test');
SELECT is((SELECT count(*) FROM public.players)::int, 2, 'coach reads only players in their team');
SELECT lives_ok($$INSERT INTO public.player_ratings (club_id, player_id, technical, tactical, physical, mental)
  VALUES ('10000000-0000-4000-8000-00000000000a', '40000000-0000-4000-8000-0000000000a2', 8, 8, 8, 8)$$,
  'coach creates a rating for their player');
SELECT throws_ok($$INSERT INTO public.player_ratings (club_id, player_id, technical, tactical, physical, mental)
  VALUES ('10000000-0000-4000-8000-00000000000a', '40000000-0000-4000-8000-0000000000a3', 8, 8, 8, 8)$$,
  '42501', NULL, 'coach cannot rate a player outside their teams');
UPDATE public.player_ratings SET notes = 'Good week' WHERE player_id = '40000000-0000-4000-8000-0000000000a2';
SELECT is((SELECT count(*) FROM public.player_ratings WHERE notes = 'Good week')::int, 2, 'coach updates ratings');
DELETE FROM public.player_ratings WHERE player_id = '40000000-0000-4000-8000-0000000000a2' AND technical = 8;
SELECT is((SELECT count(*) FROM public.player_ratings WHERE player_id = '40000000-0000-4000-8000-0000000000a2')::int, 1,
  'coach deletes a rating');
SELECT is((SELECT count(*) FROM public.subs_charges)::int, 0, 'coach cannot read finance');
UPDATE public.players SET user_id = '00000000-0000-4000-8000-0000000000a2'
  WHERE id = '40000000-0000-4000-8000-0000000000a2';
RESET ROLE;
SELECT is((SELECT user_id FROM public.players WHERE id = '40000000-0000-4000-8000-0000000000a2'), NULL,
  'coach cannot link a player row to an account');

-- ---- Club admin: cannot self-link either ----------------------------------
SELECT pg_temp.act_as('00000000-0000-4000-8000-0000000000a1', 'admin.a@example.test');
SELECT throws_ok($$UPDATE public.players SET user_id = '00000000-0000-4000-8000-0000000000a1'
  WHERE id = '40000000-0000-4000-8000-0000000000a3'$$, 'P0001', NULL,
  'account links are by invitation only');
SELECT is((SELECT count(*) FROM public.players)::int, 3, 'club A admin sees all club A players');
SELECT throws_ok($$SELECT public.register_player('10000000-0000-4000-8000-00000000000a', NULL, 'New', 'Kid', NULL, NULL, NULL,
  'Parent', 'Mother', 'parent@example.test', '+27 82 222 2222', NULL, false)$$, 'P0001', 'Guardian consent is required',
  'registration needs guardian consent');
SELECT isnt(public.register_player('10000000-0000-4000-8000-00000000000a', NULL, 'New', 'Kid', NULL, NULL, NULL,
  'Parent', 'Mother', 'parent@example.test', '+27 82 222 2222', NULL, true), NULL, 'club admin registers a player with a guardian');
SELECT throws_ok($$SELECT public.register_player('10000000-0000-4000-8000-00000000000b', NULL, 'Other', 'Club', NULL, NULL, NULL,
  'Parent', 'Mother', 'parent@example.test', '+27 82 222 2222', NULL, true)$$, '42501', NULL,
  'club A admin cannot register into club B');
RESET ROLE;

-- ---- Platform admin creates clubs but cannot read player data -------------
SELECT pg_temp.act_as('00000000-0000-4000-8000-0000000000f1', 'platform@example.test');
SELECT isnt(public.create_club('Club C', 'admin.c@example.test', 'C'), NULL, 'platform admin creates a club');
SELECT is((SELECT count(*) FROM public.players)::int, 0, 'platform admin cannot read player data');
RESET ROLE;

-- ---- Invitations link accounts --------------------------------------------
INSERT INTO auth.users (id, email) VALUES ('00000000-0000-4000-8000-0000000000a5', 'new.coach@example.test');
INSERT INTO public.club_invites (club_id, email, role, team_id) VALUES
  ('10000000-0000-4000-8000-00000000000a', 'New.Coach@example.test', 'COACH', '30000000-0000-4000-8000-0000000000a2');
SELECT pg_temp.act_as('00000000-0000-4000-8000-0000000000a5', 'new.coach@example.test');
SELECT is(public.claim_my_invites(), 1, 'an invite is claimed by the matching email');
SELECT results_eq('SELECT id FROM public.players', $$VALUES ('40000000-0000-4000-8000-0000000000a3'::uuid)$$,
  'the new coach sees only the invited team');
RESET ROLE;

-- ---- Storage is club-scoped ------------------------------------------------
INSERT INTO storage.objects (bucket_id, name) VALUES
  ('club-logos', '10000000-0000-4000-8000-00000000000a/logo.png'),
  ('club-backdrops', '10000000-0000-4000-8000-00000000000b/backdrop.png');
SELECT pg_temp.act_as('00000000-0000-4000-8000-0000000000b1', 'admin.b@example.test');
SELECT is((SELECT count(*) FROM storage.objects)::int, 1, 'club B reads only its own files');
SELECT throws_ok($$INSERT INTO storage.objects (bucket_id, name)
  VALUES ('club-logos', '10000000-0000-4000-8000-00000000000a/evil.png')$$,
  '42501', NULL, 'club B cannot upload into club A''s folder');
RESET ROLE;

-- ---- Legacy fixes -----------------------------------------------------------
-- SQL editor: no end-user JWT.
SELECT set_config('request.jwt.claims', '', true);
UPDATE public.profiles SET role = 'SUPER_ADMIN' WHERE id = '00000000-0000-4000-8000-0000000000a1';
SELECT is((SELECT role::text FROM public.profiles WHERE id = '00000000-0000-4000-8000-0000000000a1'), 'SUPER_ADMIN',
  'the documented first-admin promotion from the SQL editor now works');
SELECT pg_temp.act_as('00000000-0000-4000-8000-0000000000a3', 'player.a@example.test');
UPDATE public.profiles SET role = 'SUPER_ADMIN' WHERE id = '00000000-0000-4000-8000-0000000000a3';
RESET ROLE;
SELECT is((SELECT role::text FROM public.profiles WHERE id = '00000000-0000-4000-8000-0000000000a3'), 'PLAYER',
  'a signed-in user still cannot promote themselves');

SELECT * FROM finish();
ROLLBACK;
