-- scripts/fixtures/cpp-live-test.sql / 2026-10-13 JST
-- PART: Isolated CPP LIVE test dependencies. Never apply to a real project.
-- Membership context is deliberately minimal; event/call/note RPCs come from
-- the repository's actual migrations, not rewritten test implementations.
CREATE ROLE anon NOLOGIN;
CREATE ROLE authenticated NOLOGIN;
CREATE ROLE service_role NOLOGIN BYPASSRLS;
CREATE SCHEMA auth;
CREATE TABLE auth.users(id uuid PRIMARY KEY);
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$
 SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid
$$;
GRANT USAGE ON SCHEMA auth TO anon,authenticated;
CREATE SCHEMA cpp_private;
CREATE TABLE cpp_private.mode_users(user_id uuid PRIMARY KEY,mode text NOT NULL);
CREATE TABLE public.cpp_alumni(user_id uuid PRIMARY KEY);
CREATE TABLE public.membership_organizations(id uuid PRIMARY KEY,organization_key text);
CREATE TABLE public.membership_members(user_id uuid,organization_id uuid,status text);
CREATE FUNCTION public.cpp_matching_context() RETURNS TABLE(organization_key text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT o.organization_key FROM public.membership_members m
 JOIN public.membership_organizations o ON o.id=m.organization_id
 WHERE m.user_id=auth.uid() AND m.status='active'
$$;
CREATE TABLE public.profiles(user_id uuid PRIMARY KEY,display_name text,avatar_url text);
CREATE TABLE public.parari_social_profiles(user_id uuid PRIMARY KEY,display_name text,photo_url text,
 affiliation text,role_title text,topics text[],intro text);
