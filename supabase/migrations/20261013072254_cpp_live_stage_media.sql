-- 2026-10-13 JST / PART: Development-only STAGE authorization and provider identity ledger.
-- Provider identities are disposable UUIDs, never account IDs. Retiring an identity
-- requires server-confirmed Daily ban before another identity or phase is allowed.
ALTER TABLE public.cpp_live_event_controls ADD COLUMN stage_epoch bigint NOT NULL DEFAULT 0;
CREATE TABLE public.cpp_live_stage_rooms (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), event_id uuid NOT NULL REFERENCES public.cpp_live_events(id),
 phase text NOT NULL CHECK (phase IN ('opening','closing')), phase_started_at timestamptz NOT NULL,
 host_user_id uuid NOT NULL REFERENCES auth.users(id), control_epoch bigint NOT NULL,
 organizer_account_id uuid NOT NULL REFERENCES public.parari_live_accounts(id),
 billing_account_id uuid NOT NULL REFERENCES public.parari_live_accounts(id),
 expires_at timestamptz NOT NULL, closing_at timestamptz, created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 UNIQUE(event_id,control_epoch)
);
CREATE TABLE public.cpp_live_stage_grants (
 room_id uuid NOT NULL REFERENCES public.cpp_live_stage_rooms(id), user_id uuid NOT NULL REFERENCES auth.users(id),
 role text NOT NULL CHECK (role IN ('presenter','questioner')), PRIMARY KEY(room_id,user_id)
);
CREATE TABLE public.cpp_live_stage_tickets (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), room_id uuid NOT NULL REFERENCES public.cpp_live_stage_rooms(id),
 user_id uuid NOT NULL REFERENCES auth.users(id), role text NOT NULL CHECK (role IN ('host','presenter','questioner','viewer')),
 created_at timestamptz NOT NULL DEFAULT clock_timestamp(), expires_at timestamptz NOT NULL,
 revoke_requested_at timestamptz, revoked_at timestamptz
);
CREATE UNIQUE INDEX cpp_live_stage_one_identity ON public.cpp_live_stage_tickets(room_id,user_id) WHERE revoked_at IS NULL;
CREATE INDEX cpp_live_stage_pending ON public.cpp_live_stage_tickets(room_id) WHERE revoked_at IS NULL;
CREATE TABLE public.cpp_live_stage_hands (
 room_id uuid NOT NULL REFERENCES public.cpp_live_stage_rooms(id),user_id uuid NOT NULL REFERENCES auth.users(id),
 raised_at timestamptz NOT NULL DEFAULT clock_timestamp(), PRIMARY KEY(room_id,user_id)
);
ALTER TABLE public.cpp_live_stage_rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cpp_live_stage_grants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cpp_live_stage_tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cpp_live_stage_hands ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.cpp_live_stage_rooms,public.cpp_live_stage_grants,public.cpp_live_stage_tickets,public.cpp_live_stage_hands FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.cpp_live_stage_rooms,public.cpp_live_stage_tickets TO service_role;

-- Every writer locks event first, matching progression/call RPCs.
CREATE FUNCTION public.cpp_live_stage_ticket(p_event_id uuid) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE c public.cpp_live_event_controls%rowtype; e public.cpp_live_events%rowtype;
 r public.cpp_live_stage_rooms%rowtype; t public.cpp_live_stage_tickets%rowtype; v_role text; v_name text;
BEGIN
 IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Login required' USING errcode='42501'; END IF;
 SELECT * INTO e FROM public.cpp_live_events WHERE id=p_event_id FOR UPDATE;
 SELECT * INTO c FROM public.cpp_live_event_controls WHERE event_id=p_event_id FOR UPDATE;
 IF c.event_id IS NULL OR NOT e.is_development OR c.phase NOT IN ('opening','closing')
  OR NOT cpp_private.live_event_can_enter(p_event_id,auth.uid())
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
 SELECT * INTO t FROM public.cpp_live_stage_tickets WHERE room_id=r.id AND user_id=auth.uid() AND revoked_at IS NULL;
 IF FOUND AND (t.revoke_requested_at IS NOT NULL OR t.role<>v_role)
 THEN RAISE EXCEPTION 'Previous identity must be retired' USING errcode='55000'; END IF;
 IF t.id IS NULL THEN
  INSERT INTO public.cpp_live_stage_tickets(room_id,user_id,role,expires_at) VALUES(r.id,auth.uid(),v_role,e.ends_at) RETURNING * INTO t;
 END IF;
 SELECT display_name INTO v_name FROM public.cpp_live_event_roster(p_event_id) WHERE user_id=auth.uid();
 RETURN jsonb_build_object('ticket_id',t.id,'room_id',r.id,'role',t.role,'expires_at',t.expires_at,'display_name',coalesce(v_name,'CPP participant'));
