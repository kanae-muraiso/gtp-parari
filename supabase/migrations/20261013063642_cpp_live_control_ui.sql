-- supabase/migrations/20261013063642_cpp_live_control_ui.sql / 2026-10-13 JST
-- PART: Atomic development setup and organizer-scoped MC candidates for 1-B.
-- No new public-event enablement, pricing, or participant eligibility.
CREATE FUNCTION public.cpp_live_create_controlled_test_event(p_title text,p_program jsonb,p_lounge_seconds integer DEFAULT 7200)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_event uuid; v_account uuid; v_seconds integer; v_now timestamptz;
BEGIN
 IF NOT cpp_private.live_control_is_admin() THEN RAISE EXCEPTION 'Administrator required' USING errcode='42501'; END IF;
 IF p_program IS NULL OR jsonb_typeof(p_program)<>'array' THEN RAISE EXCEPTION 'Program required' USING errcode='22023'; END IF;
 IF jsonb_array_length(p_program) NOT BETWEEN 2 AND 64 OR p_lounge_seconds IS NULL OR p_lounge_seconds NOT BETWEEN 1200 AND 43200
 THEN RAISE EXCEPTION 'Invalid event duration' USING errcode='22023'; END IF;
 SELECT sum((item->>'duration_seconds')::integer)::integer+p_lounge_seconds INTO v_seconds FROM jsonb_array_elements(p_program) item;
 IF v_seconds IS NULL OR v_seconds NOT BETWEEN 1 AND 43200 THEN RAISE EXCEPTION 'Event must fit twelve hours' USING errcode='22023'; END IF;
 -- Serializes account provisioning for this administrator only, before event locks.
 PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('cpp-live-test-account:'||auth.uid()::text,0));
 SELECT a.id INTO v_account FROM public.parari_live_accounts a
 JOIN public.parari_live_account_members m ON m.account_id=a.id AND m.user_id=auth.uid() AND m.role='owner'
 WHERE a.kind='cpp' AND a.created_by=auth.uid() ORDER BY a.created_at,a.id LIMIT 1;
 IF v_account IS NULL THEN v_account:=public.parari_live_account_create('CPP 開発イベント','cpp'); END IF;
 v_now:=clock_timestamp();
 INSERT INTO public.cpp_live_events(title,starts_at,ends_at,audience,created_by,is_development)
 VALUES(btrim(p_title),v_now,v_now+make_interval(secs=>v_seconds),ARRAY['researcher','company','alumni'],auth.uid(),true)
 RETURNING id INTO v_event;
 PERFORM public.cpp_live_event_prepare(v_event,v_account,v_account,auth.uid(),p_program,p_lounge_seconds);
 RETURN v_event;
END $$;

CREATE FUNCTION public.cpp_live_event_host_candidates(p_event_id uuid)
RETURNS TABLE(user_id uuid,display_name text)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE c public.cpp_live_event_controls%rowtype;
BEGIN
 SELECT * INTO c FROM public.cpp_live_event_controls WHERE event_id=p_event_id;
 IF auth.uid() IS NULL OR NOT FOUND OR (c.host_user_id<>auth.uid() AND NOT cpp_private.live_control_is_admin())
 THEN RAISE EXCEPTION 'Host or administrator required' USING errcode='42501'; END IF;
 RETURN QUERY SELECT m.user_id,coalesce(nullif(s.display_name,''),nullif(p.display_name,''),'CPP参加者')::text
 FROM public.parari_live_account_members m
 LEFT JOIN public.parari_social_profiles s ON s.user_id=m.user_id
 LEFT JOIN public.profiles p ON p.user_id=m.user_id
 WHERE m.account_id=c.organizer_account_id ORDER BY 2,m.user_id;
END $$;
REVOKE ALL ON FUNCTION public.cpp_live_create_controlled_test_event(text,jsonb,integer),public.cpp_live_event_host_candidates(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.cpp_live_create_controlled_test_event(text,jsonb,integer),public.cpp_live_event_host_candidates(uuid) TO authenticated;
