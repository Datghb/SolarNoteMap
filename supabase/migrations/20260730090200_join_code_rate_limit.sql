begin;

create table if not exists public.class_join_attempt_limits (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  failed_attempts integer not null default 0 check (failed_attempts >= 0),
  window_started timestamptz not null default now(),
  locked_until timestamptz
);

alter table public.class_join_attempt_limits enable row level security;
revoke all on public.class_join_attempt_limits from authenticated;

revoke execute on function public.create_class_with_code(text, text, text) from authenticated;

create or replace function public.create_class_secure(class_name text, class_description text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  new_class_id uuid;
  generated_token text;
begin
  if not public.is_teacher() then raise exception 'Teacher role required'; end if;
  if char_length(trim(class_name)) not between 1 and 120 then raise exception 'Invalid class name'; end if;
  loop
    generated_token := encode(extensions.gen_random_bytes(12), 'hex');
    begin
      insert into public.classes (teacher_id, name, description, join_code_hash)
      values (auth.uid(), trim(class_name), left(coalesce(class_description, ''), 2000), encode(extensions.digest(generated_token, 'sha256'), 'hex'))
      returning id into new_class_id;
      exit;
    exception when unique_violation then
      null;
    end;
  end loop;
  insert into public.class_memberships (class_id, user_id, role) values (new_class_id, auth.uid(), 'teacher');
  return jsonb_build_object('classId', new_class_id, 'joinCode', generated_token);
end;
$$;
revoke all on function public.create_class_secure(text, text) from public;
grant execute on function public.create_class_secure(text, text) to authenticated;

create or replace function public.join_class(join_token text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  target_class_id uuid;
  clean_token text := trim(join_token);
  attempts public.class_join_attempt_limits%rowtype;
begin
  if auth.uid() is null or clean_token !~ '^[A-Za-z0-9_-]{8,64}$' then return null; end if;

  insert into public.class_join_attempt_limits (user_id) values (auth.uid())
  on conflict (user_id) do nothing;
  select * into attempts from public.class_join_attempt_limits where user_id = auth.uid() for update;

  if attempts.locked_until is not null and attempts.locked_until > now() then return null; end if;
  if attempts.window_started < now() - interval '15 minutes' then
    update public.class_join_attempt_limits
    set failed_attempts = 0, window_started = now(), locked_until = null
    where user_id = auth.uid();
    attempts.failed_attempts := 0;
  end if;

  select id into target_class_id from public.classes
  where join_code_hash = encode(extensions.digest(clean_token, 'sha256'), 'hex') and archived_at is null;

  if target_class_id is null then
    update public.class_join_attempt_limits
    set failed_attempts = failed_attempts + 1,
        locked_until = case when failed_attempts + 1 >= 10 then now() + interval '15 minutes' else null end
    where user_id = auth.uid();
    return null;
  end if;

  delete from public.class_join_attempt_limits where user_id = auth.uid();
  insert into public.class_memberships (class_id, user_id, role)
  values (target_class_id, auth.uid(), 'student')
  on conflict (class_id, user_id) do nothing;
  return target_class_id;
end;
$$;
revoke all on function public.join_class(text) from public;
grant execute on function public.join_class(text) to authenticated;

commit;
