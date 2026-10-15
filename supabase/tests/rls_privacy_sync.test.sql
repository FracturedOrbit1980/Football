-- pgTAP: privacy records and offline-sync tables are club-scoped.
BEGIN;
SELECT plan(24);

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


CREATE FUNCTION pg_temp.act_as(p_user uuid, p_email text) RETURNS void LANGUAGE sql AS $$
  SELECT set_config('request.jwt.claims',
    json_build_object('sub', p_user, 'email', p_email, 'role', 'authenticated')::text, true);
  SET LOCAL ROLE authenticated;
$$;

INSERT INTO public.club_privacy (club_id, info_officer_name, info_officer_email) VALUES
  ('10000000-0000-4000-8000-00000000000a', 'Officer A', 'privacy@a.example.test');
INSERT INTO public.club_drills (club_id, local_id, title, drill, updated_at) VALUES
  ('10000000-0000-4000-8000-00000000000a', 'dr-1', 'A rondo', '{"id":"dr-1"}', '2026-10-15 10:00+00'),
  ('10000000-0000-4000-8000-00000000000b', 'dr-1', 'B rondo', '{"id":"dr-1"}', '2026-10-15 10:00+00');
INSERT INTO public.club_matches (club_id, local_id, team_id, opponent, detail, updated_at) VALUES
  ('10000000-0000-4000-8000-00000000000a', 'm-1', '30000000-0000-4000-8000-0000000000a1', 'Rivals', '{"players":[]}', '2026-10-15 10:00+00'),
  ('10000000-0000-4000-8000-00000000000a', 'm-2', '30000000-0000-4000-8000-0000000000a2', 'Others', '{}', '2026-10-15 10:00+00'),
  ('10000000-0000-4000-8000-00000000000b', 'm-1', NULL, 'B game', '{}', '2026-10-15 10:00+00');

-- Anonymous visitors can read the public privacy notice only.
SET LOCAL ROLE anon;
SELECT is((SELECT info_officer_name FROM public.get_privacy_notice('10000000-0000-4000-8000-00000000000a')), 'Officer A',
  'the privacy notice is public');
SELECT throws_ok('SELECT * FROM public.club_privacy', '42501', NULL, 'anon cannot read the settings table');
RESET ROLE;

-- Club B staff
SELECT pg_temp.act_as('00000000-0000-4000-8000-0000000000b1', 'admin.b@example.test');
SELECT is((SELECT count(*) FROM public.club_drills)::int, 1, 'club B sees only its own drills');
SELECT is((SELECT title FROM public.club_drills), 'B rondo', 'and it is club B''s drill');
SELECT is((SELECT count(*) FROM public.club_matches)::int, 1, 'club B sees only its own matches');
SELECT is((SELECT count(*) FROM public.club_privacy)::int, 0, 'club B cannot read club A privacy settings');
SELECT throws_ok($$INSERT INTO public.club_drills (club_id, local_id, drill)
  VALUES ('10000000-0000-4000-8000-00000000000a', 'evil', '{}')$$, '42501', NULL, 'club B cannot write club A drills');
SELECT throws_ok($$INSERT INTO public.club_matches (club_id, local_id, detail)
  VALUES ('10000000-0000-4000-8000-00000000000a', 'evil', '{}')$$, '42501', NULL, 'club B cannot write club A matches');
UPDATE public.club_drills SET title = 'hijack' WHERE club_id = '10000000-0000-4000-8000-00000000000a';
SELECT throws_ok($$INSERT INTO public.club_matches (club_id, local_id, team_id, detail)
  VALUES ('10000000-0000-4000-8000-00000000000b', 'x', '30000000-0000-4000-8000-0000000000a1', '{}')$$,
  NULL, NULL, 'a club B match cannot point at a club A team');
SELECT is((SELECT count(*) FROM public.data_requests)::int, 0, 'club B sees no club A data requests');
RESET ROLE;
SELECT is((SELECT title FROM public.club_drills WHERE club_id = '10000000-0000-4000-8000-00000000000a'), 'A rondo',
  'cross-club update changed nothing');

