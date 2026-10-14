-- 2026-10-14 JST / PART: Persistent panel roster, independent Q&A and gallery permissions.
ALTER TABLE public.cpp_live_stage_rooms
 ADD COLUMN display_mode text NOT NULL DEFAULT 'panel' CHECK(display_mode IN ('panel','lecture')),
 ADD COLUMN lecturer_user_id uuid REFERENCES auth.users(id),
 ADD COLUMN host_visible boolean NOT NULL DEFAULT true;
ALTER TABLE public.cpp_live_stage_grants ADD COLUMN panel_slot integer;
WITH ranked AS (SELECT room_id,user_id,row_number() OVER(PARTITION BY room_id ORDER BY user_id) AS slot
 FROM public.cpp_live_stage_grants WHERE role='presenter')
UPDATE public.cpp_live_stage_grants g SET panel_slot=ranked.slot FROM ranked
 WHERE g.room_id=ranked.room_id AND g.user_id=ranked.user_id;
-- Older development rooms allowed several questioners. Retire excess identities safely.
WITH ranked AS (SELECT room_id,user_id,row_number() OVER(PARTITION BY room_id ORDER BY user_id) AS n
 FROM public.cpp_live_stage_grants WHERE role='questioner'), removed AS (
 DELETE FROM public.cpp_live_stage_grants g USING ranked x
 WHERE g.room_id=x.room_id AND g.user_id=x.user_id AND x.n>1 RETURNING g.room_id,g.user_id)
UPDATE public.cpp_live_stage_tickets t SET revoke_requested_at=coalesce(t.revoke_requested_at,clock_timestamp())
 FROM removed x WHERE t.room_id=x.room_id AND t.user_id=x.user_id AND t.revoked_at IS NULL;
ALTER TABLE public.cpp_live_stage_grants ADD CONSTRAINT cpp_live_stage_panel_slot
 CHECK((role='presenter' AND panel_slot BETWEEN 1 AND 6 AND panel_slot IS NOT NULL) OR (role='questioner' AND panel_slot IS NULL));
CREATE UNIQUE INDEX cpp_live_stage_panel_position ON public.cpp_live_stage_grants(room_id,panel_slot) WHERE role='presenter';
CREATE UNIQUE INDEX cpp_live_stage_one_questioner ON public.cpp_live_stage_grants(room_id) WHERE role='questioner';
ALTER TABLE public.cpp_live_stage_tickets ADD COLUMN can_speak boolean NOT NULL DEFAULT false;
UPDATE public.cpp_live_stage_tickets SET can_speak=role<>'viewer';

