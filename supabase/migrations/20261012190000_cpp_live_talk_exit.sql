-- End a CPP LIVE private talk for both participants without forcing either
-- person's review screen to close. All transport token requests recheck status.
CREATE OR REPLACE FUNCTION public.cpp_live_event_end_call(p_call_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO ''
AS $$
DECLARE c public.cpp_live_event_calls%rowtype;
BEGIN
 SELECT * INTO c FROM public.cpp_live_event_calls WHERE id=p_call_id FOR UPDATE;
 IF NOT FOUND OR auth.uid() IS NULL OR auth.uid() NOT IN (c.requester_id,c.invited_id)
 THEN RAISE EXCEPTION 'Not permitted' USING errcode='42501'; END IF;
 IF c.status='active' THEN
   UPDATE public.cpp_live_event_calls SET status='ended',ends_at=least(ends_at,now())
   WHERE id=p_call_id;
 END IF;
END $$;
REVOKE ALL ON FUNCTION public.cpp_live_event_end_call(uuid) FROM public,anon;
GRANT EXECUTE ON FUNCTION public.cpp_live_event_end_call(uuid) TO authenticated;
