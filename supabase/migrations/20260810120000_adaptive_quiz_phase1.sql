alter type public.activity_kind add value if not exists 'keyword_opened';
alter type public.activity_kind add value if not exists 'slide_dwell_completed';
alter type public.activity_kind add value if not exists 'quiz_recommended';
alter type public.activity_kind add value if not exists 'quiz_started';
alter type public.activity_kind add value if not exists 'quiz_completed';
alter type public.activity_kind add value if not exists 'quiz_dismissed';

begin;

create table public.lesson_chunks (
  id uuid primary key default gen_random_uuid(),
  lesson_id text not null references public.lessons(id) on delete cascade,
  source_identity text not null check (char_length(source_identity) between 1 and 1000),
  slide_number integer not null check (slide_number between 1 and 500),
  chunk_index integer not null default 0 check (chunk_index between 0 and 100),
  title text not null check (char_length(trim(title)) between 1 and 180),
  content text not null check (char_length(content) between 1 and 20000),
  summary text not null check (char_length(summary) between 1 and 4000),
  keywords text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (lesson_id, source_identity, slide_number, chunk_index)
);

create table public.lesson_keyword_sources (
  lesson_id text not null references public.lessons(id) on delete cascade,
  keyword_id uuid not null references public.keyword_definitions(id) on delete cascade,
  chunk_id uuid not null references public.lesson_chunks(id) on delete cascade,
  slide_number integer not null check (slide_number between 1 and 500),
  evidence_text text not null check (char_length(trim(evidence_text)) between 1 and 1000),
  confidence numeric(4,3) not null default 1 check (confidence between 0 and 1),
  created_at timestamptz not null default now(),
  primary key (lesson_id, keyword_id, chunk_id)
);

create table public.quiz_variants (
  id uuid primary key default gen_random_uuid(),
  lesson_id text not null references public.lessons(id) on delete cascade,
  source_identity text not null check (char_length(source_identity) between 1 and 1000),
  target_signature text not null check (target_signature ~ '^[a-f0-9]{64}$'),
  target_keywords text[] not null default '{}',
  target_slides integer[] not null default '{}',
  question_count integer not null default 3 check (question_count = 3),
  questions jsonb not null check (jsonb_typeof(questions) = 'array' and jsonb_array_length(questions) = 3),
  status text not null default 'approved' check (status in ('approved', 'failed', 'archived')),
  quizer_provider text not null check (char_length(quizer_provider) between 1 and 80),
  quizer_model text not null check (char_length(quizer_model) between 1 and 200),
  verifier_provider text not null check (char_length(verifier_provider) between 1 and 80),
  verifier_model text not null check (char_length(verifier_model) between 1 and 200),
  prompt_version text not null check (char_length(prompt_version) between 1 and 80),
  validation jsonb not null default '{}'::jsonb check (jsonb_typeof(validation) = 'object'),
  generated_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (lesson_id, source_identity, target_signature)
);

