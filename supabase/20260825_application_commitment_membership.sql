-- PARARI APPLICATION commitment -> MEMBERSHIP
-- 2026-08-25 JST
--
-- APPLICATION entry が confirmed になった時点で、
-- 申込時 snapshot に含まれる MEMBERSHIP を成立させる。
--
-- live な applications.definition ではなく、
-- application_entries.application_snapshot を使用する。
--
-- INSERT時点ですでに confirmed の場合と、
-- UPDATEで confirmed になった場合の両方を処理する。

create or replace function
  public.finalize_application_commitment()
returns trigger
language plpgsql
as $$
begin
  -- confirmed でなければ何もしない。
  if new.status <> 'confirmed' then
    return new;
  end if;

  -- APPLICATIONはログイン必須だが、
  -- 念のため user_id が無いentryは処理しない。
  if new.user_id is null then
    return new;
  end if;

  -- confirmed済みentryへの通常更新では再処理しない。
  if
    tg_op = 'UPDATE'
    and old.status = 'confirmed'
  then
    return new;
  end if;

  -- blocks を持たない旧APPLICATION / CALENDAR予約はそのまま。
  if
    coalesce(
      jsonb_typeof(
        new.application_snapshot
          -> 'definition'
          -> 'blocks'
      ),
      ''
    ) <> 'array'
  then
    return new;
  end if;

  insert into public.membership_members (
    membership_id,
    user_id
  )
  select distinct
    (block ->> 'membershipId')::uuid,
    new.user_id
  from jsonb_array_elements(
    new.application_snapshot
      -> 'definition'
      -> 'blocks'
  ) as blocks(block)
  where
    block ->> 'type' = 'membership'
    and coalesce(
      block ->> 'membershipId',
      ''
    ) ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'

  on conflict (
    membership_id,
    user_id
  )
  do update
  set
    status = 'active',
    source_recruitment_id = null,
    updated_at = now()
  where
    public.membership_members.status
      in ('pending', 'ended');

  -- suspended は管理上の停止状態として尊重し、
  -- APPLICATION承認だけでは自動解除しない。

  return new;
end;
$$;


drop trigger if exists
  finalize_application_commitment
on public.application_entries;


create trigger
  finalize_application_commitment
after insert or update
on public.application_entries
for each row
execute function
  public.finalize_application_commitment();