-- Coach A: own team's matches; last write wins
SELECT pg_temp.act_as('00000000-0000-4000-8000-0000000000a2', 'coach.a@example.test');
SELECT results_eq('SELECT local_id FROM public.club_matches', $$VALUES ('m-1'::text)$$,
  'a coach sees only their team''s matches');
INSERT INTO public.club_drills (club_id, local_id, title, drill, updated_at)
  VALUES ('10000000-0000-4000-8000-00000000000a', 'dr-1', 'Older edit', '{}', '2026-10-15 09:00+00')
  ON CONFLICT (club_id, local_id) DO UPDATE SET title = EXCLUDED.title, drill = EXCLUDED.drill, updated_at = EXCLUDED.updated_at;
SELECT is((SELECT title FROM public.club_drills), 'A rondo', 'an older edit loses (last write wins)');
INSERT INTO public.club_drills (club_id, local_id, title, drill, updated_at)
  VALUES ('10000000-0000-4000-8000-00000000000a', 'dr-1', 'Newer edit', '{}', '2026-10-15 11:00+00')
  ON CONFLICT (club_id, local_id) DO UPDATE SET title = EXCLUDED.title, drill = EXCLUDED.drill, updated_at = EXCLUDED.updated_at;
SELECT is((SELECT title FROM public.club_drills), 'Newer edit', 'a newer edit wins');
SELECT is((SELECT updated_by FROM public.club_drills), '00000000-0000-4000-8000-0000000000a2'::uuid, 'the editor is recorded');
RESET ROLE;

-- Player A: no drills or matches; own consent and requests only
SELECT pg_temp.act_as('00000000-0000-4000-8000-0000000000a3', 'player.a@example.test');
SELECT is((SELECT count(*) FROM public.club_drills)::int, 0, 'players cannot read club drills');
SELECT is((SELECT count(*) FROM public.club_matches)::int, 0, 'players cannot read match records');
SELECT lives_ok($$INSERT INTO public.consents (club_id, player_id, kind, policy_version)
  VALUES ('10000000-0000-4000-8000-00000000000a', '40000000-0000-4000-8000-0000000000a1', 'PORTAL_NOTICE', '2026-10-15')$$,
  'a player acknowledges the notice for themselves');
SELECT throws_ok($$INSERT INTO public.consents (club_id, player_id, kind, policy_version)
  VALUES ('10000000-0000-4000-8000-00000000000a', '40000000-0000-4000-8000-0000000000a2', 'PORTAL_NOTICE', '2026-10-15')$$,
  '42501', NULL, 'a player cannot record consent for someone else');
SELECT lives_ok($$INSERT INTO public.data_requests (club_id, player_id, kind, details)
  VALUES ('10000000-0000-4000-8000-00000000000a', '40000000-0000-4000-8000-0000000000a1', 'DELETION', 'Please delete')$$,
  'a player requests deletion of their own data');
SELECT throws_ok($$INSERT INTO public.data_requests (club_id, player_id, kind)
  VALUES ('10000000-0000-4000-8000-00000000000a', '40000000-0000-4000-8000-0000000000a2', 'ACCESS')$$,
  '42501', NULL, 'a player cannot file a request about another player');
UPDATE public.data_requests SET status = 'DONE';
RESET ROLE;
SELECT is((SELECT status FROM public.data_requests), 'OPEN', 'a player cannot close their own request');

-- Club A admin handles requests
SELECT pg_temp.act_as('00000000-0000-4000-8000-0000000000a1', 'admin.a@example.test');
SELECT is((SELECT count(*) FROM public.data_requests)::int, 1, 'the club admin sees the request');
UPDATE public.data_requests SET status = 'DONE', resolved_at = now();
RESET ROLE;
SELECT is((SELECT status FROM public.data_requests), 'DONE', 'the club admin resolves it');

SELECT * FROM finish();
ROLLBACK;
