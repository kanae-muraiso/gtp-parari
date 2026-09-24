alter table public.cpp_alumni
  drop constraint if exists cpp_alumni_cpp_memory_check;

alter table public.cpp_alumni
  add constraint cpp_alumni_cpp_memory_check
  check (
    char_length(btrim(cpp_memory)) between 1 and 2000
  );

comment on column public.cpp_alumni.cpp_memory is
  'Memory or impression from CPP participation, up to 2000 characters.';
