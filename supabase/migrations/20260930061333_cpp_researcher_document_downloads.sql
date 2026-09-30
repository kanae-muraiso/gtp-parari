drop policy cpp_documents_select_authorized on storage.objects;
create policy cpp_documents_select_authorized on storage.objects for select to authenticated using (
 bucket_id='cpp-documents' and ((storage.foldername(name))[1]=auth.uid()::text or (
 storage.allow_any_operation(array['object.get_authenticated','object.get_authenticated_info'])
 and exists(select 1 from public.cpp_research_summaries s where s.pdf_path=objects.name and cpp_security.can_read_researcher(s.user_id))
 ))
);
