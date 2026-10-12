-- Private, revisable impressions attached to a CPP LIVE conversation.
-- No opponent, company or other attendee can read another user's impression.
CREATE TABLE public.cpp_live_call_notes (
 call_id uuid NOT NULL REFERENCES public.cpp_live_event_calls(id) ON DELETE CASCADE,
 user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
 starred boolean NOT NULL DEFAULT false,
 memo text NOT NULL DEFAULT '' CHECK (char_length(memo)<=2000),
 updated_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(call_id,user_id)
);
ALTER TABLE public.cpp_live_call_notes ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.cpp_live_call_notes FROM public,anon,authenticated;

CREATE OR REPLACE FUNCTION public.cpp_live_note_get(p_call_id uuid)
RETURNS TABLE(starred boolean,memo text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO ''
AS $$
 SELECT n.starred,n.memo
 FROM public.cpp_live_call_notes n
 JOIN public.cpp_live_event_calls c ON c.id=n.call_id
 WHERE n.call_id=p_call_id AND n.user_id=auth.uid()
 AND auth.uid() IN(c.requester_id,c.invited_id)
 LIMIT 1;
$$;
REVOKE ALL ON FUNCTION public.cpp_live_note_get(uuid) FROM public,anon;
GRANT EXECUTE ON FUNCTION public.cpp_live_note_get(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.cpp_live_note_save(p_call_id uuid,p_starred boolean,p_memo text DEFAULT '')
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO ''
AS $$
BEGIN
 IF auth.uid() IS NULL OR p_starred IS NULL OR p_memo IS NULL OR char_length(p_memo)>2000
 OR NOT EXISTS(
   SELECT 1 FROM public.cpp_live_event_calls c
   WHERE c.id=p_call_id
   AND c.started_at IS NOT NULL
   AND auth.uid() IN(c.requester_id,c.invited_id)
 ) THEN
   RAISE EXCEPTION 'Not permitted' USING errcode='42501';
 END IF;
 INSERT INTO public.cpp_live_call_notes(call_id,user_id,starred,memo)
 VALUES(p_call_id,auth.uid(),p_starred,p_memo)
 ON CONFLICT(call_id,user_id) DO UPDATE
 SET starred=excluded.starred,memo=excluded.memo,updated_at=now();
END $$;
REVOKE ALL ON FUNCTION public.cpp_live_note_save(uuid,boolean,text) FROM public,anon;
GRANT EXECUTE ON FUNCTION public.cpp_live_note_save(uuid,boolean,text) TO authenticated;
