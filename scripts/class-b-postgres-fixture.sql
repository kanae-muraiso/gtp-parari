-- A clean PostgreSQL 17 service container only. No real data or credentials.
\set ON_ERROR_STOP on
CREATE ROLE anon;
CREATE ROLE authenticated;
CREATE ROLE service_role BYPASSRLS;
CREATE SCHEMA auth;
CREATE TABLE auth.users(id uuid PRIMARY KEY);
CREATE TABLE public.profiles(user_id uuid PRIMARY KEY,is_monitor boolean);
CREATE TABLE public.class_schools(id uuid PRIMARY KEY,owner_user_id uuid NOT NULL REFERENCES auth.users(id),archived_at timestamptz);
CREATE TABLE public.class_feature_plans(school_id uuid PRIMARY KEY REFERENCES class_schools(id),plan text NOT NULL DEFAULT 'a',active_until timestamptz,updated_at timestamptz DEFAULT now());
CREATE TABLE public.school_class_products(id uuid PRIMARY KEY,school_id uuid NOT NULL REFERENCES class_schools(id),design jsonb,UNIQUE(school_id,id));
CREATE TABLE public.commerce_products(id uuid PRIMARY KEY,owner_user_id uuid,product_type text,amount numeric,currency text,billing_interval text,active boolean,square_plan_id text,square_plan_variation_id text);
CREATE TABLE public.square_connections(owner_user_id uuid,environment text,status text,PRIMARY KEY(owner_user_id,environment));
CREATE TABLE public.school_classes(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),school_id uuid NOT NULL REFERENCES class_schools(id),product_id uuid,fee_override_yen int);
CREATE TABLE public.school_enrollments(id uuid PRIMARY KEY,school_id uuid,status text,class_participation text);
CREATE TABLE public.school_class_assignments(school_id uuid,enrollment_id uuid,class_id uuid,self_selected boolean DEFAULT false,PRIMARY KEY(school_id,enrollment_id,class_id));
CREATE TABLE public.school_class_visit_reservations(school_id uuid,enrollment_id uuid,class_id uuid,visit_on date,PRIMARY KEY(enrollment_id,class_id,visit_on));
CREATE TABLE public.applications(id uuid PRIMARY KEY,owner_user_id uuid,class_event_school_id uuid,archived_at timestamptz,status text,class_event jsonb,definition jsonb,payment_method text,payment_amount int,title text);
CREATE FUNCTION public.class_fixed_seat_count_on(p_school uuid,p_class uuid,p_day date) RETURNS integer LANGUAGE sql STABLE SET search_path='' AS $$
 SELECT count(*)::int FROM public.school_class_assignments a JOIN public.school_enrollments e ON e.id=a.enrollment_id
 WHERE a.school_id=p_school AND a.class_id=p_class AND e.status='active' AND (a.self_selected OR e.class_participation<>'flexible')
