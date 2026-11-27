-- Draft only. Run after both CLASS B draft schema files, in an isolated test DB first.
begin;
create or replace function public.reconcile_class_b_contract(
  p_school uuid,p_attempt uuid,p_owner uuid,p_subscription text,p_customer text,
  p_status text,p_blocks integer,p_paid boolean,p_period_end timestamptz
) returns void language plpgsql security invoker set search_path to ''
as $function$
declare
  v_contract public.class_b_contracts%rowtype;
  v_status text;
  v_blocks integer;
  v_until timestamptz;
begin
  if p_blocks is null or p_blocks not between 1 and 1000000 or
     p_period_end is null or p_paid is null or
     coalesce(p_subscription,'')='' or coalesce(p_customer,'')='' then
    raise exception 'Invalid CLASS B contract state';
  end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_owner::text,110719));
  select * into v_contract from public.class_b_contracts
    where school_id=p_school and attempt_id=p_attempt and owner_user_id=p_owner for update;
  if not found or not exists(select 1 from public.class_schools
    where id=p_school and owner_user_id=p_owner) then
    raise exception 'Unknown CLASS B contract';
  end if;
  if (v_contract.stripe_subscription_id is not null and v_contract.stripe_subscription_id<>p_subscription)
    or (v_contract.stripe_customer_id is not null and v_contract.stripe_customer_id<>p_customer) then
    raise exception 'Mismatched CLASS B contract';
  end if;
  if v_contract.status='canceled' then return; end if;
  v_blocks:=v_contract.paid_blocks;
  v_until:=v_contract.paid_until;
  if p_status in ('canceled','incomplete_expired') then
    v_status:='canceled'; v_blocks:=0; v_until:=now();
  elsif p_status='active' and p_paid and p_period_end>now() then
    -- Do not overwrite a later paid period with an older one.
    if v_until is not null and p_period_end<v_until then return; end if;
    v_status:='active'; v_blocks:=p_blocks; v_until:=p_period_end;
  elsif p_status in ('past_due','unpaid','paused') then
    -- Do not extend access on failed invoices. Preserve only already paid time.
    v_status:='past_due';
  else
    v_status:=v_contract.status;
  end if;
  update public.class_b_contracts set stripe_subscription_id=p_subscription,
    stripe_customer_id=p_customer,status=v_status,paid_blocks=v_blocks,
    paid_until=v_until,updated_at=now()
    where school_id=p_school;
  if v_blocks>0 and v_until>now() then
    insert into public.class_feature_plans(school_id,plan,class_blocks,active_until,updated_at)
    values(p_school,'b',v_blocks,v_until,now())
    on conflict(school_id) do update set plan=excluded.plan,class_blocks=excluded.class_blocks,
      active_until=excluded.active_until,updated_at=excluded.updated_at;
  else
    update public.class_feature_plans set plan='a',class_blocks=1,active_until=now(),updated_at=now()
      where school_id=p_school;
  end if;
end;
$function$;
revoke all on function public.reconcile_class_b_contract(uuid,uuid,uuid,text,text,text,integer,boolean,timestamptz) from public,anon,authenticated;
grant execute on function public.reconcile_class_b_contract(uuid,uuid,uuid,text,text,text,integer,boolean,timestamptz) to service_role;
commit;
