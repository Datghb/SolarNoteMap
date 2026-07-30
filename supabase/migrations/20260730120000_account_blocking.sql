begin;

alter table public.profiles add column blocked_at timestamptz;
alter table public.profiles add column block_reason text check (block_reason is null or char_length(block_reason) <= 500);

create or replace function public.is_active_account()
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.profiles where id = auth.uid() and blocked_at is null);
$$;
revoke all on function public.is_active_account() from public;
grant execute on function public.is_active_account() to authenticated;

drop policy if exists profiles_update_self on public.profiles;
create policy profiles_update_self on public.profiles for update to authenticated
using (id = auth.uid() and public.is_active_account())
with check (id = auth.uid() and public.is_active_account());

create or replace function public.is_teacher()
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role = 'teacher' and blocked_at is null);
$$;
create or replace function public.is_class_member(target_class_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select public.is_active_account() and exists (
    select 1 from public.class_memberships where class_id = target_class_id and user_id = auth.uid()
  );
$$;

create or replace function public.redeem_teacher_invite(invite_token text)
returns boolean language plpgsql security definer set search_path = '' as $$
declare claimed_id uuid;
begin
  if not public.is_active_account() then raise exception 'Account is blocked' using errcode = '42501'; end if;
  if char_length(invite_token) < 24 then return false; end if;
  if public.is_admin() then raise exception 'Admin role cannot redeem a teacher invite' using errcode = '22023'; end if;
  update public.teacher_invites set redeemed_by = auth.uid(), redeemed_at = now()
  where token_hash = encode(extensions.digest(invite_token, 'sha256'), 'hex')
    and redeemed_at is null and expires_at > now()
  returning id into claimed_id;
  if claimed_id is null then return false; end if;
  update public.profiles set role = 'teacher' where id = auth.uid();
  return true;
end;
$$;
revoke all on function public.redeem_teacher_invite(text) from public;
grant execute on function public.redeem_teacher_invite(text) to authenticated;

create or replace function public.join_class(join_token text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  target_class_id uuid;
  clean_token text := trim(join_token);
  attempts public.class_join_attempt_limits%rowtype;
begin
  if not public.is_active_account() then raise exception 'Account is blocked' using errcode = '42501'; end if;
  if clean_token !~ '^[A-Za-z0-9_-]{8,64}$' then return null; end if;
  insert into public.class_join_attempt_limits (user_id) values (auth.uid()) on conflict (user_id) do nothing;
  select * into attempts from public.class_join_attempt_limits where user_id = auth.uid() for update;
  if attempts.locked_until is not null and attempts.locked_until > now() then return null; end if;
  if attempts.window_started < now() - interval '15 minutes' then
    update public.class_join_attempt_limits set failed_attempts = 0, window_started = now(), locked_until = null where user_id = auth.uid();
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
  values (target_class_id, auth.uid(), 'student') on conflict (class_id, user_id) do nothing;
  return target_class_id;
end;
$$;
revoke all on function public.join_class(text) from public;
grant execute on function public.join_class(text) to authenticated;

drop function if exists public.admin_list_accounts();
create function public.admin_list_accounts()
returns table (
  id uuid, email text, display_name text, role text, created_at timestamptz,
  class_count bigint, blocked_at timestamptz, block_reason text
) language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_admin() then raise exception 'Admin role required' using errcode = '42501'; end if;
  return query
  select p.id, coalesce(u.email, '')::text, p.display_name, p.role::text, p.created_at,
    count(distinct cm.class_id), p.blocked_at, p.block_reason
  from public.profiles p
  join auth.users u on u.id = p.id
  left join public.class_memberships cm on cm.user_id = p.id
  group by p.id, u.email, p.display_name, p.role, p.created_at, p.blocked_at, p.block_reason
  order by p.created_at desc;
end;
$$;
revoke all on function public.admin_list_accounts() from public;
grant execute on function public.admin_list_accounts() to authenticated;

create or replace function public.admin_set_account_blocked(target_user_id uuid, should_block boolean, reason text default null)
returns boolean language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_admin() then raise exception 'Admin role required' using errcode = '42501'; end if;
  if target_user_id = auth.uid() then raise exception 'Admin cannot block their own account' using errcode = '22023'; end if;
  if exists (select 1 from public.profiles where id = target_user_id and role::text = 'admin') then
    raise exception 'Admin accounts are protected' using errcode = '22023';
  end if;
  update public.profiles
  set blocked_at = case when should_block then coalesce(blocked_at, now()) else null end,
      block_reason = case when should_block then nullif(left(trim(coalesce(reason, '')), 500), '') else null end
  where id = target_user_id;
  if not found then raise exception 'Account not found' using errcode = 'P0002'; end if;
  return true;
end;
$$;
revoke all on function public.admin_set_account_blocked(uuid, boolean, text) from public;
grant execute on function public.admin_set_account_blocked(uuid, boolean, text) to authenticated;

-- Role assignment is provisioned outside the account dashboard. Admins manage
-- account status here instead of converting students and teachers.
revoke execute on function public.admin_set_account_role(uuid, text) from authenticated;

create policy active_accounts_courses on public.courses as restrictive for all to authenticated using (public.is_active_account()) with check (public.is_active_account());
create policy active_accounts_classes on public.classes as restrictive for all to authenticated using (public.is_active_account()) with check (public.is_active_account());
create policy active_accounts_memberships on public.class_memberships as restrictive for all to authenticated using (public.is_active_account()) with check (public.is_active_account());
create policy active_accounts_lessons on public.lessons as restrictive for all to authenticated using (public.is_active_account()) with check (public.is_active_account());
create policy active_accounts_notes on public.slide_notes as restrictive for all to authenticated using (public.is_active_account()) with check (public.is_active_account());
create policy active_accounts_maps on public.knowledge_maps as restrictive for all to authenticated using (public.is_active_account()) with check (public.is_active_account());
create policy active_accounts_activities on public.student_activities as restrictive for all to authenticated using (public.is_active_account()) with check (public.is_active_account());
create policy active_accounts_questions on public.community_questions as restrictive for all to authenticated using (public.is_active_account()) with check (public.is_active_account());
create policy active_accounts_answers on public.community_answers as restrictive for all to authenticated using (public.is_active_account()) with check (public.is_active_account());
create policy active_accounts_schedules on public.class_lesson_schedules as restrictive for all to authenticated using (public.is_active_account()) with check (public.is_active_account());
create policy active_accounts_pdfs on storage.objects as restrictive for all to authenticated
using (bucket_id <> 'lesson-pdfs' or public.is_active_account())
with check (bucket_id <> 'lesson-pdfs' or public.is_active_account());

commit;