CREATE FUNCTION cpp_private.live_stage_can_speak(p_room_id uuid,p_user_id uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT coalesce((SELECT p_user_id=r.host_user_id OR EXISTS(
  SELECT 1 FROM public.cpp_live_stage_grants g WHERE g.room_id=r.id AND g.user_id=p_user_id
  AND (g.role='questioner' OR r.display_mode='panel' OR r.lecturer_user_id=p_user_id))
 FROM public.cpp_live_stage_rooms r WHERE r.id=p_room_id),false);
$$;
REVOKE ALL ON FUNCTION cpp_private.live_stage_can_speak(uuid,uuid) FROM PUBLIC,anon,authenticated;

CREATE OR REPLACE FUNCTION public.cpp_live_stage_ticket(p_event_id uuid) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE c public.cpp_live_event_controls%rowtype; e public.cpp_live_events%rowtype;
 r public.cpp_live_stage_rooms%rowtype; t public.cpp_live_stage_tickets%rowtype; v_role text; v_name text; v_speak boolean;
BEGIN
 IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Login required' USING errcode='42501'; END IF;
 SELECT * INTO e FROM public.cpp_live_events WHERE id=p_event_id FOR UPDATE;
 SELECT * INTO c FROM public.cpp_live_event_controls WHERE event_id=p_event_id FOR UPDATE;
 IF c.event_id IS NULL OR NOT e.is_development OR c.phase NOT IN ('opening','closing') OR NOT cpp_private.live_event_can_enter(p_event_id,auth.uid())
  OR clock_timestamp()>=e.ends_at THEN RAISE EXCEPTION 'Active development STAGE required' USING errcode='42501'; END IF;
 IF EXISTS(SELECT 1 FROM public.cpp_live_event_calls WHERE event_id=p_event_id AND started_at IS NOT NULL
   AND least(started_at+interval '10 minutes',e.ends_at)>clock_timestamp())
 THEN RAISE EXCEPTION 'Private media is still valid' USING errcode='55000'; END IF;
 INSERT INTO public.cpp_live_stage_rooms(event_id,phase,phase_started_at,host_user_id,control_epoch,organizer_account_id,billing_account_id,expires_at)
 VALUES(p_event_id,c.phase,c.phase_started_at,c.host_user_id,c.stage_epoch,c.organizer_account_id,c.billing_account_id,e.ends_at)
 ON CONFLICT(event_id,control_epoch) DO NOTHING;
 SELECT * INTO r FROM public.cpp_live_stage_rooms WHERE event_id=p_event_id AND control_epoch=c.stage_epoch;
 IF r.closing_at IS NOT NULL THEN RAISE EXCEPTION 'STAGE is closing' USING errcode='55000'; END IF;
 v_role:=CASE WHEN auth.uid()=c.host_user_id THEN 'host' ELSE coalesce((SELECT role FROM public.cpp_live_stage_grants WHERE room_id=r.id AND user_id=auth.uid()),'viewer') END;
 v_speak:=cpp_private.live_stage_can_speak(r.id,auth.uid());
 SELECT * INTO t FROM public.cpp_live_stage_tickets WHERE room_id=r.id AND user_id=auth.uid() AND revoked_at IS NULL;
 IF FOUND AND (t.revoke_requested_at IS NOT NULL OR t.role<>v_role OR t.can_speak<>v_speak)
 THEN RAISE EXCEPTION 'Previous identity must be retired' USING errcode='55000'; END IF;
 IF t.id IS NULL THEN
  INSERT INTO public.cpp_live_stage_tickets(room_id,user_id,role,expires_at,can_speak) VALUES(r.id,auth.uid(),v_role,e.ends_at,v_speak) RETURNING * INTO t;
 END IF;
 SELECT coalesce(nullif(s.display_name,''),nullif(p.display_name,''),'CPP参加者') INTO v_name
 FROM auth.users u LEFT JOIN public.parari_social_profiles s ON s.user_id=u.id LEFT JOIN public.profiles p ON p.user_id=u.id WHERE u.id=auth.uid();
 RETURN jsonb_build_object('ticket_id',t.id,'room_id',r.id,'role',t.role,'can_speak',t.can_speak,'expires_at',t.expires_at,'display_name',v_name);
END $$;

CREATE OR REPLACE FUNCTION public.cpp_live_stage_state(p_event_id uuid) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE c public.cpp_live_event_controls%rowtype; r public.cpp_live_stage_rooms%rowtype; v_people jsonb;
BEGIN
 IF auth.uid() IS NULL OR NOT cpp_private.live_event_can_enter(p_event_id,auth.uid()) THEN RAISE EXCEPTION 'Event access required' USING errcode='42501'; END IF;
 SELECT * INTO c FROM public.cpp_live_event_controls WHERE event_id=p_event_id;
 SELECT * INTO r FROM public.cpp_live_stage_rooms WHERE event_id=p_event_id AND control_epoch=c.stage_epoch;
 WITH present AS MATERIALIZED (SELECT user_id,display_name FROM public.cpp_live_event_roster(p_event_id)),
 ids AS (SELECT user_id FROM present UNION SELECT user_id FROM public.cpp_live_stage_grants WHERE room_id=r.id UNION SELECT c.host_user_id),
 people AS (SELECT i.user_id,coalesce(v.display_name,nullif(s.display_name,''),nullif(p.display_name,''),'CPP参加者') AS display_name,v.user_id IS NOT NULL AS is_present
  FROM ids i LEFT JOIN present v ON v.user_id=i.user_id LEFT JOIN public.parari_social_profiles s ON s.user_id=i.user_id
  LEFT JOIN public.profiles p ON p.user_id=i.user_id WHERE i.user_id IS NOT NULL)
 SELECT coalesce(jsonb_agg(jsonb_build_object('user_id',p.user_id,'display_name',p.display_name,
  'role',CASE WHEN p.user_id=c.host_user_id THEN 'host' ELSE coalesce(g.role,'viewer') END,
  'panel_slot',g.panel_slot,'hand_raised',h.user_id IS NOT NULL,'present',p.is_present,
  'ticket_id',t.id,'can_speak',coalesce(p.user_id=r.host_user_id OR g.role='questioner' OR
   (g.role='presenter' AND (r.display_mode='panel' OR r.lecturer_user_id=p.user_id)),false)) ORDER BY p.user_id),'[]'::jsonb) INTO v_people
 FROM people p LEFT JOIN public.cpp_live_stage_grants g ON g.room_id=r.id AND g.user_id=p.user_id
 LEFT JOIN public.cpp_live_stage_hands h ON h.room_id=r.id AND h.user_id=p.user_id
 LEFT JOIN public.cpp_live_stage_tickets t ON t.room_id=r.id AND t.user_id=p.user_id AND t.revoked_at IS NULL AND t.revoke_requested_at IS NULL;
 RETURN jsonb_build_object('room_id',r.id,'closing',r.closing_at IS NOT NULL,'version',c.version,
  'pending_count',(SELECT count(*) FROM public.cpp_live_stage_tickets t JOIN public.cpp_live_stage_rooms s ON s.id=t.room_id WHERE s.event_id=p_event_id AND t.revoke_requested_at IS NOT NULL AND t.revoked_at IS NULL),
  'display_mode',coalesce(r.display_mode,'panel'),'lecturer_user_id',coalesce(r.lecturer_user_id,c.host_user_id),'host_visible',coalesce(r.host_visible,true),
  'role',CASE WHEN auth.uid()=c.host_user_id THEN 'host' ELSE coalesce((SELECT role FROM public.cpp_live_stage_grants WHERE room_id=r.id AND user_id=auth.uid()),'viewer') END,
  'can_speak',cpp_private.live_stage_can_speak(r.id,auth.uid()),
  'ticket_id',(SELECT id FROM public.cpp_live_stage_tickets WHERE room_id=r.id AND user_id=auth.uid() AND revoked_at IS NULL AND revoke_requested_at IS NULL),
  'hand_raised',EXISTS(SELECT 1 FROM public.cpp_live_stage_hands WHERE room_id=r.id AND user_id=auth.uid()),'people',v_people);
END $$;

-- All edits share the progression lock/version. Role decreases cannot reuse an old token.
CREATE FUNCTION public.cpp_live_stage_manage(p_event_id uuid,p_expected_version bigint,p_action text,p_target_id uuid DEFAULT NULL,p_visible boolean DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE c public.cpp_live_event_controls%rowtype; r public.cpp_live_stage_rooms%rowtype; v_slot integer; v_pending jsonb;
BEGIN
 IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Login required' USING errcode='42501'; END IF;
 PERFORM 1 FROM public.cpp_live_events WHERE id=p_event_id FOR UPDATE;
 SELECT * INTO c FROM public.cpp_live_event_controls WHERE event_id=p_event_id FOR UPDATE;
 IF c.event_id IS NULL OR c.host_user_id<>auth.uid() OR NOT cpp_private.live_event_can_enter(p_event_id,auth.uid())
 THEN RAISE EXCEPTION 'Host required' USING errcode='42501'; END IF;
 IF c.version IS DISTINCT FROM p_expected_version THEN RAISE EXCEPTION 'Stale event version' USING errcode='40001'; END IF;
 SELECT * INTO r FROM public.cpp_live_stage_rooms WHERE event_id=p_event_id AND control_epoch=c.stage_epoch;
 IF r.id IS NULL OR r.closing_at IS NOT NULL OR r.expires_at<=clock_timestamp() OR c.phase NOT IN ('opening','closing')
 THEN RAISE EXCEPTION 'Active STAGE required' USING errcode='55000'; END IF;
 IF p_action IN ('panel_add','question_allow') THEN
  IF p_target_id IS NULL OR p_target_id=c.host_user_id OR NOT EXISTS(SELECT 1 FROM public.cpp_live_event_attendees
    WHERE event_id=p_event_id AND user_id=p_target_id AND last_seen_at>clock_timestamp()-interval '90 seconds')
  THEN RAISE EXCEPTION 'Current attendee required' USING errcode='22023'; END IF;
 END IF;
 CASE p_action
 WHEN 'retry' THEN NULL;
 WHEN 'panel_add' THEN
  IF NOT EXISTS(SELECT 1 FROM public.cpp_live_stage_grants WHERE room_id=r.id AND user_id=p_target_id AND role='presenter') THEN
   SELECT n INTO v_slot FROM generate_series(1,6) n WHERE NOT EXISTS(SELECT 1 FROM public.cpp_live_stage_grants WHERE room_id=r.id AND panel_slot=n) ORDER BY n LIMIT 1;
   IF v_slot IS NULL THEN RAISE EXCEPTION 'Panel is full' USING errcode='22023'; END IF;
   INSERT INTO public.cpp_live_stage_grants(room_id,user_id,role,panel_slot) VALUES(r.id,p_target_id,'presenter',v_slot)
   ON CONFLICT(room_id,user_id) DO UPDATE SET role='presenter',panel_slot=excluded.panel_slot;
  END IF;
 WHEN 'panel_remove' THEN
  IF p_target_id IS NULL OR p_target_id=c.host_user_id THEN RAISE EXCEPTION 'Panelist required' USING errcode='22023'; END IF;
  DELETE FROM public.cpp_live_stage_grants WHERE room_id=r.id AND user_id=p_target_id AND role='presenter';
  UPDATE public.cpp_live_stage_rooms SET lecturer_user_id=c.host_user_id WHERE id=r.id AND lecturer_user_id=p_target_id;
 WHEN 'question_allow' THEN
  IF EXISTS(SELECT 1 FROM public.cpp_live_stage_grants WHERE room_id=r.id AND user_id=p_target_id AND role='presenter')
  THEN RAISE EXCEPTION 'Panelist already has a separate speaking role' USING errcode='22023'; END IF;
  DELETE FROM public.cpp_live_stage_grants WHERE room_id=r.id AND role='questioner' AND user_id<>p_target_id;
  INSERT INTO public.cpp_live_stage_grants(room_id,user_id,role) VALUES(r.id,p_target_id,'questioner') ON CONFLICT DO NOTHING;
 WHEN 'question_end' THEN
  DELETE FROM public.cpp_live_stage_grants WHERE room_id=r.id AND role='questioner';
 WHEN 'lecture' THEN
  IF p_target_id IS NULL OR (p_target_id<>c.host_user_id AND NOT EXISTS(SELECT 1 FROM public.cpp_live_stage_grants WHERE room_id=r.id AND user_id=p_target_id AND role='presenter'))
  THEN RAISE EXCEPTION 'Choose a panelist or host' USING errcode='22023'; END IF;
  UPDATE public.cpp_live_stage_rooms SET display_mode='lecture',lecturer_user_id=p_target_id WHERE id=r.id;
 WHEN 'panel' THEN UPDATE public.cpp_live_stage_rooms SET display_mode='panel' WHERE id=r.id;
 WHEN 'host_visibility' THEN
  IF p_visible IS NULL THEN RAISE EXCEPTION 'Visibility required' USING errcode='22023'; END IF;
  UPDATE public.cpp_live_stage_rooms SET host_visible=p_visible WHERE id=r.id;
 ELSE RAISE EXCEPTION 'Invalid stage action' USING errcode='22023';
 END CASE;
 IF p_action IN ('panel_add','question_allow') THEN DELETE FROM public.cpp_live_stage_hands WHERE room_id=r.id AND user_id=p_target_id; END IF;
 UPDATE public.cpp_live_stage_tickets t SET revoke_requested_at=coalesce(t.revoke_requested_at,clock_timestamp())
 WHERE t.room_id=r.id AND t.revoked_at IS NULL AND
  (t.role<>CASE WHEN t.user_id=c.host_user_id THEN 'host' ELSE coalesce((SELECT g.role FROM public.cpp_live_stage_grants g WHERE g.room_id=r.id AND g.user_id=t.user_id),'viewer') END
   OR t.can_speak<>cpp_private.live_stage_can_speak(r.id,t.user_id));
 UPDATE public.cpp_live_event_controls SET version=version+1 WHERE event_id=p_event_id;
 INSERT INTO public.cpp_live_event_control_log(event_id,version,actor_user_id,action,details)
 VALUES(p_event_id,c.version+1,auth.uid(),'stage_role',jsonb_build_object('operation',p_action,'user_id',p_target_id,'visible',p_visible));
 SELECT coalesce(jsonb_agg(jsonb_build_object('ticket_id',t.id,'room_id',t.room_id,'expires_at',t.expires_at)),'[]'::jsonb) INTO v_pending
 FROM public.cpp_live_stage_tickets t JOIN public.cpp_live_stage_rooms s ON s.id=t.room_id
 WHERE s.event_id=p_event_id AND t.revoke_requested_at IS NOT NULL AND t.revoked_at IS NULL;
 RETURN v_pending;
END $$;
REVOKE ALL ON FUNCTION public.cpp_live_stage_manage(uuid,bigint,text,uuid,boolean) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.cpp_live_stage_manage(uuid,bigint,text,uuid,boolean) TO authenticated;

-- Preserve the previous role API while enforcing the same limits.
CREATE OR REPLACE FUNCTION public.cpp_live_stage_retire(p_event_id uuid,p_expected_version bigint,p_action text,p_target_id uuid DEFAULT NULL,p_role text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE c public.cpp_live_event_controls%rowtype; r public.cpp_live_stage_rooms%rowtype; v_pending jsonb;
BEGIN
 IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Login required' USING errcode='42501'; END IF;
 PERFORM 1 FROM public.cpp_live_events WHERE id=p_event_id FOR UPDATE;
 SELECT * INTO c FROM public.cpp_live_event_controls WHERE event_id=p_event_id FOR UPDATE;
 IF c.event_id IS NULL OR NOT (c.host_user_id=auth.uid() OR (p_action='take_over' AND cpp_private.live_control_is_admin()))
 THEN RAISE EXCEPTION 'Host required' USING errcode='42501'; END IF;
 IF c.version IS DISTINCT FROM p_expected_version THEN RAISE EXCEPTION 'Stale event version' USING errcode='40001'; END IF;
 IF p_action IS NULL OR p_action NOT IN ('role','close','take_over') THEN RAISE EXCEPTION 'Invalid action' USING errcode='22023'; END IF;
 SELECT * INTO r FROM public.cpp_live_stage_rooms WHERE event_id=p_event_id AND control_epoch=c.stage_epoch;
 IF p_action='role' THEN
  RETURN public.cpp_live_stage_manage(p_event_id,p_expected_version,
   CASE p_role WHEN 'presenter' THEN 'panel_add' WHEN 'questioner' THEN 'question_allow'
   WHEN 'viewer' THEN CASE WHEN EXISTS(SELECT 1 FROM public.cpp_live_stage_grants WHERE room_id=r.id AND user_id=p_target_id AND role='questioner')
    THEN 'question_end' ELSE 'panel_remove' END ELSE 'invalid' END,p_target_id);
 ELSE
  UPDATE public.cpp_live_stage_rooms SET closing_at=coalesce(closing_at,clock_timestamp()) WHERE event_id=p_event_id;
  UPDATE public.cpp_live_stage_tickets SET revoke_requested_at=coalesce(revoke_requested_at,clock_timestamp())
   WHERE room_id IN(SELECT id FROM public.cpp_live_stage_rooms WHERE event_id=p_event_id) AND revoked_at IS NULL;
 END IF;
 -- Include earlier incomplete attempts: retry safely drains all pending identities.
 SELECT coalesce(jsonb_agg(jsonb_build_object('ticket_id',t.id,'room_id',t.room_id,'expires_at',t.expires_at)),'[]'::jsonb) INTO v_pending
 FROM public.cpp_live_stage_tickets t JOIN public.cpp_live_stage_rooms s ON s.id=t.room_id
 WHERE s.event_id=p_event_id AND t.revoke_requested_at IS NOT NULL AND t.revoked_at IS NULL;
 RETURN v_pending;
END $$;