END $$;

CREATE FUNCTION public.cpp_live_stage_ticket_valid(p_ticket_id uuid) RETURNS boolean
LANGUAGE sql SECURITY DEFINER SET search_path='' AS $$
 SELECT auth.uid() IS NOT NULL AND EXISTS(
 SELECT 1 FROM public.cpp_live_stage_tickets t JOIN public.cpp_live_stage_rooms r ON r.id=t.room_id
 JOIN public.cpp_live_events e ON e.id=r.event_id JOIN public.cpp_live_event_controls c ON c.event_id=e.id
 WHERE t.id=p_ticket_id AND t.user_id=auth.uid() AND t.revoked_at IS NULL AND t.revoke_requested_at IS NULL
 AND r.closing_at IS NULL AND r.phase=c.phase AND r.control_epoch=c.stage_epoch AND r.host_user_id=c.host_user_id
 AND e.is_development AND t.expires_at>clock_timestamp() AND cpp_private.live_event_can_enter(e.id,auth.uid()));
$$;

CREATE FUNCTION public.cpp_live_stage_state(p_event_id uuid) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE c public.cpp_live_event_controls%rowtype; r public.cpp_live_stage_rooms%rowtype; v_people jsonb;
BEGIN
 IF auth.uid() IS NULL OR NOT cpp_private.live_event_can_enter(p_event_id,auth.uid()) THEN RAISE EXCEPTION 'Event access required' USING errcode='42501'; END IF;
 SELECT * INTO c FROM public.cpp_live_event_controls WHERE event_id=p_event_id;
 SELECT * INTO r FROM public.cpp_live_stage_rooms WHERE event_id=p_event_id AND control_epoch=c.stage_epoch;
 IF auth.uid()=c.host_user_id THEN
  WITH present AS MATERIALIZED (SELECT user_id,display_name FROM public.cpp_live_event_roster(p_event_id)),
  people AS (
   SELECT user_id,display_name,true AS is_present FROM present
   UNION ALL
   SELECT g.user_id,coalesce(nullif(s.display_name,''),nullif(p.display_name,''),'CPP参加者'),false
   FROM public.cpp_live_stage_grants g LEFT JOIN public.parari_social_profiles s ON s.user_id=g.user_id
   LEFT JOIN public.profiles p ON p.user_id=g.user_id
   WHERE g.room_id=r.id AND NOT EXISTS(SELECT 1 FROM present WHERE user_id=g.user_id)
  )
  SELECT coalesce(jsonb_agg(jsonb_build_object('user_id',p.user_id,'display_name',p.display_name,
   'role',CASE WHEN p.user_id=c.host_user_id THEN 'host' ELSE coalesce(g.role,'viewer') END,'hand_raised',h.user_id IS NOT NULL,'present',p.is_present)
   ORDER BY h.raised_at NULLS LAST,p.display_name),'[]'::jsonb) INTO v_people
  FROM people p LEFT JOIN public.cpp_live_stage_grants g ON g.room_id=r.id AND g.user_id=p.user_id
  LEFT JOIN public.cpp_live_stage_hands h ON h.room_id=r.id AND h.user_id=p.user_id;
 END IF;
 RETURN jsonb_build_object('room_id',r.id,'closing',r.closing_at IS NOT NULL,
  'role',CASE WHEN auth.uid()=c.host_user_id THEN 'host' ELSE coalesce((SELECT role FROM public.cpp_live_stage_grants WHERE room_id=r.id AND user_id=auth.uid()),'viewer') END,
  'ticket_id',(SELECT id FROM public.cpp_live_stage_tickets WHERE room_id=r.id AND user_id=auth.uid() AND revoked_at IS NULL AND revoke_requested_at IS NULL),
  'hand_raised',EXISTS(SELECT 1 FROM public.cpp_live_stage_hands WHERE room_id=r.id AND user_id=auth.uid()),'people',coalesce(v_people,'[]'::jsonb));
END $$;

