create or replace function public.normalize_application_calendar_payment_amount()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if jsonb_typeof(new.definition) = 'object'
     and jsonb_typeof(new.definition->'blocks') = 'array'
     and exists (
       select 1
       from jsonb_array_elements(new.definition->'blocks') as block
       where block->>'type' = 'calendar'
     )
  then
    new.payment_amount := null;
  end if;

  return new;
end;
$$;

drop trigger if exists applications_calendar_payment_amount_ssot
on public.applications;

create trigger applications_calendar_payment_amount_ssot
before insert or update of definition, payment_amount
on public.applications
for each row
execute function public.normalize_application_calendar_payment_amount();

revoke all on function public.normalize_application_calendar_payment_amount()
from public, anon, authenticated;

update public.applications a
set payment_amount = null
where payment_amount is not null
  and jsonb_typeof(a.definition->'blocks') = 'array'
  and exists (
    select 1
    from jsonb_array_elements(a.definition->'blocks') as block
    where block->>'type' = 'calendar'
  );
