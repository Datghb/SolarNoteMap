create or replace function public.load_lesson_keywords(target_lesson_id text)
returns table (term text, definition text)
language sql
stable
security definer
set search_path = ''
as $$
  select definitions.term, definitions.definition
  from public.lesson_keywords links
  join public.keyword_definitions definitions on definitions.id = links.keyword_id
  where links.lesson_id = target_lesson_id
    and definitions.definition_version = 'v2-pedagogical'
    and public.is_active_account()
    and (
      exists (
        select 1 from public.lessons lesson
        where lesson.id = target_lesson_id
          and (lesson.created_by = auth.uid() or public.is_admin())
      )
      or exists (
        select 1
        from public.class_lesson_schedules schedule
        where schedule.lesson_id = target_lesson_id
          and schedule.release_at is not null
          and schedule.release_at <= now()
          and public.is_class_member(schedule.class_id)
      )
    )
  order by definitions.term;
$$;

revoke all on function public.load_lesson_keywords(text) from public;
grant execute on function public.load_lesson_keywords(text) to authenticated;