$$;
GRANT SELECT,INSERT,UPDATE,DELETE ON ALL TABLES IN SCHEMA public TO service_role;
\ir ../docs/class-b-class-blocks-draft.sql
\ir ../docs/class-b-contract-ledger-draft.sql
\ir ../docs/class-b-reconcile-draft.sql
\ir ../docs/class-b-operation-quotas-draft.sql
\ir ../docs/class-b-square-slot-quotas-draft.sql
CREATE TRIGGER class_a_limit_new_class AFTER INSERT OR UPDATE OF school_id ON public.school_classes FOR EACH ROW EXECUTE FUNCTION public.class_a_guard_new_class();
INSERT INTO auth.users VALUES('00000000-0000-4000-8000-000000000001');
INSERT INTO public.class_schools VALUES('00000000-0000-4000-8000-000000000002','00000000-0000-4000-8000-000000000001',NULL);
INSERT INTO public.class_b_contracts(school_id,owner_user_id,attempt_id,requested_blocks) VALUES('00000000-0000-4000-8000-000000000002','00000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000003',1);
SET ROLE service_role;
SELECT public.reconcile_class_b_contract('00000000-0000-4000-8000-000000000002','00000000-0000-4000-8000-000000000003','00000000-0000-4000-8000-000000000001','sub_test','cus_test','active',1,false,now()+interval '30 days');
DO $$ BEGIN IF EXISTS(SELECT 1 FROM public.class_feature_plans WHERE plan='b') THEN RAISE EXCEPTION 'unpaid grant'; END IF; END $$;
SELECT public.reconcile_class_b_contract('00000000-0000-4000-8000-000000000002','00000000-0000-4000-8000-000000000003','00000000-0000-4000-8000-000000000001','sub_test','cus_test','active',1,true,now()+interval '30 days');
DO $$ BEGIN IF NOT EXISTS(SELECT 1 FROM public.class_feature_plans WHERE plan='b' AND class_blocks=1) THEN RAISE EXCEPTION 'missing paid grant'; END IF; END $$;
INSERT INTO public.school_classes(school_id) SELECT '00000000-0000-4000-8000-000000000002'::uuid FROM generate_series(1,4);
RESET ROLE;
DO $$ BEGIN
 IF has_table_privilege('authenticated','public.class_b_contracts','INSERT') OR has_table_privilege('authenticated','public.class_b_contracts','SELECT') OR has_function_privilege('authenticated','public.reconcile_class_b_contract(uuid,uuid,uuid,text,text,text,integer,boolean,timestamptz)','EXECUTE') THEN
 RAISE EXCEPTION 'client access to contract authority'; END IF;
END $$;

-- Membership and service applications are independent from the existing quota/contract ledger.
\ir ../docs/class-business-participation-draft.sql
INSERT INTO auth.users VALUES('00000000-0000-4000-8000-000000000011'),('00000000-0000-4000-8000-000000000012');
INSERT INTO public.class_schools VALUES('00000000-0000-4000-8000-000000000021','00000000-0000-4000-8000-000000000011',NULL);
INSERT INTO public.school_class_products VALUES
 ('00000000-0000-4000-8000-000000000031','00000000-0000-4000-8000-000000000002','{}'),
 ('00000000-0000-4000-8000-000000000032','00000000-0000-4000-8000-000000000002','{}'),
 ('00000000-0000-4000-8000-000000000033','00000000-0000-4000-8000-000000000021','{}');
INSERT INTO public.applications(id,owner_user_id,class_event_school_id,status,class_event,definition,payment_method,payment_amount,title) VALUES
 ('00000000-0000-4000-8000-000000000041','00000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000002','draft','{"startsAt":"2027-01-01T10:00:00+09:00"}','{"capacity":10}','none',0,'Event'),
 ('00000000-0000-4000-8000-000000000042','00000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000002','draft','{"startsAt":"2027-01-01T10:00:00+09:00","sessions":[{"startsAt":"2027-01-01T10:00:00+09:00"}]}','{"capacity":10}','none',0,'Workshop');
