-- CPP administrator-only alumni display mode.
-- Alumni mode MUST NOT grant CPP researcher/company matching context.
ALTER TABLE cpp_private.mode_users
  DROP CONSTRAINT mode_users_mode_check;
ALTER TABLE cpp_private.mode_users
  ADD CONSTRAINT mode_users_mode_check
  CHECK (mode IN ('researcher','company','admin','alumni'));

CREATE OR REPLACE FUNCTION public.cpp_set_mode(p_mode text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO ''
AS $function$
BEGIN
  IF auth.uid() IS NULL OR NOT EXISTS (
    SELECT 1 FROM cpp_private.mode_users WHERE user_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'モード切替権限がありません' USING errcode='42501';
  END IF;
  IF p_mode IS NULL OR p_mode NOT IN ('researcher','company','admin','alumni') THEN
    RAISE EXCEPTION 'Invalid mode';
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.live_member_preferences
    WHERE user_id=auth.uid() AND is_live AND live_until>now()
  ) THEN
    RAISE EXCEPTION 'LIVEから退出してからモードを切り替えてください';
  END IF;
  UPDATE cpp_private.mode_users SET mode=p_mode WHERE user_id=auth.uid();
END $function$;

-- Preserve all existing rules, but ensure alumni mode never impersonates
-- company matching membership (the former CASE/ELSE would do exactly that).
CREATE OR REPLACE FUNCTION public.cpp_matching_context()
RETURNS TABLE(
  membership_id uuid, organization_id uuid, organization_key text,
  view_organization_id uuid, view_organization_key text, joined_at timestamptz
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO ''
AS $function$
WITH special AS (
 SELECT m.id membership_id, own_org.id organization_id, own_org.organization_key,
        other_org.id view_organization_id, other_org.organization_key view_organization_key,
        now() joined_at
 FROM cpp_private.mode_users u
 CROSS JOIN LATERAL (
   SELECT id FROM public.memberships WHERE name='CPP' AND membership_mode='matching'
   ORDER BY created_at DESC LIMIT 1
 ) m
 JOIN public.membership_organizations own_org
   ON own_org.membership_id=m.id
  AND own_org.organization_key=CASE u.mode WHEN 'researcher' THEN 'CPP-R' ELSE 'CPP-C' END
 JOIN public.membership_organizations other_org
   ON other_org.membership_id=m.id
  AND other_org.organization_key=CASE u.mode WHEN 'researcher' THEN 'CPP-C' ELSE 'CPP-R' END
 WHERE u.user_id=auth.uid() AND u.mode IN ('researcher','company')
), normal AS (
 SELECT mm.membership_id, mm.organization_id, own_org.organization_key,
        mm.view_organization_id, view_org.organization_key, mm.created_at
 FROM public.membership_members mm
 JOIN public.memberships m ON m.id=mm.membership_id AND m.name='CPP' AND m.membership_mode='matching'
 LEFT JOIN public.membership_organizations own_org ON own_org.id=mm.organization_id
 LEFT JOIN public.membership_organizations view_org ON view_org.id=mm.view_organization_id
 WHERE mm.user_id=auth.uid()
   AND mm.status='active'
   AND (own_org.organization_key<>'CPP-R' OR cardinality(cpp_private.researcher_missing_fields(auth.uid()))=0)
   AND (own_org.organization_key<>'CPP-R'
        OR NOT EXISTS (SELECT 1 FROM public.cpp_alumni a WHERE a.user_id=auth.uid())
        OR EXISTS (SELECT 1 FROM cpp_private.alumni_participation p
                   WHERE p.user_id=auth.uid() AND p.choice='researcher'))
 ORDER BY mm.created_at DESC LIMIT 1
)
SELECT * FROM special
UNION ALL
SELECT * FROM normal
WHERE NOT EXISTS (
 SELECT 1 FROM cpp_private.mode_users WHERE user_id=auth.uid()
);
$function$;
