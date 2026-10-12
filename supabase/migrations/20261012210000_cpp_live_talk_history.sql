-- Private history of conversations a member actually participated in.
-- Historical access does not require the LIVE event to still be running.
CREATE OR REPLACE FUNCTION public.cpp_live_my_talk_history()
RETURNS TABLE(call_id uuid,event_id uuid,event_title text,started_at timestamptz,
 ended_at timestamptz,partner_id uuid,display_name text,photo_url text,
 affiliation text,role_title text,topics text[],intro text,starred boolean,memo text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO ''
AS $$
 SELECT c.id,c.event_id,e.title::text,c.started_at,c.ends_at,
 CASE WHEN c.requester_id=auth.uid() THEN c.invited_id ELSE c.requester_id END,
 coalesce(nullif(s.display_name,''),nullif(p.display_name,''),'CPP参加者')::text,
 coalesce(s.photo_url,p.avatar_url),s.affiliation,s.role_title,s.topics,s.intro,
 coalesce(n.starred,false),coalesce(n.memo,'')
 FROM public.cpp_live_event_calls c
 JOIN public.cpp_live_events e ON e.id=c.event_id
 LEFT JOIN public.parari_social_profiles s ON s.user_id=
  CASE WHEN c.requester_id=auth.uid() THEN c.invited_id ELSE c.requester_id END
 LEFT JOIN public.profiles p ON p.user_id=
  CASE WHEN c.requester_id=auth.uid() THEN c.invited_id ELSE c.requester_id END
 LEFT JOIN public.cpp_live_call_notes n ON n.call_id=c.id AND n.user_id=auth.uid()
 WHERE auth.uid() IS NOT NULL
 AND auth.uid() IN(c.requester_id,c.invited_id)
 AND c.started_at IS NOT NULL
 ORDER BY c.started_at DESC,c.id DESC
 LIMIT 200;
$$;
REVOKE ALL ON FUNCTION public.cpp_live_my_talk_history() FROM public,anon;
GRANT EXECUTE ON FUNCTION public.cpp_live_my_talk_history() TO authenticated;