create table public.quiz_recommendations (
  id uuid primary key default gen_random_uuid(),
  variant_id uuid not null references public.quiz_variants(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  class_id uuid not null references public.classes(id) on delete cascade,
  lesson_id text not null references public.lessons(id) on delete cascade,
  trigger_metadata jsonb not null default '{}'::jsonb check (jsonb_typeof(trigger_metadata) = 'object' and pg_column_size(trigger_metadata) <= 8192),
  status text not null default 'pending' check (status in ('pending', 'accepted', 'dismissed', 'completed')),
  recommended_at timestamptz not null default now(),
  accepted_at timestamptz,
  dismissed_at timestamptz,
  completed_at timestamptz,
  updated_at timestamptz not null default now(),
  unique (variant_id, user_id, class_id)
);

create table public.quiz_attempts (
  id uuid primary key default gen_random_uuid(),
  recommendation_id uuid not null unique references public.quiz_recommendations(id) on delete cascade,
  variant_id uuid not null references public.quiz_variants(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  class_id uuid not null references public.classes(id) on delete cascade,
  lesson_id text not null references public.lessons(id) on delete cascade,
  answers jsonb check (answers is null or jsonb_typeof(answers) = 'array'),
  score integer check (score is null or score between 0 and 3),
  question_count integer not null default 3 check (question_count = 3),
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  duration_seconds integer check (duration_seconds is null or duration_seconds between 0 and 86400),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.quiz_reports (
  id uuid primary key default gen_random_uuid(),
  recommendation_id uuid not null references public.quiz_recommendations(id) on delete cascade,
  variant_id uuid not null references public.quiz_variants(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  slot_id text not null check (slot_id in ('q1', 'q2', 'q3')),
  reason text not null check (char_length(trim(reason)) between 3 and 500),
  created_at timestamptz not null default now(),
  unique (recommendation_id, user_id, slot_id)
);

create index lesson_chunks_lookup_idx on public.lesson_chunks (lesson_id, source_identity, slide_number);
create index lesson_keyword_sources_keyword_idx on public.lesson_keyword_sources (lesson_id, keyword_id, slide_number);
create index quiz_variants_lookup_idx on public.quiz_variants (lesson_id, source_identity, target_signature, status);
create index quiz_recommendations_user_lesson_idx on public.quiz_recommendations (user_id, class_id, lesson_id, recommended_at desc);
create index quiz_attempts_user_lesson_idx on public.quiz_attempts (user_id, class_id, lesson_id, started_at desc);
create index quiz_reports_variant_idx on public.quiz_reports (variant_id, created_at desc);

create trigger lesson_chunks_set_updated_at before update on public.lesson_chunks
for each row execute function public.set_updated_at();
create trigger quiz_variants_set_updated_at before update on public.quiz_variants
for each row execute function public.set_updated_at();
create trigger quiz_recommendations_set_updated_at before update on public.quiz_recommendations
for each row execute function public.set_updated_at();
create trigger quiz_attempts_set_updated_at before update on public.quiz_attempts
for each row execute function public.set_updated_at();

alter table public.lesson_chunks enable row level security;
alter table public.lesson_keyword_sources enable row level security;
alter table public.quiz_variants enable row level security;
alter table public.quiz_recommendations enable row level security;
alter table public.quiz_attempts enable row level security;
alter table public.quiz_reports enable row level security;

create policy lesson_chunks_visible on public.lesson_chunks for select to authenticated using (
  public.is_active_account() and exists (
    select 1 from public.lessons lesson
    where lesson.id = lesson_chunks.lesson_id
      and (
        public.is_course_owner(lesson.course_id)
        or public.is_admin()
        or exists (
          select 1 from public.class_lesson_schedules schedule
          where schedule.lesson_id = lesson.id
            and public.can_access_class_lesson(schedule.class_id, lesson.id)
        )
      )
  )
);
create policy lesson_chunks_owner_insert on public.lesson_chunks for insert to authenticated with check (
  public.is_active_account() and exists (
    select 1 from public.lessons lesson
    where lesson.id = lesson_chunks.lesson_id and public.is_course_owner(lesson.course_id)
  )
);
create policy lesson_chunks_owner_update on public.lesson_chunks for update to authenticated using (
  exists (select 1 from public.lessons lesson where lesson.id = lesson_chunks.lesson_id and public.is_course_owner(lesson.course_id))
) with check (
  public.is_active_account() and exists (select 1 from public.lessons lesson where lesson.id = lesson_chunks.lesson_id and public.is_course_owner(lesson.course_id))
);
create policy lesson_chunks_owner_delete on public.lesson_chunks for delete to authenticated using (
  exists (select 1 from public.lessons lesson where lesson.id = lesson_chunks.lesson_id and public.is_course_owner(lesson.course_id))
);

create policy lesson_keyword_sources_visible on public.lesson_keyword_sources for select to authenticated using (
  public.is_active_account() and exists (
    select 1 from public.lesson_chunks chunk
    where chunk.id = lesson_keyword_sources.chunk_id
  )
);
create policy lesson_keyword_sources_owner_insert on public.lesson_keyword_sources for insert to authenticated with check (
  public.is_active_account() and exists (
    select 1 from public.lessons lesson
    where lesson.id = lesson_keyword_sources.lesson_id and public.is_course_owner(lesson.course_id)
  )
);
create policy lesson_keyword_sources_owner_delete on public.lesson_keyword_sources for delete to authenticated using (
  exists (select 1 from public.lessons lesson where lesson.id = lesson_keyword_sources.lesson_id and public.is_course_owner(lesson.course_id))
);

create policy quiz_recommendations_visible on public.quiz_recommendations for select to authenticated using (
  public.is_active_account() and (
    user_id = auth.uid()
    or public.owns_class(class_id)
    or public.is_admin()
  )
);

create policy quiz_attempts_visible on public.quiz_attempts for select to authenticated using (
  public.is_active_account() and (
    user_id = auth.uid()
    or public.owns_class(class_id)
    or public.is_admin()
  )
);

create policy quiz_reports_visible on public.quiz_reports for select to authenticated using (
  public.is_active_account() and (
    user_id = auth.uid()
    or exists (
      select 1 from public.quiz_recommendations recommendation
      where recommendation.id = quiz_reports.recommendation_id
        and public.owns_class(recommendation.class_id)
    )
    or public.is_admin()
  )
);

grant select, insert, update, delete on public.lesson_chunks to authenticated;
grant select, insert, delete on public.lesson_keyword_sources to authenticated;
grant select on public.quiz_recommendations to authenticated;
grant select on public.quiz_attempts to authenticated;
grant select on public.quiz_reports to authenticated;

drop policy if exists activities_self_insert on public.student_activities;
create policy activities_self_insert on public.student_activities for insert to authenticated with check (
  user_id = auth.uid()
  and public.can_access_class_lesson(class_id, lesson_id)
  and pg_column_size(metadata) <= 4096
  and (metadata - array[
    'wordCount', 'nodeCount', 'status', 'slideId', 'slideNumber', 'keyword',
    'source', 'activeSeconds', 'trigger', 'quizId', 'score', 'questionCount',
    'durationSeconds'
  ]) = '{}'::jsonb
  and (not (metadata ? 'slideId') or (jsonb_typeof(metadata -> 'slideId') = 'string' and char_length(metadata ->> 'slideId') between 1 and 120))
  and (not (metadata ? 'slideNumber') or (jsonb_typeof(metadata -> 'slideNumber') = 'number' and (metadata ->> 'slideNumber')::numeric between 1 and 500))
  and (not (metadata ? 'wordCount') or (jsonb_typeof(metadata -> 'wordCount') = 'number' and (metadata ->> 'wordCount')::numeric between 0 and 100000))
  and (not (metadata ? 'nodeCount') or (jsonb_typeof(metadata -> 'nodeCount') = 'number' and (metadata ->> 'nodeCount')::numeric between 0 and 10000))
  and (not (metadata ? 'activeSeconds') or (jsonb_typeof(metadata -> 'activeSeconds') = 'number' and (metadata ->> 'activeSeconds')::numeric between 0 and 86400))
  and (not (metadata ? 'durationSeconds') or (jsonb_typeof(metadata -> 'durationSeconds') = 'number' and (metadata ->> 'durationSeconds')::numeric between 0 and 86400))
  and (not (metadata ? 'score') or (jsonb_typeof(metadata -> 'score') = 'number' and (metadata ->> 'score')::numeric between 0 and 3))
  and (not (metadata ? 'questionCount') or (jsonb_typeof(metadata -> 'questionCount') = 'number' and (metadata ->> 'questionCount')::numeric = 3))
  and (not (metadata ? 'status') or (jsonb_typeof(metadata -> 'status') = 'string' and char_length(metadata ->> 'status') between 1 and 50))
  and (not (metadata ? 'keyword') or (jsonb_typeof(metadata -> 'keyword') = 'string' and char_length(metadata ->> 'keyword') between 1 and 80))
  and (not (metadata ? 'source') or (jsonb_typeof(metadata -> 'source') = 'string' and char_length(metadata ->> 'source') between 1 and 80))
  and (not (metadata ? 'trigger') or (jsonb_typeof(metadata -> 'trigger') = 'string' and char_length(metadata ->> 'trigger') between 1 and 120))
  and (not (metadata ? 'quizId') or (jsonb_typeof(metadata -> 'quizId') = 'string' and char_length(metadata ->> 'quizId') between 1 and 80))
  and case kind::text
    when 'note_created' then exists (
      select 1 from public.slide_notes note
      where note.user_id = auth.uid()
        and note.class_id = student_activities.class_id
        and note.lesson_id = student_activities.lesson_id
    )
    when 'map_created' then exists (
      select 1 from public.knowledge_maps map
      where map.user_id = auth.uid()
        and map.class_id = student_activities.class_id
        and map.lesson_id = student_activities.lesson_id
    )
    else true
  end
);

comment on table public.lesson_chunks is 'Slide-scoped internal retrieval corpus for grounded adaptive quizzes.';
comment on table public.lesson_keyword_sources is 'Evidence-backed mapping from lesson glossary keywords to source slide chunks.';
comment on table public.quiz_variants is 'Server-generated and verified quiz variants; contains protected answer keys.';
comment on table public.quiz_recommendations is 'Per-student adaptive quiz recommendations and trigger context.';
comment on table public.quiz_attempts is 'Server-scored attempts for adaptive micro-quizzes.';

commit;
