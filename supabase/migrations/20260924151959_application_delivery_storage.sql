insert into storage.buckets (
  id,
  name,
  public,
  file_size_limit
)
values (
  'application-delivery',
  'application-delivery',
  false,
  20971520
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit;
