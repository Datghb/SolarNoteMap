begin;

create or replace function public.admin_set_account_role(target_user_id uuid, target_role text)
returns boolean language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_admin() then raise exception 'Admin role required' using errcode = '42501'; end if;
  if target_user_id = auth.uid() then raise exception 'Admin cannot change their own role' using errcode = '22023'; end if;
  if target_role not in ('student', 'teacher') then raise exception 'Invalid account role' using errcode = '22023'; end if;

  if target_role = 'student' then
    update public.classes set archived_at = coalesce(archived_at, now()) where teacher_id = target_user_id;
    update public.courses set archived_at = coalesce(archived_at, now()) where owner_id = target_user_id;
    delete from public.class_memberships where user_id = target_user_id and role = 'teacher';
  end if;

  update public.profiles set role = target_role::public.user_role
  where id = target_user_id and role::text <> 'admin';
  if not found then raise exception 'Account not found or protected' using errcode = 'P0002'; end if;
  return true;
end;
$$;
revoke all on function public.admin_set_account_role(uuid, text) from public;
grant execute on function public.admin_set_account_role(uuid, text) to authenticated;

-- A demoted owner keeps recoverable ownership rows, but cannot mutate them until
-- an administrator promotes the account again.
create or replace function public.is_course_owner(target_course_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select public.is_teacher() and exists (
    select 1 from public.courses where id = target_course_id and owner_id = auth.uid()
  );
$$;
revoke all on function public.is_course_owner(uuid) from public;
grant execute on function public.is_course_owner(uuid) to authenticated;

create or replace function public.owns_class(target_class_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select public.is_teacher() and exists (
    select 1 from public.classes where id = target_class_id and teacher_id = auth.uid()
  );
$$;
revoke all on function public.owns_class(uuid) from public;
grant execute on function public.owns_class(uuid) to authenticated;

create or replace function public.can_access_class_lesson(target_class_id uuid, target_lesson_id text)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.class_lesson_schedules schedule
    join public.classes class_row on class_row.id = schedule.class_id
    where schedule.class_id = target_class_id
      and schedule.lesson_id = target_lesson_id
      and class_row.archived_at is null
      and (
        public.owns_class(schedule.class_id)
        or (schedule.release_at is not null and schedule.release_at <= now() and public.is_class_member(schedule.class_id))
      )
  );
$$;
revoke all on function public.can_access_class_lesson(uuid, text) from public;
grant execute on function public.can_access_class_lesson(uuid, text) to authenticated;

create or replace function public.load_class_lessons(target_class_id uuid)
returns table (
  id text, class_id uuid, course_id uuid, created_by uuid, title text, short_name text,
  description text, prompt text, pdf_path text, published_at timestamptz,
  created_at timestamptz, updated_at timestamptz, available_at timestamptz
) language plpgsql stable security definer set search_path = '' as $$
begin
  if not exists (
    select 1 from public.classes class_row
    where class_row.id = target_class_id and class_row.archived_at is null
      and (public.owns_class(class_row.id) or public.is_class_member(class_row.id) or public.is_admin())
  ) then raise exception 'Active class access required' using errcode = '42501'; end if;
  return query
  select lesson.id, schedule.class_id, lesson.course_id, lesson.created_by, lesson.title,
    lesson.short_name, lesson.description, lesson.prompt, lesson.pdf_path,
    schedule.release_at, lesson.created_at, lesson.updated_at, schedule.release_at
  from public.class_lesson_schedules schedule
  join public.lessons lesson on lesson.id = schedule.lesson_id and lesson.course_id = schedule.course_id
  join public.classes class_row on class_row.id = schedule.class_id and class_row.archived_at is null
  where schedule.class_id = target_class_id
    and (public.owns_class(target_class_id) or public.is_admin() or (schedule.release_at is not null and schedule.release_at <= now()))
  order by lesson.created_at, lesson.id;
end;
$$;
revoke all on function public.load_class_lessons(uuid) from public;
grant execute on function public.load_class_lessons(uuid) to authenticated;

drop policy if exists courses_visible on public.courses;
create policy courses_visible on public.courses for select to authenticated using (
  public.is_admin() or public.is_course_owner(id) or (
    archived_at is null and exists (
      select 1 from public.classes class_row
      where class_row.course_id = courses.id and class_row.archived_at is null and public.is_class_member(class_row.id)
    )
  )
);
drop policy if exists classes_member_select on public.classes;
create policy classes_member_select on public.classes for select to authenticated using (
  public.is_admin() or public.owns_class(id) or (archived_at is null and public.is_class_member(id))
);

drop policy if exists courses_owner_update on public.courses;
create policy courses_owner_update on public.courses for update to authenticated
using (owner_id = auth.uid() and public.is_teacher())
with check (owner_id = auth.uid() and public.is_teacher());
drop policy if exists courses_owner_delete on public.courses;
create policy courses_owner_delete on public.courses for delete to authenticated
using (owner_id = auth.uid() and public.is_teacher());

drop policy if exists classes_owner_update on public.classes;
create policy classes_owner_update on public.classes for update to authenticated
using (teacher_id = auth.uid() and public.is_teacher())
with check (teacher_id = auth.uid() and public.is_teacher() and public.is_course_owner(course_id));
drop policy if exists classes_owner_delete on public.classes;
create policy classes_owner_delete on public.classes for delete to authenticated
using (teacher_id = auth.uid() and public.is_teacher());

commit;
