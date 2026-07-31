begin;

drop function if exists public.load_course_lessons(uuid);
create or replace function public.load_course_lessons(target_course_id uuid)
returns table (
  id text, class_id uuid, course_id uuid, created_by uuid, title text, short_name text,
  description text, prompt text, pdf_path text, published_at timestamptz,
  created_at timestamptz, updated_at timestamptz, available_at timestamptz,
  summary text, summarized_at timestamptz
) language plpgsql stable security definer set search_path = '' as $$
begin
  if not (public.is_course_owner(target_course_id) or public.is_admin()) then
    raise exception 'Course owner or admin required' using errcode = '42501';
  end if;
  return query
  select lesson.id, null::uuid, lesson.course_id, lesson.created_by, lesson.title,
    lesson.short_name, lesson.description, lesson.prompt, lesson.pdf_path,
    null::timestamptz, lesson.created_at, lesson.updated_at, null::timestamptz,
    lesson.summary, lesson.summarized_at
  from public.lessons lesson
  where lesson.course_id = target_course_id
  order by lesson.created_at, lesson.id;
end;
$$;

drop function if exists public.load_class_lessons(uuid);
create or replace function public.load_class_lessons(target_class_id uuid)
returns table (
  id text, class_id uuid, course_id uuid, created_by uuid, title text, short_name text,
  description text, prompt text, pdf_path text, published_at timestamptz,
  created_at timestamptz, updated_at timestamptz, available_at timestamptz,
  summary text, summarized_at timestamptz
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
    schedule.release_at, lesson.created_at, lesson.updated_at, schedule.release_at,
    lesson.summary, lesson.summarized_at
  from public.class_lesson_schedules schedule
  join public.lessons lesson on lesson.id = schedule.lesson_id and lesson.course_id = schedule.course_id
  join public.classes class_row on class_row.id = schedule.class_id and class_row.archived_at is null
  where schedule.class_id = target_class_id
    and (public.owns_class(target_class_id) or public.is_admin() or (schedule.release_at is not null and schedule.release_at <= now()))
  order by lesson.created_at, lesson.id;
end;
$$;

revoke all on function public.load_course_lessons(uuid) from public;
grant execute on function public.load_course_lessons(uuid) to authenticated;
revoke all on function public.load_class_lessons(uuid) from public;
grant execute on function public.load_class_lessons(uuid) to authenticated;

commit;
