create or replace function public.regenerate_class_join_code(target_class_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  generated_token text;
begin
  if not public.is_active_account() then
    raise exception 'Active account required' using errcode = '42501';
  end if;

  if not public.owns_class(target_class_id) or not exists (
    select 1
    from public.classes
    where id = target_class_id
      and archived_at is null
  ) then
    raise exception 'Class owner required' using errcode = '42501';
  end if;

  loop
    generated_token := encode(extensions.gen_random_bytes(12), 'hex');
    begin
      update public.classes
      set join_code_hash = encode(extensions.digest(generated_token, 'sha256'), 'hex')
      where id = target_class_id;
      exit;
    exception when unique_violation then
      null;
    end;
  end loop;

  return jsonb_build_object('joinCode', generated_token);
end;
$$;

revoke all on function public.regenerate_class_join_code(uuid) from public;
grant execute on function public.regenerate_class_join_code(uuid) to authenticated;