SET ROLE service_role;
DO $$
DECLARE s uuid:='00000000-0000-4000-8000-000000000002'; o uuid:='00000000-0000-4000-8000-000000000001'; u uuid:='00000000-0000-4000-8000-000000000012'; foreign_owner uuid:='00000000-0000-4000-8000-000000000011'; a uuid:='00000000-0000-4000-8000-000000000031'; b uuid:='00000000-0000-4000-8000-000000000032'; f uuid:='00000000-0000-4000-8000-000000000033'; e uuid:='00000000-0000-4000-8000-000000000041'; w uuid:='00000000-0000-4000-8000-000000000042';
BEGIN
 IF public.class_service_draft_audience_matches(s,'course',a,u) THEN RAISE EXCEPTION 'Unconfigured service granted'; END IF;
 PERFORM public.save_class_service_intake_design(s,o,'event',e,'everyone','direct','automatic','','onsite');
 IF NOT public.class_service_draft_audience_matches(s,'event',e,null) THEN RAISE EXCEPTION 'Public audience unavailable'; END IF;
 BEGIN PERFORM public.save_class_service_intake_design(s,o,'course',a,'members_only','briefing','review','A terms','recurring'); RAISE EXCEPTION 'Disabled membership accepted'; EXCEPTION WHEN check_violation THEN NULL; END;
 PERFORM public.set_class_business_membership_enabled(s,o,true);
 PERFORM public.save_class_service_intake_design(s,o,'course',a,'members_only','briefing','review','A terms','recurring');
 PERFORM public.save_class_service_intake_design(s,o,'course',b,'everyone','direct','automatic','B terms','free');
 PERFORM public.save_class_service_intake_design(s,o,'workshop',w,'members_only','direct','review','Workshop terms','before');
 IF public.class_service_draft_audience_matches(s,'course',a,u) THEN RAISE EXCEPTION 'Nonmember accepted'; END IF;
 PERFORM public.set_class_business_member(s,o,u,'pending');
 IF public.class_service_draft_audience_matches(s,'course',a,u) THEN RAISE EXCEPTION 'Pending member accepted'; END IF;
 PERFORM public.set_class_business_member(s,o,u,'active');
 IF NOT public.class_service_draft_audience_matches(s,'course',a,u) OR NOT public.class_service_draft_audience_matches(s,'workshop',w,u) THEN RAISE EXCEPTION 'Active member rejected'; END IF;
 IF NOT EXISTS(select 1 from public.class_service_intake_designs where school_id=s and service_id=a and terms='A terms' and entry_route='briefing') OR NOT EXISTS(select 1 from public.class_service_intake_designs where school_id=s and service_id=b and terms='B terms' and entry_route='direct') THEN RAISE EXCEPTION 'Service settings mixed'; END IF;
 BEGIN PERFORM public.save_class_service_intake_design(s,o,'course',f,'everyone','direct','review','','free'); RAISE EXCEPTION 'Cross-school service accepted'; EXCEPTION WHEN invalid_parameter_value THEN NULL; END;
 BEGIN PERFORM public.save_class_service_intake_design(s,o,'event',w,'everyone','direct','review','','free'); RAISE EXCEPTION 'Wrong service kind accepted'; EXCEPTION WHEN invalid_parameter_value THEN NULL; END;
 BEGIN PERFORM public.set_class_business_member(s,foreign_owner,u,'active'); RAISE EXCEPTION 'Foreign owner accepted'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 BEGIN PERFORM public.set_class_business_membership_enabled(s,o,false); RAISE EXCEPTION 'Active membership silently disabled'; EXCEPTION WHEN check_violation THEN NULL; END;
 PERFORM public.set_class_business_member(s,o,u,'ended');
 IF public.class_service_draft_audience_matches(s,'course',a,u) OR NOT public.class_service_draft_audience_matches(s,'course',b,u) OR NOT public.class_service_draft_audience_matches(s,'event',e,u) THEN RAISE EXCEPTION 'Membership ending changes wrong service audience'; END IF;
 IF EXISTS(select 1 from public.school_enrollments) THEN RAISE EXCEPTION 'Membership created a course contract'; END IF;
 IF (select count(*) from public.applications)<>2 THEN RAISE EXCEPTION 'Membership modified services'; END IF;
END $$;
RESET ROLE;
DO $$ BEGIN
 IF has_table_privilege('authenticated','public.class_business_members','SELECT') OR has_table_privilege('authenticated','public.class_service_intake_designs','UPDATE') OR has_function_privilege('anon','public.set_class_business_member(uuid,uuid,uuid,text)','EXECUTE') OR has_function_privilege('authenticated','public.save_class_service_intake_design(uuid,uuid,text,uuid,text,text,text,text,text)','EXECUTE') OR has_table_privilege('service_role','public.class_business_members','INSERT') THEN RAISE EXCEPTION 'Unexpected direct access'; END IF;
END $$;
\echo PASS: independent business membership and per-service application drafts; pending/ended denied, separate settings, cross-school protection, no enrollment side effects.
