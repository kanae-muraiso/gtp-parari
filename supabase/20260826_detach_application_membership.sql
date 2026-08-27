-- APPLICATION と MEMBERSHIP は独立した機能。
-- APPLICATION entry の確定を契機に
-- membership_members を自動変更しない。

drop trigger if exists
  finalize_application_commitment
on public.application_entries;

drop function if exists
  public.finalize_application_commitment();
