-- CPP researcher details are never generally public.
create table cpp_private.company_researcher_access (
 company_id uuid primary key references public.cpp_companies(id) on delete cascade,
 payment_reference text not null check(length(trim(payment_reference))>0),
 verified_by uuid not null references auth.users(id),
 verified_at timestamptz not null default now(),
 valid_until timestamptz not null,
 revoked_at timestamptz
);
alter table cpp_private.company_researcher_access enable row level security;
revoke all on cpp_private.company_researcher_access from public,anon,authenticated;
create function cpp_private.can_read_researcher(p_user uuid) returns boolean language sql stable security definer set search_path='' as $$
 select auth.uid() is not null and (
 auth.uid()=p_user
 or exists(select 1 from cpp_private.mode_users u where u.user_id=auth.uid() and
 (u.mode='admin' or (u.mode='company' and exists(select 1 from public.cpp_profiles p where p.user_id=p_user and p.visibility='published'))))
 or (public.cpp_is_staff(auth.uid()) and not exists(select 1 from cpp_private.mode_users u where u.user_id=auth.uid()))
 or (
 exists(select 1 from public.cpp_profiles p where p.user_id=p_user and p.visibility='published')
 and exists(
 select 1 from public.cpp_company_members cm join cpp_private.company_researcher_access access on access.company_id=cm.company_id
 where cm.user_id=auth.uid() and cm.role in ('owner','editor')
 and (cm.access_expires_at is null or cm.access_expires_at>now())
 and access.revoked_at is null and access.valid_until>now()
 )
 and exists(
 select 1 from public.cpp_matching_context() v join public.membership_members target on target.membership_id=v.membership_id and target.user_id=p_user and target.organization_id=v.view_organization_id and target.status='active'
 where v.organization_key='CPP-C' and v.view_organization_key='CPP-R'
 )
 )
 );
$$;
revoke all on function cpp_private.can_read_researcher(uuid) from public,anon;
-- Only this non-mutating gate is available to RLS; tables remain inaccessible.
grant usage on schema cpp_private to authenticated;
grant execute on function cpp_private.can_read_researcher(uuid) to authenticated;
do $$ declare t text; p record; begin
 foreach t in array array['cpp_profiles','cpp_profile_research_fields','cpp_profile_keywords','cpp_profile_history','cpp_research_summaries','cpp_publications'] loop
 for p in select policyname from pg_policies where schemaname='public' and tablename=t and cmd='SELECT' loop
 execute format('drop policy %I on public.%I',p.policyname,t);
 end loop;
 execute format('create policy %I on public.%I for select to authenticated using (cpp_private.can_read_researcher(user_id))',t||'_select_authorized',t);
 end loop;
end $$;
drop policy if exists cpp_documents_select_authenticated on storage.objects;
drop policy if exists cpp_documents_select_public_published on storage.objects;
create policy cpp_documents_select_authorized on storage.objects for select to authenticated using (
 bucket_id='cpp-documents' and (
 (storage.foldername(name))[1]=auth.uid()::text
 or exists(select 1 from public.cpp_research_summaries s where s.pdf_path=objects.name and cpp_private.can_read_researcher(s.user_id))
 )
);
