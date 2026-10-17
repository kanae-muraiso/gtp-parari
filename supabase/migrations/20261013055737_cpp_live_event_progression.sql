-- 2026-10-13 JST / PART: CPP LIVE progression foundation.
-- Add opt-in development event control; preserve unmanaged PRIVATE TALK.
-- File: supabase/migrations/20261013055737_cpp_live_event_progression.sql

CREATE TABLE public.parari_live_accounts (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 kind text NOT NULL CHECK (kind IN ('cpp','organization','individual')),
 display_name text NOT NULL CHECK (char_length(btrim(display_name)) BETWEEN 1 AND 120),
 created_by uuid NOT NULL REFERENCES auth.users(id),
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.parari_live_account_members (
 account_id uuid NOT NULL REFERENCES public.parari_live_accounts(id),
 user_id uuid NOT NULL REFERENCES auth.users(id),
 role text NOT NULL CHECK (role IN ('owner','organizer')),
 PRIMARY KEY (account_id,user_id)
);
CREATE INDEX parari_live_account_members_user_idx ON public.parari_live_account_members(user_id,account_id);
CREATE TABLE public.cpp_live_event_controls (
 event_id uuid PRIMARY KEY REFERENCES public.cpp_live_events(id),
 organizer_account_id uuid NOT NULL REFERENCES public.parari_live_accounts(id),
 billing_account_id uuid NOT NULL REFERENCES public.parari_live_accounts(id),
 billing_status text NOT NULL DEFAULT 'unpriced' CHECK (billing_status='unpriced'),
 host_user_id uuid NOT NULL REFERENCES auth.users(id),
 phase text NOT NULL DEFAULT 'waiting' CHECK (phase IN ('waiting','opening','lounge','closing_pending','closing','ended')),
 version bigint NOT NULL DEFAULT 0 CHECK (version>=0),
 phase_started_at timestamptz NOT NULL DEFAULT now(),
 current_item_id uuid,
 item_started_at timestamptz,
 lounge_duration_seconds integer NOT NULL CHECK (lounge_duration_seconds BETWEEN 600 AND 43200),
 closing_target_at timestamptz,
 created_by uuid NOT NULL REFERENCES auth.users(id),
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX cpp_live_controls_organizer_idx ON public.cpp_live_event_controls(organizer_account_id);
CREATE INDEX cpp_live_controls_billing_idx ON public.cpp_live_event_controls(billing_account_id);
CREATE INDEX cpp_live_controls_host_idx ON public.cpp_live_event_controls(host_user_id);
CREATE TABLE public.cpp_live_event_program_items (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 event_id uuid NOT NULL REFERENCES public.cpp_live_event_controls(event_id),
 position integer NOT NULL CHECK (position BETWEEN 1 AND 64),
 stage_phase text NOT NULL CHECK (stage_phase IN ('opening','closing')),
 kind text NOT NULL CHECK (kind IN ('greeting','presentation','qa','instructions','closing')),
 title text NOT NULL CHECK (char_length(btrim(title)) BETWEEN 1 AND 120),
 duration_seconds integer NOT NULL CHECK (duration_seconds BETWEEN 1 AND 7200),
 presenter_user_id uuid REFERENCES auth.users(id),
 UNIQUE(event_id,position),
 UNIQUE(event_id,id)
);
ALTER TABLE public.cpp_live_event_controls ADD CONSTRAINT cpp_live_current_item_same_event
 FOREIGN KEY(event_id,current_item_id) REFERENCES public.cpp_live_event_program_items(event_id,id);
CREATE TABLE public.cpp_live_event_control_log (
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 event_id uuid NOT NULL REFERENCES public.cpp_live_event_controls(event_id),
 version bigint NOT NULL,
 actor_user_id uuid NOT NULL REFERENCES auth.users(id),
 action text NOT NULL,
 details jsonb NOT NULL DEFAULT '{}'::jsonb,
 created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 UNIQUE(event_id,version)
);
ALTER TABLE public.parari_live_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.parari_live_account_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cpp_live_event_controls ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cpp_live_event_program_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cpp_live_event_control_log ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.parari_live_accounts,public.parari_live_account_members,
 public.cpp_live_event_controls,public.cpp_live_event_program_items,public.cpp_live_event_control_log
 FROM PUBLIC,anon,authenticated;

CREATE FUNCTION cpp_private.live_control_is_admin() RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT auth.uid() IS NOT NULL AND EXISTS(
  SELECT 1 FROM cpp_private.mode_users u WHERE u.user_id=auth.uid() AND u.mode='admin'
 );
$$;
CREATE FUNCTION cpp_private.live_account_is_owner(p_account_id uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT auth.uid() IS NOT NULL AND EXISTS(
  SELECT 1 FROM public.parari_live_account_members m
  WHERE m.account_id=p_account_id AND m.user_id=auth.uid() AND m.role='owner'
 );
$$;

-- Provisioning is administrator-only in the pilot. No billing contract is created.
CREATE FUNCTION public.parari_live_account_create(p_name text,p_kind text DEFAULT 'organization') RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_id uuid;
BEGIN
 IF NOT cpp_private.live_control_is_admin() THEN RAISE EXCEPTION 'Administrator required' USING errcode='42501'; END IF;
 INSERT INTO public.parari_live_accounts(display_name,kind,created_by)
 VALUES(btrim(p_name),p_kind,auth.uid()) RETURNING id INTO v_id;
 INSERT INTO public.parari_live_account_members VALUES(v_id,auth.uid(),'owner');
 RETURN v_id;
END $$;
CREATE FUNCTION public.parari_live_account_add_member(p_account_id uuid,p_user_id uuid,p_role text DEFAULT 'organizer') RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF NOT cpp_private.live_account_is_owner(p_account_id) THEN RAISE EXCEPTION 'Account owner required' USING errcode='42501'; END IF;
 -- Adding an existing member never silently changes or removes ownership.
 INSERT INTO public.parari_live_account_members VALUES(p_account_id,p_user_id,p_role);
END $$;

CREATE FUNCTION public.cpp_live_event_prepare(
 p_event_id uuid,p_organizer_account_id uuid,p_billing_account_id uuid,p_host_user_id uuid,
 p_program jsonb,p_lounge_duration_seconds integer DEFAULT 7200
) RETURNS bigint LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE e public.cpp_live_events%rowtype; item jsonb; v_position integer:=0; v_total integer:=0;
 v_closing_seen boolean:=false; v_openings integer:=0; v_closings integer:=0;
BEGIN
 IF NOT cpp_private.live_control_is_admin()
  OR NOT cpp_private.live_account_is_owner(p_organizer_account_id)
  OR NOT cpp_private.live_account_is_owner(p_billing_account_id)
 THEN RAISE EXCEPTION 'Administrator and both account ownerships required' USING errcode='42501'; END IF;
 SELECT * INTO e FROM public.cpp_live_events WHERE id=p_event_id FOR UPDATE;
 IF NOT FOUND OR NOT e.is_development OR e.status<>'scheduled' OR e.ends_at<=clock_timestamp()
 THEN RAISE EXCEPTION 'Unused development event required' USING errcode='42501'; END IF;
 IF EXISTS(SELECT 1 FROM public.cpp_live_event_controls WHERE event_id=p_event_id)
  OR EXISTS(SELECT 1 FROM public.cpp_live_event_attendees WHERE event_id=p_event_id AND last_seen_at>clock_timestamp()-interval '90 seconds')
  OR EXISTS(SELECT 1 FROM public.cpp_live_event_calls WHERE event_id=p_event_id
     AND (status='pending' AND created_at>clock_timestamp()-interval '2 minutes'
       OR status='active' AND ends_at>clock_timestamp()
       OR started_at IS NOT NULL AND least(started_at+interval '10 minutes',e.ends_at)>clock_timestamp()))
 THEN RAISE EXCEPTION 'Event already prepared or in use' USING errcode='55000'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.parari_live_account_members WHERE account_id=p_organizer_account_id AND user_id=p_host_user_id)
 THEN RAISE EXCEPTION 'Host must belong to organizing account' USING errcode='42501'; END IF;
 IF p_program IS NULL OR jsonb_typeof(p_program)<>'array' THEN RAISE EXCEPTION 'Program array required' USING errcode='22023'; END IF;
 IF jsonb_array_length(p_program) NOT BETWEEN 2 AND 64 THEN RAISE EXCEPTION 'Program needs 2 to 64 items' USING errcode='22023'; END IF;
 INSERT INTO public.cpp_live_event_controls(event_id,organizer_account_id,billing_account_id,host_user_id,lounge_duration_seconds,created_by)
 VALUES(p_event_id,p_organizer_account_id,p_billing_account_id,p_host_user_id,p_lounge_duration_seconds,auth.uid());
 FOR item IN SELECT value FROM jsonb_array_elements(p_program) LOOP
  v_position:=v_position+1;
  IF jsonb_typeof(item)<>'object' OR (item->>'stage_phase') IS NULL
    OR (item->>'stage_phase') NOT IN ('opening','closing')
  THEN RAISE EXCEPTION 'Invalid program item' USING errcode='22023'; END IF;
  IF item->>'stage_phase'='closing' THEN v_closing_seen:=true; v_closings:=v_closings+1;
  ELSE
   IF v_closing_seen THEN RAISE EXCEPTION 'Opening must precede closing' USING errcode='22023'; END IF;
   v_openings:=v_openings+1;
  END IF;
  INSERT INTO public.cpp_live_event_program_items(event_id,position,stage_phase,kind,title,duration_seconds,presenter_user_id)
  VALUES(p_event_id,v_position,item->>'stage_phase',item->>'kind',btrim(item->>'title'),
   (item->>'duration_seconds')::integer,(item->>'presenter_user_id')::uuid);
  v_total:=v_total+(item->>'duration_seconds')::integer;
 END LOOP;
 IF v_openings=0 OR v_closings=0 OR v_total+p_lounge_duration_seconds>extract(epoch FROM e.ends_at-e.starts_at)
 THEN RAISE EXCEPTION 'Program does not fit event schedule' USING errcode='22023'; END IF;
 INSERT INTO public.cpp_live_event_control_log(event_id,version,actor_user_id,action,details)
 VALUES(p_event_id,0,auth.uid(),'prepare',jsonb_build_object('host_user_id',p_host_user_id,
  'organizer_account_id',p_organizer_account_id,'billing_account_id',p_billing_account_id,'billing_status','unpriced'));
 RETURN 0;
END $$;

-- Caller must acquire the event row lock before this gate, so phase and acceptance serialize.
CREATE FUNCTION cpp_private.live_event_accepts_talk(p_event_id uuid) RETURNS boolean
LANGUAGE sql VOLATILE SECURITY DEFINER SET search_path='' AS $$
 SELECT NOT EXISTS(SELECT 1 FROM public.cpp_live_event_controls c WHERE c.event_id=p_event_id)
 OR EXISTS(SELECT 1 FROM public.cpp_live_event_controls c WHERE c.event_id=p_event_id
   AND c.phase='lounge' AND c.closing_target_at IS NOT NULL
   AND clock_timestamp()<c.closing_target_at-interval '10 minutes');
$$;

CREATE FUNCTION public.cpp_live_event_set_host(p_event_id uuid,p_host_user_id uuid,p_expected_version bigint)
RETURNS bigint LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE c public.cpp_live_event_controls%rowtype;
BEGIN
 IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Login required' USING errcode='42501'; END IF;
 PERFORM 1 FROM public.cpp_live_events WHERE id=p_event_id FOR UPDATE;
 SELECT * INTO c FROM public.cpp_live_event_controls WHERE event_id=p_event_id FOR UPDATE;
 IF NOT FOUND OR (auth.uid()<>c.host_user_id AND NOT cpp_private.live_control_is_admin())
 THEN RAISE EXCEPTION 'Host or administrator required' USING errcode='42501'; END IF;
 IF p_expected_version IS DISTINCT FROM c.version THEN RAISE EXCEPTION 'Stale event version' USING errcode='40001'; END IF;
 IF c.phase='ended' OR NOT EXISTS(SELECT 1 FROM public.cpp_live_events
   WHERE id=p_event_id AND status='scheduled' AND ends_at>clock_timestamp())
 THEN RAISE EXCEPTION 'Event ended' USING errcode='55000'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.parari_live_account_members WHERE account_id=c.organizer_account_id AND user_id=p_host_user_id)
  AND NOT (p_host_user_id=auth.uid() AND cpp_private.live_control_is_admin())
 THEN RAISE EXCEPTION 'Host must belong to organizing account' USING errcode='42501'; END IF;
 UPDATE public.cpp_live_event_controls SET host_user_id=p_host_user_id,version=version+1 WHERE event_id=p_event_id;
 INSERT INTO public.cpp_live_event_control_log(event_id,version,actor_user_id,action,details)
 VALUES(p_event_id,c.version+1,auth.uid(),'set_host',jsonb_build_object('from',c.host_user_id,'to',p_host_user_id));
 RETURN c.version+1;
END $$;

CREATE FUNCTION public.cpp_live_event_transition(p_event_id uuid,p_phase text,p_expected_version bigint)
RETURNS bigint LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE e public.cpp_live_events%rowtype; c public.cpp_live_event_controls%rowtype;
 v_now timestamptz; v_item uuid; v_closing_seconds integer; v_target timestamptz;
BEGIN
 IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Login required' USING errcode='42501'; END IF;
 SELECT * INTO e FROM public.cpp_live_events WHERE id=p_event_id FOR UPDATE;
 SELECT * INTO c FROM public.cpp_live_event_controls WHERE event_id=p_event_id FOR UPDATE;
 IF NOT FOUND OR c.host_user_id<>auth.uid() THEN RAISE EXCEPTION 'Event host required' USING errcode='42501'; END IF;
 IF p_expected_version IS DISTINCT FROM c.version THEN RAISE EXCEPTION 'Stale event version' USING errcode='40001'; END IF;
 v_now:=clock_timestamp();
 IF p_phase IS NULL OR c.phase='ended' THEN RAISE EXCEPTION 'Invalid phase transition' USING errcode='22023'; END IF;
 IF v_now>=e.ends_at OR e.status<>'scheduled' THEN
  IF p_phase<>'ended' THEN RAISE EXCEPTION 'Event ended' USING errcode='55000'; END IF;
 ELSE
  IF v_now<e.starts_at THEN RAISE EXCEPTION 'Event has not started' USING errcode='55000'; END IF;
  IF NOT ((c.phase='waiting' AND p_phase='opening') OR (c.phase='opening' AND p_phase='lounge')
   OR (c.phase='lounge' AND p_phase='closing_pending') OR (c.phase='closing_pending' AND p_phase='closing')
   OR (c.phase='closing' AND p_phase='ended'))
  THEN RAISE EXCEPTION 'Invalid phase transition' USING errcode='22023'; END IF;
 END IF;
 IF p_phase IN ('closing','ended') AND v_now<e.ends_at AND EXISTS(
  SELECT 1 FROM public.cpp_live_event_calls x WHERE x.event_id=p_event_id AND x.started_at IS NOT NULL
    AND least(x.started_at+interval '10 minutes',e.ends_at)>v_now
 ) THEN RAISE EXCEPTION 'Wait for original media deadlines before closing' USING errcode='55000'; END IF;
 IF p_phase IN ('opening','closing') THEN
  SELECT id INTO v_item FROM public.cpp_live_event_program_items
  WHERE event_id=p_event_id AND stage_phase=p_phase ORDER BY position LIMIT 1;
 END IF;
 v_target:=c.closing_target_at;
 IF p_phase='lounge' THEN
  SELECT sum(duration_seconds)::integer INTO v_closing_seconds FROM public.cpp_live_event_program_items
  WHERE event_id=p_event_id AND stage_phase='closing';
  v_target:=least(v_now+make_interval(secs=>c.lounge_duration_seconds),e.ends_at-make_interval(secs=>v_closing_seconds));
  IF v_target<=v_now+interval '10 minutes' THEN RAISE EXCEPTION 'Not enough time for a full private talk' USING errcode='55000'; END IF;
 END IF;
 IF p_phase IN ('closing_pending','closing','ended') THEN
  UPDATE public.cpp_live_event_calls SET status='ended' WHERE event_id=p_event_id AND status='pending';
 END IF;
 UPDATE public.cpp_live_event_controls SET phase=p_phase,version=version+1,phase_started_at=v_now,
  current_item_id=v_item,item_started_at=CASE WHEN v_item IS NOT NULL THEN v_now END,closing_target_at=v_target
 WHERE event_id=p_event_id;
 INSERT INTO public.cpp_live_event_control_log(event_id,version,actor_user_id,action,details)
 VALUES(p_event_id,c.version+1,auth.uid(),'phase',jsonb_build_object('from',c.phase,'to',p_phase));
 RETURN c.version+1;
END $$;

CREATE FUNCTION public.cpp_live_event_next_item(p_event_id uuid,p_expected_version bigint)
RETURNS bigint LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE c public.cpp_live_event_controls%rowtype; v_item uuid;
BEGIN
 IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Login required' USING errcode='42501'; END IF;
 PERFORM 1 FROM public.cpp_live_events WHERE id=p_event_id FOR UPDATE;
 SELECT * INTO c FROM public.cpp_live_event_controls WHERE event_id=p_event_id FOR UPDATE;
 IF NOT FOUND OR c.host_user_id<>auth.uid() THEN RAISE EXCEPTION 'Event host required' USING errcode='42501'; END IF;
 IF p_expected_version IS DISTINCT FROM c.version THEN RAISE EXCEPTION 'Stale event version' USING errcode='40001'; END IF;
 IF c.phase NOT IN ('opening','closing') OR NOT EXISTS(SELECT 1 FROM public.cpp_live_events
  WHERE id=p_event_id AND status='scheduled' AND clock_timestamp()>=starts_at AND clock_timestamp()<ends_at)
 THEN RAISE EXCEPTION 'No active stage program' USING errcode='55000'; END IF;
 SELECT n.id INTO v_item FROM public.cpp_live_event_program_items n
 JOIN public.cpp_live_event_program_items current ON current.id=c.current_item_id AND current.event_id=c.event_id
 WHERE n.event_id=p_event_id AND n.stage_phase=c.phase AND n.position>current.position ORDER BY n.position LIMIT 1;
 IF v_item IS NULL THEN RAISE EXCEPTION 'Last program item reached' USING errcode='55000'; END IF;
 UPDATE public.cpp_live_event_controls SET current_item_id=v_item,item_started_at=clock_timestamp(),version=version+1 WHERE event_id=p_event_id;
 INSERT INTO public.cpp_live_event_control_log(event_id,version,actor_user_id,action,details)
 VALUES(p_event_id,c.version+1,auth.uid(),'next_item',jsonb_build_object('from',c.current_item_id,'to',v_item));
 RETURN c.version+1;
END $$;

CREATE FUNCTION public.cpp_live_event_control_state(p_event_id uuid) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE c public.cpp_live_event_controls%rowtype; e public.cpp_live_events%rowtype; v_now timestamptz:=clock_timestamp(); v_items jsonb;
BEGIN
 IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Login required' USING errcode='42501'; END IF;
 SELECT * INTO e FROM public.cpp_live_events WHERE id=p_event_id;
 SELECT * INTO c FROM public.cpp_live_event_controls WHERE event_id=p_event_id;
 IF NOT (cpp_private.live_control_is_admin() OR coalesce(c.host_user_id=auth.uid(),false)
   OR cpp_private.live_event_can_enter(p_event_id,auth.uid())
   OR EXISTS(SELECT 1 FROM public.cpp_live_event_attendees WHERE event_id=p_event_id AND user_id=auth.uid()))
 THEN RAISE EXCEPTION 'Event access required' USING errcode='42501'; END IF;
 IF c.event_id IS NULL THEN RETURN jsonb_build_object('managed',false,'server_now',v_now); END IF;
 SELECT jsonb_agg(jsonb_build_object('id',id,'position',position,'stage_phase',stage_phase,'kind',kind,
  'title',title,'duration_seconds',duration_seconds,'presenter_user_id',presenter_user_id) ORDER BY position)
 INTO v_items FROM public.cpp_live_event_program_items WHERE event_id=p_event_id;
 RETURN jsonb_build_object('managed',true,'event_id',p_event_id,'server_now',v_now,'phase',c.phase,
  'effective_phase',CASE WHEN v_now>=e.ends_at OR e.status<>'scheduled' THEN 'ended' ELSE c.phase END,
  'version',c.version,'host_user_id',c.host_user_id,'can_control',auth.uid()=c.host_user_id,
  'can_take_over',cpp_private.live_control_is_admin(),'phase_started_at',c.phase_started_at,
  'current_item_id',c.current_item_id,'item_started_at',c.item_started_at,'program',v_items,
  'closing_target_at',c.closing_target_at,'new_talks_stop_at',c.closing_target_at-interval '10 minutes',
  'can_start_talk',cpp_private.live_event_can_enter(p_event_id,auth.uid()) AND cpp_private.live_event_accepts_talk(p_event_id),
  'active_call_count',(SELECT count(*) FROM public.cpp_live_event_calls WHERE event_id=p_event_id AND status='active' AND ends_at>v_now),
  'media_drain_until',(SELECT max(least(started_at+interval '10 minutes',e.ends_at)) FROM public.cpp_live_event_calls
    WHERE event_id=p_event_id AND started_at IS NOT NULL AND least(started_at+interval '10 minutes',e.ends_at)>v_now));
END $$;

CREATE FUNCTION public.cpp_live_event_billing_context(p_event_id uuid) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE c public.cpp_live_event_controls%rowtype;
BEGIN
 SELECT * INTO c FROM public.cpp_live_event_controls WHERE event_id=p_event_id;
 IF NOT FOUND OR NOT cpp_private.live_account_is_owner(c.billing_account_id)
 THEN RAISE EXCEPTION 'Billing account owner required' USING errcode='42501'; END IF;
 RETURN jsonb_build_object('event_id',p_event_id,'organizer_account_id',c.organizer_account_id,
  'billing_account_id',c.billing_account_id,'billing_status',c.billing_status);
END $$;

REVOKE ALL ON FUNCTION cpp_private.live_control_is_admin(),cpp_private.live_account_is_owner(uuid),
 cpp_private.live_event_accepts_talk(uuid) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.parari_live_account_create(text,text),public.parari_live_account_add_member(uuid,uuid,text),
 public.cpp_live_event_prepare(uuid,uuid,uuid,uuid,jsonb,integer),public.cpp_live_event_set_host(uuid,uuid,bigint),
 public.cpp_live_event_transition(uuid,text,bigint),public.cpp_live_event_next_item(uuid,bigint),
 public.cpp_live_event_control_state(uuid),public.cpp_live_event_billing_context(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.parari_live_account_create(text,text),public.parari_live_account_add_member(uuid,uuid,text),
 public.cpp_live_event_prepare(uuid,uuid,uuid,uuid,jsonb,integer),public.cpp_live_event_set_host(uuid,uuid,bigint),
 public.cpp_live_event_transition(uuid,text,bigint),public.cpp_live_event_next_item(uuid,bigint),
 public.cpp_live_event_control_state(uuid),public.cpp_live_event_billing_context(uuid) TO authenticated;

-- Shared lock order: event -> control/call. Unmanaged events bypass only the
-- progression gate; their existing membership, presence and ten-minute limit remain.
CREATE OR REPLACE FUNCTION public.cpp_live_event_join(p_event_id uuid,p_active boolean DEFAULT true)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE e public.cpp_live_events%rowtype; v_now timestamptz;
BEGIN
 IF auth.uid() IS NULL OR p_active IS NULL THEN RAISE EXCEPTION 'Login and active flag required' USING errcode='42501'; END IF;
 SELECT * INTO e FROM public.cpp_live_events WHERE id=p_event_id FOR UPDATE;
 IF NOT p_active THEN
  DELETE FROM public.cpp_live_event_attendees WHERE event_id=p_event_id AND user_id=auth.uid();
  RETURN false;
 END IF;
 v_now:=clock_timestamp();
 IF NOT cpp_private.live_event_can_enter(p_event_id,auth.uid()) OR v_now>=e.ends_at
  OR EXISTS(SELECT 1 FROM public.cpp_live_event_controls WHERE event_id=p_event_id AND phase='ended')
 THEN RAISE EXCEPTION 'LIVEに参加できません' USING errcode='42501'; END IF;
 INSERT INTO public.cpp_live_event_attendees(event_id,user_id,joined_at,last_seen_at)
 VALUES(p_event_id,auth.uid(),v_now,v_now)
 ON CONFLICT(event_id,user_id) DO UPDATE SET last_seen_at=excluded.last_seen_at;
 RETURN true;
END $$;

CREATE OR REPLACE FUNCTION public.cpp_live_event_request(p_event_id uuid,p_target_id uuid)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_id uuid; e public.cpp_live_events%rowtype; v_now timestamptz;
BEGIN
 IF auth.uid() IS NULL OR auth.uid()=p_target_id OR p_target_id IS NULL
 THEN RAISE EXCEPTION 'Not permitted' USING errcode='42501'; END IF;
 SELECT * INTO e FROM public.cpp_live_events WHERE id=p_event_id FOR UPDATE;
 v_now:=clock_timestamp();
 IF NOT cpp_private.live_event_can_enter(p_event_id,auth.uid()) OR v_now>=e.ends_at
 THEN RAISE EXCEPTION 'Not permitted' USING errcode='42501'; END IF;
 IF NOT cpp_private.live_event_accepts_talk(p_event_id)
 THEN RAISE EXCEPTION 'New conversations are closed' USING errcode='55000'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.cpp_live_event_attendees a
   WHERE a.event_id=p_event_id AND a.user_id=auth.uid() AND a.last_seen_at>v_now-interval '90 seconds')
 OR NOT EXISTS(SELECT 1 FROM public.cpp_live_event_attendees a
   WHERE a.event_id=p_event_id AND a.user_id=p_target_id AND a.last_seen_at>v_now-interval '90 seconds')
 THEN RAISE EXCEPTION 'Both users must be present' USING errcode='42501'; END IF;
 IF EXISTS(SELECT 1 FROM public.cpp_live_event_calls c WHERE c.event_id=p_event_id
   AND c.status IN ('pending','active') AND (auth.uid() IN (c.requester_id,c.invited_id)
          OR p_target_id IN (c.requester_id,c.invited_id))
   AND (c.status='pending' AND c.created_at>v_now-interval '2 minutes'
     OR c.status='active' AND c.ends_at>v_now))
 THEN RAISE EXCEPTION 'There is already a pending/active conversation' USING errcode='55000'; END IF;
 INSERT INTO public.cpp_live_event_calls(event_id,requester_id,invited_id,created_at)
 VALUES(p_event_id,auth.uid(),p_target_id,v_now) RETURNING id INTO v_id;
 RETURN v_id;
END $$;

CREATE OR REPLACE FUNCTION public.cpp_live_event_respond(p_call_id uuid,p_accept boolean)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE c public.cpp_live_event_calls%rowtype; e public.cpp_live_events%rowtype; v_now timestamptz;
BEGIN
 IF auth.uid() IS NULL OR p_accept IS NULL THEN RAISE EXCEPTION 'Login and response required' USING errcode='42501'; END IF;
 -- Find event without holding a call lock; then re-read after event serialization.
 SELECT * INTO c FROM public.cpp_live_event_calls WHERE id=p_call_id;
 IF NOT FOUND OR c.invited_id<>auth.uid() THEN RAISE EXCEPTION 'Request is no longer available' USING errcode='42501'; END IF;
 SELECT * INTO e FROM public.cpp_live_events WHERE id=c.event_id FOR UPDATE;
 SELECT * INTO c FROM public.cpp_live_event_calls WHERE id=p_call_id FOR UPDATE;
 v_now:=clock_timestamp();
 IF NOT FOUND OR c.invited_id<>auth.uid() OR c.status<>'pending'
    OR c.created_at<=v_now-interval '2 minutes' OR v_now>=e.ends_at
    OR NOT cpp_private.live_event_can_enter(c.event_id,auth.uid())
 THEN RAISE EXCEPTION 'Request is no longer available' USING errcode='42501'; END IF;
 IF NOT p_accept THEN
  UPDATE public.cpp_live_event_calls SET status='declined' WHERE id=p_call_id;
  RETURN;
 END IF;
 IF NOT cpp_private.live_event_accepts_talk(c.event_id)
 THEN RAISE EXCEPTION 'New conversations are closed' USING errcode='55000'; END IF;
 IF (SELECT count(*) FROM public.cpp_live_event_attendees a
   WHERE a.event_id=c.event_id AND a.user_id IN (c.requester_id,c.invited_id)
     AND a.last_seen_at>v_now-interval '90 seconds')<>2
 THEN RAISE EXCEPTION 'Both users must be present' USING errcode='42501'; END IF;
 UPDATE public.cpp_live_event_calls SET status='active',started_at=v_now,
  ends_at=least(v_now+interval '10 minutes',e.ends_at) WHERE id=p_call_id;
END $$;

CREATE OR REPLACE FUNCTION public.cpp_live_event_send(p_call_id uuid,p_body text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE c public.cpp_live_event_calls%rowtype; e public.cpp_live_events%rowtype; v_id uuid; v_now timestamptz;
BEGIN
 IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Login required' USING errcode='42501'; END IF;
 SELECT * INTO c FROM public.cpp_live_event_calls WHERE id=p_call_id;
 IF NOT FOUND OR auth.uid() NOT IN (c.requester_id,c.invited_id)
 THEN RAISE EXCEPTION 'Conversation ended or access denied' USING errcode='42501'; END IF;
 SELECT * INTO e FROM public.cpp_live_events WHERE id=c.event_id FOR UPDATE;
 SELECT * INTO c FROM public.cpp_live_event_calls WHERE id=p_call_id FOR UPDATE;
 v_now:=clock_timestamp();
 IF NOT FOUND OR auth.uid() NOT IN (c.requester_id,c.invited_id)
  OR c.status<>'active' OR c.ends_at<=v_now OR v_now>=e.ends_at
  OR NOT cpp_private.live_event_can_enter(c.event_id,auth.uid())
  OR EXISTS(SELECT 1 FROM public.cpp_live_event_controls WHERE event_id=c.event_id AND phase NOT IN ('lounge','closing_pending'))
 THEN RAISE EXCEPTION 'Conversation ended or access denied' USING errcode='42501'; END IF;
 INSERT INTO public.cpp_live_event_messages(call_id,sender_id,body)
 VALUES(p_call_id,auth.uid(),trim(p_body)) RETURNING id INTO v_id;
 RETURN v_id;
END $$;
REVOKE ALL ON FUNCTION public.cpp_live_event_join(uuid,boolean),public.cpp_live_event_request(uuid,uuid),
 public.cpp_live_event_respond(uuid,boolean),public.cpp_live_event_send(uuid,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.cpp_live_event_join(uuid,boolean),public.cpp_live_event_request(uuid,uuid),
 public.cpp_live_event_respond(uuid,boolean),public.cpp_live_event_send(uuid,text) TO authenticated;
