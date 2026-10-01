-- Match Storage preflight metadata, then persisted metadata. No actual files
-- or permanent accounts are created: all database fixtures are rolled back.
begin;
select set_config('parari.upload_owner',gen_random_uuid()::text,true);
select set_config('parari.upload_other',gen_random_uuid()::text,true);
insert into auth.users(id,email)
select current_setting(k)::uuid,current_setting(k)||'@example.invalid'
from unnest(array['parari.upload_owner','parari.upload_other']) k;
select set_config('request.jwt.claim.sub',current_setting('parari.upload_owner'),true);
set local role authenticated;
do $$ declare path text:=auth.uid()::text||'/cpp-company/rollback/logo.png'; meta jsonb; object_id uuid; begin
 if not private.parari_can_upload_image(path,'{"contentLength":1024,"mimetype":"image/png"}')
 then raise exception 'Storage upload preflight rejected'; end if;
 if not private.parari_can_upload_image(path,'{"size":1024,"mimetype":"image/png"}')
 then raise exception 'Final object metadata rejected'; end if;
 foreach meta in array array[null::jsonb,'{}','{"contentLength":0}','{"contentLength":-1}',
   '{"contentLength":"invalid"}','{"contentLength":"9999999999999999999999999"}',
   '{"size":0,"contentLength":1024}','{"size":"","contentLength":1024}'] loop
   if private.parari_can_upload_image(path,meta) then raise exception 'Invalid size accepted: %',meta; end if;
 end loop;
 if private.parari_can_upload_image(current_setting('parari.upload_other')||'/logo.png','{"contentLength":1024}')
   or private.parari_can_upload_image(null,'{"contentLength":1024}')
 then raise exception 'Foreign or missing owner path accepted'; end if;
 insert into storage.objects(bucket_id,name,owner,metadata)
 values('parari-images',path,auth.uid(),'{"contentLength":1024,"mimetype":"image/png"}') returning id into object_id;
 if object_id is null then raise exception 'Upload INSERT RETURNING failed'; end if;
 update storage.objects set metadata='{"size":1024,"mimetype":"image/png"}' where id=object_id;
 begin
   insert into storage.objects(bucket_id,name,owner,metadata)
   values('parari-images',current_setting('parari.upload_other')||'/logo.png',auth.uid(),'{"contentLength":1024}');
   raise exception 'Foreign owner upload allowed by RLS';
 exception when insufficient_privilege then null; end;
 -- A FREE account already holding 1 KiB may not add a full 100 MiB.
 if private.parari_can_upload_image(auth.uid()::text||'/oversized.png','{"contentLength":104857600}')
 then raise exception 'FREE quota exceeded'; end if;
 begin
   insert into storage.objects(bucket_id,name,metadata)
   values('parari-images',auth.uid()::text||'/oversized.png','{"contentLength":104857600}');
   raise exception 'Quota bypassed through INSERT';
 exception when insufficient_privilege then null; end;
 -- Replacing the same image counts the new size only.
 if not private.parari_can_upload_image(path,'{"contentLength":104857600}')
 then raise exception 'Overwrite counted twice'; end if;
 begin
   update storage.objects set metadata='{"contentLength":104857601}' where id=object_id;
   raise exception 'Quota bypassed through UPDATE';
 exception when insufficient_privilege then null; end;
 -- Storage rejects direct SQL deletes independently of RLS; the transaction
 -- rollback below removes this metadata-only fixture without touching files.
end $$;
reset role;
insert into public.profiles(user_id,is_monitor) values(current_setting('parari.upload_owner')::uuid,true)
on conflict(user_id) do update set is_monitor=true;
set local role authenticated;
do $$ begin
 if not private.parari_can_upload_image(auth.uid()::text||'/logo.png','{"contentLength":104857601}')
 then raise exception 'Existing monitor exemption lost'; end if;
 if private.parari_can_upload_image(auth.uid()::text||'/logo.png',null)
 then raise exception 'Monitor bypassed missing-size validation'; end if;
end $$;
reset role;
select set_config('request.jwt.claim.sub','',true);
set local role anon;
do $$ begin
 begin
   insert into storage.objects(bucket_id,name,metadata)
   values('parari-images',current_setting('parari.upload_owner')||'/anonymous.png','{"contentLength":1024}');
   raise exception 'Anonymous upload allowed';
 exception when insufficient_privilege then null; end;
end $$;
select true as image_preflight_tests_passed;
rollback;
