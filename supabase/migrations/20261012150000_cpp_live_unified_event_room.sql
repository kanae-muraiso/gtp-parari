-- Event-scoped CPP LIVE room for researchers, companies and alumni.
-- This is deliberately separate from CPP-R/CPP-C membership matchmaking.
CREATE TABLE public.cpp_live_event_attendees (
 event_id uuid NOT NULL REFERENCES public.cpp_live_events(id) ON DELETE CASCADE,
 user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
 joined_at timestamptz NOT NULL DEFAULT now(),
 last_seen_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(event_id,user_id)
);
CREATE TABLE public.cpp_live_event_calls (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 event_id uuid NOT NULL REFERENCES public.cpp_live_events(id) ON DELETE CASCADE,
 requester_id uuid NOT NULL REFERENCES auth.users(id),
 invited_id uuid NOT NULL REFERENCES auth.users(id),
 status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','active','declined','ended')),
 created_at timestamptz NOT NULL DEFAULT now(),
 started_at timestamptz,
 ends_at timestamptz,
 CHECK (requester_id <> invited_id),
 CHECK ((status <> 'active') OR (started_at IS NOT NULL AND ends_at IS NOT NULL))
);
CREATE INDEX cpp_live_calls_participants_idx ON public.cpp_live_event_calls(event_id,status,created_at DESC);
CREATE TABLE public.cpp_live_event_messages (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 call_id uuid NOT NULL REFERENCES public.cpp_live_event_calls(id) ON DELETE CASCADE,
 sender_id uuid NOT NULL REFERENCES auth.users(id),
 body text NOT NULL CHECK (char_length(body) BETWEEN 1 AND 2000),
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX cpp_live_event_msgs_idx ON public.cpp_live_event_messages(call_id,created_at,id);
ALTER TABLE public.cpp_live_event_attendees ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cpp_live_event_calls ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cpp_live_event_messages ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.cpp_live_event_attendees,public.cpp_live_event_calls,public.cpp_live_event_messages FROM public,anon,authenticated;

CREATE OR REPLACE FUNCTION cpp_private.live_event_can_enter(p_event uuid,p_user uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO ''
AS $$
 SELECT p_user IS NOT NULL AND p_user=auth.uid() AND EXISTS(
   SELECT 1 FROM public.cpp_live_events e
   WHERE e.id=p_event AND e.status='scheduled'
     AND now()>=e.starts_at AND now()<e.ends_at
     AND (
       EXISTS(SELECT 1 FROM cpp_private.mode_users u WHERE u.user_id=p_user AND u.mode='admin')
       OR (e.is_development AND (
         EXISTS(SELECT 1 FROM public.cpp_alumni a WHERE a.user_id=p_user)
         OR EXISTS(SELECT 1 FROM public.cpp_matching_context())
       ))
       OR (NOT e.is_development AND (
         ('alumni'=ANY(e.audience) AND EXISTS(SELECT 1 FROM public.cpp_alumni a WHERE a.user_id=p_user))
         OR (NOT EXISTS(SELECT 1 FROM public.cpp_alumni a WHERE a.user_id=p_user)
           AND EXISTS(SELECT 1 FROM public.cpp_matching_context() ctx
             WHERE (ctx.organization_key='CPP-R' AND 'researcher'=ANY(e.audience))
                OR (ctx.organization_key='CPP-C' AND 'company'=ANY(e.audience))))
       ))
     )
 );
$$;
REVOKE ALL ON FUNCTION cpp_private.live_event_can_enter(uuid,uuid) FROM public,anon,authenticated;

CREATE OR REPLACE FUNCTION public.cpp_live_event_join(p_event_id uuid,p_active boolean DEFAULT true)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path TO ''
AS $$
BEGIN
 IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Login required' USING errcode='42501'; END IF;
 IF NOT p_active THEN
   DELETE FROM public.cpp_live_event_attendees WHERE event_id=p_event_id AND user_id=auth.uid();
   RETURN false;
 END IF;
 IF NOT cpp_private.live_event_can_enter(p_event_id,auth.uid()) THEN
   RAISE EXCEPTION 'LIVEに参加できません' USING errcode='42501';
 END IF;
 INSERT INTO public.cpp_live_event_attendees(event_id,user_id)
 VALUES(p_event_id,auth.uid())
 ON CONFLICT(event_id,user_id) DO UPDATE SET last_seen_at=now();
 RETURN true;
END $$;
REVOKE ALL ON FUNCTION public.cpp_live_event_join(uuid,boolean) FROM public,anon;
GRANT EXECUTE ON FUNCTION public.cpp_live_event_join(uuid,boolean) TO authenticated;

CREATE OR REPLACE FUNCTION public.cpp_live_event_roster(p_event_id uuid)
RETURNS TABLE(user_id uuid,display_name text,photo_url text,live_role text,is_me boolean)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO ''
AS $$
 SELECT a.user_id,
 coalesce(nullif(s.display_name,''),nullif(p.display_name,''),'CPP参加者')::text,
 coalesce(s.photo_url,p.avatar_url),
 CASE WHEN EXISTS(SELECT 1 FROM cpp_private.mode_users u WHERE u.user_id=a.user_id AND u.mode='admin') THEN 'admin'
      WHEN EXISTS(SELECT 1 FROM public.cpp_alumni al WHERE al.user_id=a.user_id) THEN 'alumni'
      WHEN EXISTS(SELECT 1 FROM cpp_private.mode_users u WHERE u.user_id=a.user_id AND u.mode='company') THEN 'company'
      WHEN EXISTS(SELECT 1 FROM public.cpp_matching_context() c WHERE c.organization_key='CPP-C' AND a.user_id=auth.uid()) THEN 'company'
      ELSE 'researcher' END::text,
 (a.user_id=auth.uid())
 FROM public.cpp_live_event_attendees a
 LEFT JOIN public.parari_social_profiles s ON s.user_id=a.user_id
 LEFT JOIN public.profiles p ON p.user_id=a.user_id
 WHERE a.event_id=p_event_id AND a.last_seen_at>now()-interval '90 seconds'
   AND cpp_private.live_event_can_enter(p_event_id,auth.uid())
 ORDER BY a.joined_at,a.user_id;
$$;
REVOKE ALL ON FUNCTION public.cpp_live_event_roster(uuid) FROM public,anon;
GRANT EXECUTE ON FUNCTION public.cpp_live_event_roster(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.cpp_live_event_request(p_event_id uuid,p_target_id uuid)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO ''
AS $$
DECLARE v_id uuid;
BEGIN
 IF NOT cpp_private.live_event_can_enter(p_event_id,auth.uid()) OR auth.uid()=p_target_id OR p_target_id IS NULL
 THEN RAISE EXCEPTION 'Not permitted' USING errcode='42501'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.cpp_live_event_attendees a
   WHERE a.event_id=p_event_id AND a.user_id=auth.uid() AND a.last_seen_at>now()-interval '90 seconds')
 OR NOT EXISTS(SELECT 1 FROM public.cpp_live_event_attendees a
   WHERE a.event_id=p_event_id AND a.user_id=p_target_id AND a.last_seen_at>now()-interval '90 seconds')
 THEN RAISE EXCEPTION 'Both users must be present' USING errcode='42501'; END IF;
 IF EXISTS(SELECT 1 FROM public.cpp_live_event_calls c WHERE c.event_id=p_event_id
   AND c.status IN ('pending','active') AND (auth.uid() IN (c.requester_id,c.invited_id)
          OR p_target_id IN (c.requester_id,c.invited_id))
   AND (c.status='pending' AND c.created_at>now()-interval '2 minutes'
     OR c.status='active' AND c.ends_at>now()))
 THEN RAISE EXCEPTION 'There is already a pending/active conversation'; END IF;
 INSERT INTO public.cpp_live_event_calls(event_id,requester_id,invited_id)
 VALUES(p_event_id,auth.uid(),p_target_id) RETURNING id INTO v_id;
 RETURN v_id;
END $$;
REVOKE ALL ON FUNCTION public.cpp_live_event_request(uuid,uuid) FROM public,anon;
GRANT EXECUTE ON FUNCTION public.cpp_live_event_request(uuid,uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.cpp_live_event_respond(p_call_id uuid,p_accept boolean)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO ''
AS $$
DECLARE c public.cpp_live_event_calls%rowtype; v_ends timestamptz;
BEGIN
 SELECT * INTO c FROM public.cpp_live_event_calls WHERE id=p_call_id FOR UPDATE;
 IF NOT FOUND OR c.invited_id<>auth.uid() OR c.status<>'pending'
    OR c.created_at<now()-interval '2 minutes'
    OR NOT cpp_private.live_event_can_enter(c.event_id,auth.uid())
 THEN RAISE EXCEPTION 'Request is no longer available' USING errcode='42501'; END IF;
 IF NOT p_accept THEN
   UPDATE public.cpp_live_event_calls SET status='declined' WHERE id=p_call_id;
   RETURN;
 END IF;
 SELECT least(now()+interval '10 minutes',e.ends_at) INTO v_ends
 FROM public.cpp_live_events e WHERE e.id=c.event_id;
 UPDATE public.cpp_live_event_calls SET status='active',started_at=now(),ends_at=v_ends WHERE id=p_call_id;
END $$;
REVOKE ALL ON FUNCTION public.cpp_live_event_respond(uuid,boolean) FROM public,anon;
GRANT EXECUTE ON FUNCTION public.cpp_live_event_respond(uuid,boolean) TO authenticated;

CREATE OR REPLACE FUNCTION public.cpp_live_event_my_calls(p_event_id uuid)
RETURNS TABLE(id uuid,requester_id uuid,invited_id uuid,status text,created_at timestamptz,ends_at timestamptz)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO ''
AS $$
 SELECT c.id,c.requester_id,c.invited_id,
 CASE WHEN c.status='active' AND c.ends_at<=now() THEN 'ended'
      WHEN c.status='pending' AND c.created_at<now()-interval '2 minutes' THEN 'ended'
      ELSE c.status END,c.created_at,c.ends_at
 FROM public.cpp_live_event_calls c WHERE c.event_id=p_event_id
 AND auth.uid() IN (c.requester_id,c.invited_id)
 AND cpp_private.live_event_can_enter(p_event_id,auth.uid())
 AND c.created_at>now()-interval '1 day'
 ORDER BY c.created_at DESC LIMIT 20;
$$;
REVOKE ALL ON FUNCTION public.cpp_live_event_my_calls(uuid) FROM public,anon;
GRANT EXECUTE ON FUNCTION public.cpp_live_event_my_calls(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.cpp_live_event_send(p_call_id uuid,p_body text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO ''
AS $$
DECLARE c public.cpp_live_event_calls%rowtype; v_id uuid;
BEGIN
 SELECT * INTO c FROM public.cpp_live_event_calls WHERE id=p_call_id;
 IF NOT FOUND OR auth.uid() NOT IN (c.requester_id,c.invited_id)
  OR c.status<>'active' OR c.ends_at<=now()
  OR NOT cpp_private.live_event_can_enter(c.event_id,auth.uid())
 THEN RAISE EXCEPTION 'Conversation ended or access denied' USING errcode='42501'; END IF;
 INSERT INTO public.cpp_live_event_messages(call_id,sender_id,body)
 VALUES(p_call_id,auth.uid(),trim(p_body)) RETURNING id INTO v_id;
 RETURN v_id;
END $$;
REVOKE ALL ON FUNCTION public.cpp_live_event_send(uuid,text) FROM public,anon;
GRANT EXECUTE ON FUNCTION public.cpp_live_event_send(uuid,text) TO authenticated;

CREATE OR REPLACE FUNCTION public.cpp_live_event_chat(p_call_id uuid)
RETURNS TABLE(sender_id uuid,body text,created_at timestamptz)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO ''
AS $$
 SELECT m.sender_id,m.body,m.created_at FROM public.cpp_live_event_messages m
 JOIN public.cpp_live_event_calls c ON c.id=m.call_id
 WHERE m.call_id=p_call_id AND auth.uid() IN (c.requester_id,c.invited_id)
 AND cpp_private.live_event_can_enter(c.event_id,auth.uid())
 ORDER BY m.created_at,m.id LIMIT 200;
$$;
REVOKE ALL ON FUNCTION public.cpp_live_event_chat(uuid) FROM public,anon;
GRANT EXECUTE ON FUNCTION public.cpp_live_event_chat(uuid) TO authenticated;
