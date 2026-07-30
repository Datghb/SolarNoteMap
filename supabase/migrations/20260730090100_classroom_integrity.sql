begin;

delete from public.knowledge_maps older
using public.knowledge_maps newer
where older.lesson_id = newer.lesson_id
  and older.user_id = newer.user_id
  and (older.created_at, older.id) < (newer.created_at, newer.id);

create unique index if not exists knowledge_maps_lesson_user_unique
on public.knowledge_maps (lesson_id, user_id);

drop policy if exists activities_self_insert on public.student_activities;
create policy activities_self_insert on public.student_activities for insert to authenticated
with check (
  user_id = auth.uid()
  and public.is_class_member(class_id)
  and pg_column_size(metadata) <= 4096
  and (metadata - array['wordCount', 'nodeCount', 'status', 'slideId']) = '{}'::jsonb
  and (not (metadata ? 'slideId') or (jsonb_typeof(metadata -> 'slideId') = 'string' and char_length(metadata ->> 'slideId') between 1 and 120))
  and (not (metadata ? 'wordCount') or (jsonb_typeof(metadata -> 'wordCount') = 'number' and (metadata ->> 'wordCount')::numeric between 0 and 100000))
  and (not (metadata ? 'nodeCount') or (jsonb_typeof(metadata -> 'nodeCount') = 'number' and (metadata ->> 'nodeCount')::numeric between 0 and 10000))
  and (not (metadata ? 'status') or (jsonb_typeof(metadata -> 'status') = 'string' and char_length(metadata ->> 'status') between 1 and 50))
  and exists (
    select 1 from public.lessons lesson
    where lesson.id = student_activities.lesson_id
      and lesson.class_id = student_activities.class_id
      and (lesson.published_at is not null or public.owns_class(lesson.class_id))
  )
  and case kind::text
    when 'note_created' then exists (select 1 from public.slide_notes note where note.user_id = auth.uid() and note.lesson_id = student_activities.lesson_id)
    when 'map_created' then exists (select 1 from public.knowledge_maps map where map.user_id = auth.uid() and map.lesson_id = student_activities.lesson_id)
    else true
  end
);

drop policy if exists notes_owner_update on public.slide_notes;
create policy notes_owner_update on public.slide_notes for update to authenticated
using (user_id = auth.uid())
with check (
  user_id = auth.uid()
  and exists (
    select 1 from public.lessons lesson
    where lesson.id = slide_notes.lesson_id
      and (public.owns_class(lesson.class_id) or (public.is_class_member(lesson.class_id) and lesson.published_at is not null))
  )
);

drop policy if exists maps_owner_update on public.knowledge_maps;
create policy maps_owner_update on public.knowledge_maps for update to authenticated
using (user_id = auth.uid())
with check (
  user_id = auth.uid()
  and exists (
    select 1 from public.lessons lesson
    where lesson.id = knowledge_maps.lesson_id
      and (public.owns_class(lesson.class_id) or (public.is_class_member(lesson.class_id) and lesson.published_at is not null))
  )
);

commit;
