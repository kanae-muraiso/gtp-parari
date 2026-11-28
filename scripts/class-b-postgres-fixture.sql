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
