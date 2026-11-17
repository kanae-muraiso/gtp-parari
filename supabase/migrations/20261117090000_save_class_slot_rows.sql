create function public.save_class_slot_rows(p_owner uuid,p_school uuid,p_rows jsonb)
returns void language plpgsql set search_path='' as $$
declare
  row_data jsonb;
  school_name text;
  slot_id uuid;
  target_product uuid;
begin
  if coalesce(jsonb_typeof(p_rows),'') <> 'array' or jsonb_array_length(p_rows) not between 1 and 12 then
    raise invalid_parameter_value;
  end if;
  select name into school_name from public.class_schools
    where id=p_school and owner_user_id=p_owner and tier='a' and archived_at is null for no key update;
  if not found then raise no_data_found; end if;

  for row_data in select value from jsonb_array_elements(p_rows) order by value->>'id' loop
    slot_id := (row_data->>'id')::uuid;
    target_product := (row_data->>'productId')::uuid;
    if (row_data->>'new')::boolean then
      if target_product is null or not exists (
        select 1 from public.school_class_products where id=target_product and school_id=p_school
      ) then raise invalid_parameter_value; end if;
      if exists (
        select 1 from public.school_classes where id=slot_id and (school_id<>p_school or product_id is distinct from (row_data->>'productId')::uuid)
      ) then raise no_data_found; end if;
    end if;
    perform public.save_school_priced_slot(
      p_owner,p_school,slot_id,(row_data->>'new')::boolean,school_name,row_data->>'name',
      (row_data->>'date')::date,(row_data->>'time')::time,row_data->>'cadence',row_data->>'location',
      row_data->>'delivery',row_data->>'meetingUrl',(row_data->>'duration')::integer,
      case when (row_data->>'new')::boolean then target_product else null end,(row_data->>'fee')::integer
    );
    perform public.save_class_schedule_rules(p_owner,p_school,slot_id,row_data->'rules');
  end loop;
end;
$$;

revoke all on function public.save_class_slot_rows(uuid,uuid,jsonb) from public,anon,authenticated;
grant execute on function public.save_class_slot_rows(uuid,uuid,jsonb) to service_role;