CREATE FUNCTION public.cpp_live_stage_hand(p_event_id uuid,p_raised boolean) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE r uuid;
BEGIN
 IF auth.uid() IS NULL OR NOT cpp_private.live_event_can_enter(p_event_id,auth.uid()) OR p_raised IS NULL
 THEN RAISE EXCEPTION 'Event access required' USING errcode='42501'; END IF;
 PERFORM 1 FROM public.cpp_live_events WHERE id=p_event_id FOR UPDATE;
 SELECT s.id INTO r FROM public.cpp_live_stage_rooms s JOIN public.cpp_live_event_controls c ON c.event_id=s.event_id
 WHERE s.event_id=p_event_id AND s.phase=c.phase AND s.control_epoch=c.stage_epoch AND s.host_user_id=c.host_user_id AND s.closing_at IS NULL;
 IF r IS NULL THEN RAISE EXCEPTION 'Connect STAGE first' USING errcode='55000'; END IF;
 IF p_raised THEN INSERT INTO public.cpp_live_stage_hands(room_id,user_id) VALUES(r,auth.uid()) ON CONFLICT DO NOTHING;
 ELSE DELETE FROM public.cpp_live_stage_hands WHERE room_id=r AND user_id=auth.uid(); END IF;
END $$;

-- Host requests retirement first. Failure leaves a retryable, closed-to-new-token state.
CREATE FUNCTION public.cpp_live_stage_retire(p_event_id uuid,p_expected_version bigint,p_action text,p_target_id uuid DEFAULT NULL,p_role text DEFAULT NULL)
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
  IF r.id IS NULL OR r.closing_at IS NOT NULL OR c.phase NOT IN ('opening','closing')
   OR p_target_id IS NULL OR p_target_id=c.host_user_id OR p_role IS NULL OR p_role NOT IN ('viewer','presenter','questioner')
   OR NOT (EXISTS(SELECT 1 FROM public.cpp_live_event_attendees WHERE event_id=p_event_id AND user_id=p_target_id AND last_seen_at>clock_timestamp()-interval '90 seconds')
     OR (p_role='viewer' AND EXISTS(SELECT 1 FROM public.cpp_live_stage_grants WHERE room_id=r.id AND user_id=p_target_id)))
  THEN RAISE EXCEPTION 'Current attendee required' USING errcode='22023'; END IF;
  IF p_role='viewer' THEN DELETE FROM public.cpp_live_stage_grants WHERE room_id=r.id AND user_id=p_target_id;
  ELSE
   -- Small publishing set; all other attendees are receive-only.
   IF NOT EXISTS(SELECT 1 FROM public.cpp_live_stage_grants WHERE room_id=r.id AND user_id=p_target_id)
    AND (SELECT count(*) FROM public.cpp_live_stage_grants WHERE room_id=r.id)>=3
   THEN RAISE EXCEPTION 'At most three guest speakers' USING errcode='55000'; END IF;
   INSERT INTO public.cpp_live_stage_grants(room_id,user_id,role) VALUES(r.id,p_target_id,p_role)
   ON CONFLICT(room_id,user_id) DO UPDATE SET role=excluded.role;
  END IF;
  DELETE FROM public.cpp_live_stage_hands WHERE room_id=r.id AND user_id=p_target_id;
  UPDATE public.cpp_live_stage_tickets SET revoke_requested_at=coalesce(revoke_requested_at,clock_timestamp())
   WHERE room_id=r.id AND user_id=p_target_id AND revoked_at IS NULL;
  UPDATE public.cpp_live_event_controls SET version=version+1 WHERE event_id=p_event_id;
  INSERT INTO public.cpp_live_event_control_log(event_id,version,actor_user_id,action,details)
  VALUES(p_event_id,c.version+1,auth.uid(),'stage_role',jsonb_build_object('user_id',p_target_id,'role',p_role));
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

CREATE FUNCTION public.cpp_live_stage_retired(p_ticket_ids uuid[]) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 -- Service-only capability. Browsers cannot acknowledge their own revocation.
 UPDATE public.cpp_live_stage_tickets SET revoked_at=clock_timestamp()
 WHERE id=ANY(p_ticket_ids) AND revoke_requested_at IS NOT NULL AND revoked_at IS NULL;
END $$;

CREATE FUNCTION cpp_private.live_stage_transition_guard() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF (OLD.phase IS DISTINCT FROM NEW.phase OR OLD.host_user_id IS DISTINCT FROM NEW.host_user_id)
  AND EXISTS(SELECT 1 FROM public.cpp_live_stage_tickets t JOIN public.cpp_live_stage_rooms r ON r.id=t.room_id
   WHERE r.event_id=OLD.event_id AND t.revoked_at IS NULL AND t.expires_at>clock_timestamp())
 THEN RAISE EXCEPTION 'STAGE must be retired before transition or handover' USING errcode='55000'; END IF;
 IF OLD.phase IS DISTINCT FROM NEW.phase OR OLD.host_user_id IS DISTINCT FROM NEW.host_user_id
 THEN NEW.stage_epoch:=OLD.stage_epoch+1; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER cpp_live_stage_transition_guard BEFORE UPDATE ON public.cpp_live_event_controls
 FOR EACH ROW EXECUTE FUNCTION cpp_private.live_stage_transition_guard();

