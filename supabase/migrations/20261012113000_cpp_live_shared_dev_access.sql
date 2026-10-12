-- Development events: invitation by URL, authenticated CPP members only.
-- Ordinary public calendar remains free of development entries.
CREATE OR REPLACE FUNCTION cpp_private.cpp_live_gate_open(p_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO ''
AS $$
 SELECT p_user_id IS NOT NULL AND p_user_id=auth.uid() AND EXISTS (
   SELECT 1 FROM public.cpp_live_events e
   WHERE e.status='scheduled' AND now()>=e.starts_at AND now()<e.ends_at
     AND (
       EXISTS(SELECT 1 FROM cpp_private.mode_users u WHERE u.user_id=p_user_id AND u.mode='admin')
       OR (e.is_development AND (
         EXISTS(SELECT 1 FROM public.cpp_alumni a WHERE a.user_id=p_user_id)
         OR EXISTS(SELECT 1 FROM public.cpp_matching_context())
       ))
       OR (NOT e.is_development AND
         (('alumni'=ANY(e.audience) AND EXISTS(SELECT 1 FROM public.cpp_alumni a WHERE a.user_id=p_user_id))
           OR (NOT EXISTS(SELECT 1 FROM public.cpp_alumni a WHERE a.user_id=p_user_id)
             AND EXISTS(SELECT 1 FROM public.cpp_matching_context() ctx
                WHERE (ctx.organization_key='CPP-R' AND 'researcher'=ANY(e.audience))
                   OR (ctx.organization_key='CPP-C' AND 'company'=ANY(e.audience))))
         ))
     )
 );
$$;

CREATE OR REPLACE FUNCTION public.cpp_live_event_access(p_event_id uuid)
RETURNS TABLE(id uuid,title text,starts_at timestamptz,ends_at timestamptz,
              source_timezone text,audience text[],can_enter boolean)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO ''
AS $$
 WITH user_role AS (
   SELECT
     EXISTS(SELECT 1 FROM cpp_private.mode_users u WHERE u.user_id=auth.uid() AND u.mode='admin') AS admin,
     EXISTS(SELECT 1 FROM public.cpp_alumni a WHERE a.user_id=auth.uid()) AS alumni,
     EXISTS(SELECT 1 FROM public.cpp_matching_context() c WHERE c.organization_key='CPP-R') AS researcher,
     EXISTS(SELECT 1 FROM public.cpp_matching_context() c WHERE c.organization_key='CPP-C') AS company
 )
 SELECT e.id,e.title,e.starts_at,e.ends_at,e.source_timezone,e.audience,
        (now()>=e.starts_at AND now()<e.ends_at AND
          (r.admin OR
           (e.is_development AND (r.alumni OR r.researcher OR r.company)) OR
           (NOT e.is_development AND
             (('alumni'=ANY(e.audience) AND r.alumni)
              OR (NOT r.alumni AND
                 (('researcher'=ANY(e.audience) AND r.researcher)
                  OR ('company'=ANY(e.audience) AND r.company))))))
        ) AS can_enter
 FROM public.cpp_live_events e CROSS JOIN user_role r
 WHERE e.id=p_event_id AND e.status='scheduled' AND auth.uid() IS NOT NULL
   AND (NOT e.is_development OR r.admin OR r.alumni OR r.researcher OR r.company);
$$;
REVOKE ALL ON FUNCTION public.cpp_live_event_access(uuid) FROM public,anon;
GRANT EXECUTE ON FUNCTION public.cpp_live_event_access(uuid) TO authenticated;
