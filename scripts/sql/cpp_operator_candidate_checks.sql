-- Guardrails: admin identity is independent of the selected display mode.
-- Read-only sanity checks. No production account changes.
DO $$
DECLARE operator_id uuid; ordinary_id uuid;
BEGIN
 SELECT user_id INTO operator_id FROM cpp_private.mode_users LIMIT 1;
 SELECT mm.user_id INTO ordinary_id FROM public.membership_members mm
 WHERE NOT EXISTS (SELECT 1 FROM cpp_private.mode_users u WHERE u.user_id=mm.user_id)
 LIMIT 1;
 IF operator_id IS NOT NULL AND NOT cpp_private.is_operator_account(operator_id) THEN
   RAISE EXCEPTION 'Operator flag failed';
 END IF;
 IF ordinary_id IS NOT NULL AND cpp_private.is_operator_account(ordinary_id) THEN
   RAISE EXCEPTION 'Ordinary member incorrectly flagged as operator';
 END IF;
END $$;
