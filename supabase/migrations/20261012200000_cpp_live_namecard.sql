-- CPP LIVE nametag: only authenticated attendees of the same active event
-- may inspect an attendee's opt-in social profile information.
CREATE OR REPLACE FUNCTION public.cpp_live_event_namecard(p_event_id uuid,p_user_id uuid)
RETURNS TABLE(display_name text,photo_url text,live_role text,affiliation text,role_title text,topics text[],intro text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO ''
AS $$
 SELECT coalesce(nullif(s.display_name,''),nullif(p.display_name,''),'CPP参加者')::text,
        coalesce(s.photo_url,p.avatar_url),
        CASE WHEN EXISTS(SELECT 1 FROM cpp_private.mode_users u WHERE u.user_id=p_user_id AND u.mode='admin') THEN 'admin'
             WHEN EXISTS(SELECT 1 FROM public.cpp_alumni al WHERE al.user_id=p_user_id) THEN 'alumni'
             WHEN EXISTS(SELECT 1 FROM cpp_private.mode_users u WHERE u.user_id=p_user_id AND u.mode='company') THEN 'company'
             ELSE 'researcher' END::text,
        s.affiliation,s.role_title,s.topics,s.intro
 FROM public.cpp_live_event_attendees target
 LEFT JOIN public.parari_social_profiles s ON s.user_id=target.user_id
 LEFT JOIN public.profiles p ON p.user_id=target.user_id
 WHERE target.event_id=p_event_id AND target.user_id=p_user_id
 AND cpp_private.live_event_can_enter(p_event_id,auth.uid())
 AND EXISTS (SELECT 1 FROM public.cpp_live_event_attendees me
   WHERE me.event_id=p_event_id AND me.user_id=auth.uid()
   AND me.last_seen_at>now()-interval '90 seconds')
 LIMIT 1;
$$;
REVOKE ALL ON FUNCTION public.cpp_live_event_namecard(uuid,uuid) FROM public,anon;
GRANT EXECUTE ON FUNCTION public.cpp_live_event_namecard(uuid,uuid) TO authenticated;
