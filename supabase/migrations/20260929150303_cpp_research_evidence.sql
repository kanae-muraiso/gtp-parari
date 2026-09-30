-- Research activity evidence submitted by applicants. This is a self-report,
-- and must not be presented as CPP verification or ORCID authentication.
alter table public.cpp_profiles
  add column research_evidence text,
  add column research_evidence_deferred boolean not null default true,
  add column research_evidence_updated_at timestamptz;

alter table public.cpp_profiles
  add constraint cpp_research_evidence_choice check (
    research_evidence_deferred or nullif(btrim(research_evidence), '') is not null
  );

-- A private review queue for staff; older profiles with no submission are included.
create index cpp_research_evidence_queue_idx
  on public.cpp_profiles (research_evidence_deferred, research_evidence_updated_at);
