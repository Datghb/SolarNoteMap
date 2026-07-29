create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role::text = 'admin'
  );
$$;

revoke all on function public.is_admin() from public;
grant execute on function public.is_admin() to authenticated;

create or replace function public.redeem_teacher_invite(invite_token text)
returns boolean language plpgsql security definer set search_path = '' as $$
declare
  claimed_id uuid;
begin
  if auth.uid() is null or char_length(invite_token) < 24 then
    return false;
  end if;
  if public.is_admin() then
    raise exception 'Admin role cannot redeem a teacher invite' using errcode = '22023';
  end if;

  update public.teacher_invites
  set redeemed_by = auth.uid(), redeemed_at = now()
  where token_hash = encode(extensions.digest(invite_token, 'sha256'), 'hex')
    and redeemed_at is null
    and expires_at > now()
  returning id into claimed_id;

  if claimed_id is null then return false; end if;
  update public.profiles set role = 'teacher' where id = auth.uid();
  return true;
end;
$$;

revoke all on function public.redeem_teacher_invite(text) from public;
grant execute on function public.redeem_teacher_invite(text) to authenticated;

create or replace function public.admin_list_accounts()
returns table (
  id uuid,
  email text,
  display_name text,
  role text,
  created_at timestamptz,
  class_count bigint
)
language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_admin() then
    raise exception 'Admin role required' using errcode = '42501';
  end if;

  return query
  select
    p.id,
    coalesce(u.email, '')::text,
    p.display_name,
    p.role::text,
    p.created_at,
    count(distinct cm.class_id)
  from public.profiles p
  join auth.users u on u.id = p.id
  left join public.class_memberships cm on cm.user_id = p.id
  group by p.id, u.email, p.display_name, p.role, p.created_at
  order by p.created_at desc;
end;
$$;

revoke all on function public.admin_list_accounts() from public;
grant execute on function public.admin_list_accounts() to authenticated;

create or replace function public.admin_set_account_role(target_user_id uuid, target_role text)
returns boolean language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_admin() then
    raise exception 'Admin role required' using errcode = '42501';
  end if;
  if target_user_id = auth.uid() then
    raise exception 'Admin cannot change their own role' using errcode = '22023';
  end if;
  if target_role not in ('student', 'teacher') then
    raise exception 'Invalid account role' using errcode = '22023';
  end if;
  if target_role = 'student' and exists (
    select 1 from public.classes where teacher_id = target_user_id
  ) then
    raise exception 'Teacher still owns one or more classes' using errcode = '23503';
  end if;

  update public.profiles
  set role = target_role::public.user_role
  where id = target_user_id and role::text <> 'admin';

  if not found then
    raise exception 'Account not found or protected' using errcode = 'P0002';
  end if;
  return true;
end;
$$;

revoke all on function public.admin_set_account_role(uuid, text) from public;
grant execute on function public.admin_set_account_role(uuid, text) to authenticated;

create policy profiles_admin_select on public.profiles
for select to authenticated using (public.is_admin());
