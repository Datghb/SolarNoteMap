begin;

create table public.lesson_knowledge_artifacts (
  lesson_id text primary key references public.lessons(id) on delete cascade,
  slide_summaries jsonb not null default '[]'::jsonb,
  graph jsonb not null default '{"nodes":[],"edges":[]}'::jsonb,
  source_pdf_path text not null,
  source_identity text not null,
  summary_model text not null,
  graph_model text not null,
  generated_by uuid not null references public.profiles(id) on delete restrict,
  generated_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint lesson_knowledge_slide_summaries_array check (jsonb_typeof(slide_summaries) = 'array'),
  constraint lesson_knowledge_graph_object check (jsonb_typeof(graph) = 'object'),
  constraint lesson_knowledge_source_identity_length check (char_length(source_identity) between 1 and 1000),
  constraint lesson_knowledge_models_length check (
    char_length(summary_model) between 1 and 200 and char_length(graph_model) between 1 and 200
  )
);

create trigger lesson_knowledge_artifacts_set_updated_at
before update on public.lesson_knowledge_artifacts
for each row execute function public.set_updated_at();

alter table public.lesson_knowledge_artifacts enable row level security;

create policy lesson_knowledge_visible on public.lesson_knowledge_artifacts
for select to authenticated using (
  exists (
    select 1 from public.lessons lesson
    where lesson.id = lesson_knowledge_artifacts.lesson_id
      and (
        public.is_course_owner(lesson.course_id)
        or public.is_admin()
        or exists (
          select 1 from public.class_lesson_schedules schedule
          where schedule.lesson_id = lesson.id
            and schedule.release_at is not null
            and schedule.release_at <= now()
            and public.is_class_member(schedule.class_id)
        )
      )
  )
);

create policy lesson_knowledge_owner_insert on public.lesson_knowledge_artifacts
for insert to authenticated with check (
  generated_by = auth.uid() and exists (
    select 1 from public.lessons lesson
    where lesson.id = lesson_knowledge_artifacts.lesson_id and public.is_course_owner(lesson.course_id)
  )
);

create policy lesson_knowledge_owner_update on public.lesson_knowledge_artifacts
for update to authenticated using (
  exists (
    select 1 from public.lessons lesson
    where lesson.id = lesson_knowledge_artifacts.lesson_id and public.is_course_owner(lesson.course_id)
  )
) with check (
  generated_by = auth.uid() and exists (
    select 1 from public.lessons lesson
    where lesson.id = lesson_knowledge_artifacts.lesson_id and public.is_course_owner(lesson.course_id)
  )
);

create policy lesson_knowledge_owner_delete on public.lesson_knowledge_artifacts
for delete to authenticated using (
  exists (
    select 1 from public.lessons lesson
    where lesson.id = lesson_knowledge_artifacts.lesson_id and public.is_course_owner(lesson.course_id)
  )
);

grant select, insert, update, delete on public.lesson_knowledge_artifacts to authenticated;

commit;
