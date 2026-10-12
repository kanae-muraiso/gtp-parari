-- Test events are private to administrator mode, never discoverable or open to ordinary users.
ALTER TABLE public.cpp_live_events
  ADD COLUMN IF NOT EXISTS is_development boolean NOT NULL DEFAULT false;

CREATE OR REPLACE FUNCTION public.cpp_live_upcoming_events()
 RETURNS TABLE(id uuid, title text, starts_at timestamptz, ends_at timestamptz, source_timezone text, audience text[], can_enter boolean)
 LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO ''
AS $function$
 WITH identity AS (
   SELECT CASE
     WHEN EXISTS (SELECT 1 FROM cpp_private.mode_users u WHERE u.user_id=auth.uid() AND u.mode='admin') THEN 'admin'
     WHEN EXISTS (SELECT 1 FROM public.cpp_alumni a WHERE a.user_id=auth.uid()) THEN 'alumni'
     WHEN EXISTS (SELECT 1 FROM cpp_private.mode_users u WHERE u.user_id=auth.uid()) THEN
       (SELECT u.mode FROM cpp_private.mode_users u WHERE u.user_id=auth.uid())
     WHEN EXISTS (SELECT 1 FROM public.cpp_matching_context() c WHERE c.organization_key='CPP-R') THEN 'researcher'
     WHEN EXISTS (SELECT 1 FROM public.cpp_matching_context() c WHERE c.organization_key='CPP-C') THEN 'company'
     ELSE 'none'
   END AS live_role
 )
 SELECT e.id,e.title,e.starts_at,e.ends_at,e.source_timezone,e.audience,
   (now()>=e.starts_at AND now()<e.ends_at AND (
    identity.live_role='admin' OR
    (NOT e.is_development AND identity.live_role=ANY(e.audience))
   )) can_enter
 FROM public.cpp_live_events e CROSS JOIN identity
 WHERE e.status='scheduled'
   AND (NOT e.is_development OR identity.live_role='admin')
   AND e.ends_at>=now() AND e.starts_at<now()+interval '90 days'
 ORDER BY e.starts_at ASC LIMIT 30;
$function$;

CREATE OR REPLACE FUNCTION cpp_private.cpp_live_gate_open(p_user_id uuid)
 RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO ''
AS $function$
SELECT p_user_id IS NOT NULL AND EXISTS(
 SELECT 1 FROM public.cpp_live_events e
 WHERE e.status='scheduled' AND now()>=e.starts_at AND now()<e.ends_at
 AND (NOT e.is_development OR EXISTS(
   SELECT 1 FROM cpp_private.mode_users u WHERE u.user_id=p_user_id AND u.mode='admin'
 ))
 AND (
 EXISTS(SELECT 1 FROM cpp_private.mode_users u WHERE u.user_id=p_user_id AND u.mode='admin')
 OR ('alumni'=ANY(e.audience) AND EXISTS(SELECT 1 FROM public.cpp_alumni a WHERE a.user_id=p_user_id))
 OR (NOT EXISTS(SELECT 1 FROM public.cpp_alumni a WHERE a.user_id=p_user_id)
     AND EXISTS(SELECT 1 FROM public.cpp_matching_context() ctx
        WHERE (ctx.organization_key='CPP-R' AND 'researcher'=ANY(e.audience))
           OR (ctx.organization_key='CPP-C' AND 'company'=ANY(e.audience))))
 )
);
$function$;

CREATE OR REPLACE FUNCTION public.cpp_live_create_development_event()
 RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO ''
AS $function$
DECLARE result uuid;
BEGIN
 IF auth.uid() IS NULL OR NOT EXISTS (
   SELECT 1 FROM cpp_private.mode_users u
   WHERE u.user_id=auth.uid() AND u.mode='admin'
 ) THEN RAISE EXCEPTION '管理者モードが必要です' USING errcode='42501'; END IF;
 INSERT INTO public.cpp_live_events(
   title,starts_at,ends_at,source_timezone,audience,status,created_by,is_development
 ) VALUES (
   'CPP LIVE 開発用テスト',now()-interval '1 minute',now()+interval '60 minutes',
   'Asia/Tokyo',ARRAY['researcher','company','alumni']::text[],'scheduled',auth.uid(),true
 ) RETURNING id INTO result;
 RETURN result;
END;
$function$;
REVOKE ALL ON FUNCTION public.cpp_live_create_development_event() FROM public,anon;
GRANT EXECUTE ON FUNCTION public.cpp_live_create_development_event() TO authenticated;