REVOKE ALL ON FUNCTION public.cpp_live_stage_ticket(uuid),public.cpp_live_stage_ticket_valid(uuid),public.cpp_live_stage_state(uuid),
 public.cpp_live_stage_hand(uuid,boolean),public.cpp_live_stage_retire(uuid,bigint,text,uuid,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.cpp_live_stage_ticket(uuid),public.cpp_live_stage_ticket_valid(uuid),public.cpp_live_stage_state(uuid),
 public.cpp_live_stage_hand(uuid,boolean),public.cpp_live_stage_retire(uuid,bigint,text,uuid,text) TO authenticated;
REVOKE ALL ON FUNCTION public.cpp_live_stage_retired(uuid[]),cpp_private.live_stage_transition_guard() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.cpp_live_stage_retired(uuid[]) TO service_role;

-- Provider facts, separate from permission tickets. No price, invoice or browser writes.
CREATE TABLE public.cpp_live_stage_usage_events (
 provider_event_id text PRIMARY KEY, event_type text NOT NULL CHECK(event_type IN ('participant.joined','participant.left')),
 room_id uuid NOT NULL REFERENCES public.cpp_live_stage_rooms(id), ticket_id uuid NOT NULL REFERENCES public.cpp_live_stage_tickets(id),
 provider_session_id text NOT NULL, joined_at timestamptz NOT NULL, duration_seconds numeric,
 provider_event_at timestamptz NOT NULL, received_at timestamptz NOT NULL DEFAULT clock_timestamp(), body_sha256 text NOT NULL,
 UNIQUE(room_id,provider_session_id,event_type),
 CHECK(duration_seconds IS NULL OR duration_seconds>=0)
);
ALTER TABLE public.cpp_live_stage_usage_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.cpp_live_stage_usage_events FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.cpp_live_stage_usage_events TO service_role;
CREATE FUNCTION public.cpp_live_stage_usage_record(p_event jsonb,p_body_sha256 text) RETURNS text
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE r uuid; t uuid; v_type text:=p_event->>'type'; p jsonb:=p_event->'payload';
BEGIN
 IF v_type IS NULL OR v_type NOT IN ('participant.joined','participant.left')
  OR coalesce(length(p_event->>'id'),0) NOT BETWEEN 1 AND 250
  OR coalesce(length(p->>'session_id'),0) NOT BETWEEN 1 AND 250
  OR p_body_sha256 IS NULL OR p_body_sha256 !~ '^[0-9a-f]{64}$'
  OR coalesce(p->>'room','') !~ '^cpp-stage-[0-9a-f-]{36}$'
  OR coalesce(p->>'user_id','') !~ '^[0-9a-f-]{36}$'
  OR jsonb_typeof(p->'joined_at') IS DISTINCT FROM 'number' OR jsonb_typeof(p_event->'event_ts') IS DISTINCT FROM 'number'
  OR (v_type='participant.left' AND (jsonb_typeof(p->'duration') IS DISTINCT FROM 'number' OR (p->>'duration')::numeric<0))
 THEN RAISE EXCEPTION 'Invalid usage event' USING errcode='22023'; END IF;
 SELECT id INTO r FROM public.cpp_live_stage_rooms WHERE id=substring(p->>'room' FROM 11)::uuid;
 IF r IS NULL THEN RETURN 'untracked_room'; END IF;
 SELECT id INTO t FROM public.cpp_live_stage_tickets WHERE id=(p->>'user_id')::uuid AND room_id=r;
 IF t IS NULL THEN RAISE EXCEPTION 'Unmapped provider identity' USING errcode='22023'; END IF;
 INSERT INTO public.cpp_live_stage_usage_events(provider_event_id,event_type,room_id,ticket_id,provider_session_id,
  joined_at,duration_seconds,provider_event_at,body_sha256)
 VALUES(p_event->>'id',v_type,r,t,p->>'session_id',to_timestamp((p->>'joined_at')::double precision),
  CASE WHEN v_type='participant.left' THEN (p->>'duration')::numeric END,to_timestamp((p_event->>'event_ts')::double precision),p_body_sha256)
 ON CONFLICT DO NOTHING;
 RETURN CASE WHEN FOUND THEN 'recorded' ELSE 'duplicate' END;
END $$;
REVOKE ALL ON FUNCTION public.cpp_live_stage_usage_record(jsonb,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.cpp_live_stage_usage_record(jsonb,text) TO service_role;
