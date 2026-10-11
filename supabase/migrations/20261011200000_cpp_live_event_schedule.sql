-- CPP LIVE event schedule foundation (does not open or close legacy lobby).
CREATE TABLE IF NOT EXISTS public.cpp_live_events (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 title text NOT NULL CHECK (length(trim(title)) BETWEEN 1 AND 120),
 starts_at timestamptz NOT NULL,
 ends_at timestamptz NOT NULL,
 source_timezone text NOT NULL DEFAULT 'Asia/Tokyo',
 audience text[] NOT NULL CHECK (cardinality(audience) BETWEEN 1 AND 3 AND audience <@ ARRAY['alumni','researcher','company']::text[]),
 status text NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled','cancelled')),
 created_by uuid NOT NULL REFERENCES auth.users(id),
 created_at timestamptz NOT NULL DEFAULT now(),
 CONSTRAINT cpp_live_event_time_check CHECK (ends_at > starts_at AND ends_at <= starts_at + interval '12 hours')
);
CREATE INDEX IF NOT EXISTS cpp_live_events_dates_idx ON public.cpp_live_events(starts_at) WHERE status='scheduled';
ALTER TABLE public.cpp_live_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.cpp_live_events FROM public, anon, authenticated;

-- Read-only list exposes no personal information.
CREATE OR REPLACE FUNCTION public.cpp_live_upcoming_events()
RETURNS TABLE(
 id uuid,title text,starts_at timestamptz,ends_at timestamptz,
 source_timezone text,audience text[],can_enter boolean
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO ''
AS $$
 WITH identity AS (
   SELECT CASE
     WHEN EXISTS (SELECT 1 FROM cpp_private.mode_users u WHERE u.user_id=auth.uid()) THEN
       (SELECT u.mode FROM cpp_private.mode_users u WHERE u.user_id=auth.uid())
     WHEN EXISTS (SELECT 1 FROM public.cpp_alumni a WHERE a.user_id=auth.uid()) THEN 'alumni'
     WHEN EXISTS (SELECT 1 FROM public.cpp_matching_context() c WHERE c.organization_key='CPP-R') THEN 'researcher'
     WHEN EXISTS (SELECT 1 FROM public.cpp_matching_context() c WHERE c.organization_key='CPP-C') THEN 'company'
     ELSE 'none'
   END AS live_role
 )
 SELECT e.id,e.title,e.starts_at,e.ends_at,e.source_timezone,e.audience,
        (identity.live_role = ANY(e.audience) AND now() >= e.starts_at AND now() < e.ends_at) can_enter
 FROM public.cpp_live_events e CROSS JOIN identity
 WHERE auth.uid() IS NOT NULL AND e.status='scheduled'
   AND e.ends_at >= now() AND e.starts_at < now()+ interval '90 days'
 ORDER BY e.starts_at ASC LIMIT 30
$$;
REVOKE ALL ON FUNCTION public.cpp_live_upcoming_events() FROM public,anon;
GRANT EXECUTE ON FUNCTION public.cpp_live_upcoming_events() TO authenticated;

CREATE OR REPLACE FUNCTION public.cpp_live_create_event(
 p_title text,p_starts_at timestamptz,p_ends_at timestamptz,
 p_audience text[],p_timezone text DEFAULT 'Asia/Tokyo'
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO ''
AS $$
DECLARE v_id uuid;
BEGIN
 IF auth.uid() IS NULL OR NOT EXISTS (
   SELECT 1 FROM cpp_private.mode_users u WHERE u.user_id=auth.uid() AND u.mode='admin'
 ) THEN RAISE EXCEPTION '管理者モードが必要です' USING errcode='42501'; END IF;
 IF p_starts_at IS NULL OR p_ends_at IS NULL
   OR p_ends_at <= p_starts_at OR p_ends_at > p_starts_at + interval '12 hours'
   OR p_starts_at < now()-interval '1 minute' THEN
     RAISE EXCEPTION '開催日時が正しくありません';
 END IF;
 IF p_audience IS NULL OR cardinality(p_audience) NOT BETWEEN 1 AND 3
   OR NOT p_audience <@ ARRAY['alumni','researcher','company']::text[] THEN
     RAISE EXCEPTION '参加対象が正しくありません';
 END IF;
 IF p_timezone IS NULL OR NOT EXISTS (
   SELECT 1 FROM pg_catalog.pg_timezone_names WHERE name=p_timezone
 ) THEN RAISE EXCEPTION 'タイムゾーンが正しくありません'; END IF;
 INSERT INTO public.cpp_live_events(title,starts_at,ends_at,audience,source_timezone,created_by)
 VALUES (trim(p_title),p_starts_at,p_ends_at,p_audience,p_timezone,auth.uid())
 RETURNING id INTO v_id;
 RETURN v_id;
END $$;
REVOKE ALL ON FUNCTION public.cpp_live_create_event(text,timestamptz,timestamptz,text[],text) FROM public,anon;
GRANT EXECUTE ON FUNCTION public.cpp_live_create_event(text,timestamptz,timestamptz,text[],text) TO authenticated;
