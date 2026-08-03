drop policy if exists keyword_definitions_authenticated_select on public.keyword_definitions;
drop policy if exists keyword_definitions_owner_select on public.keyword_definitions;
create policy keyword_definitions_owner_select on public.keyword_definitions
for select to authenticated using (
  created_by = auth.uid() or public.is_admin()
);

drop policy if exists lesson_keywords_authenticated_select on public.lesson_keywords;
drop policy if exists lesson_keywords_owner_select on public.lesson_keywords;
create policy lesson_keywords_owner_select on public.lesson_keywords
for select to authenticated using (
  public.is_admin() or exists (
    select 1 from public.lessons lesson
    where lesson.id = lesson_keywords.lesson_id
      and public.is_course_owner(lesson.course_id)
  )
);

drop policy if exists lesson_keywords_lesson_owner_insert on public.lesson_keywords;
drop policy if exists lesson_keywords_course_owner_insert on public.lesson_keywords;
create policy lesson_keywords_course_owner_insert on public.lesson_keywords
for insert to authenticated with check (
  exists (
    select 1 from public.lessons lesson
    where lesson.id = lesson_keywords.lesson_id
      and public.is_course_owner(lesson.course_id)
  )
);

insert into public.lesson_keywords (lesson_id, keyword_id)
select definitions.source_lesson_id, definitions.id
from public.keyword_definitions definitions
join public.lessons lesson on lesson.id = definitions.source_lesson_id
where definitions.source_lesson_id is not null
  and definitions.definition_version = 'v2-pedagogical'
on conflict (lesson_id, keyword_id) do nothing;
