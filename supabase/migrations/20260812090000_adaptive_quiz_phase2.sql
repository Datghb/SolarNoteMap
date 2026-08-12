begin;

alter table public.quiz_variants
  drop constraint if exists quiz_variants_question_count_check,
  drop constraint if exists quiz_variants_questions_check;
alter table public.quiz_variants
  add column if not exists quiz_mode text not null default 'micro',
  add column if not exists requested_question_count integer not null default 3;
alter table public.quiz_variants
  add constraint quiz_variants_quiz_mode_check check (quiz_mode in ('micro', 'lesson_review')),
  add constraint quiz_variants_question_count_check check (question_count between 3 and 15),
  add constraint quiz_variants_requested_question_count_check check (requested_question_count between question_count and 15),
  add constraint quiz_variants_questions_check check (jsonb_typeof(questions) = 'array' and jsonb_array_length(questions) = question_count);

alter table public.quiz_attempts
  drop constraint if exists quiz_attempts_score_check,
  drop constraint if exists quiz_attempts_question_count_check,
  drop constraint if exists quiz_attempts_answers_check,
  drop constraint if exists quiz_attempts_quiz_mode_check;
alter table public.quiz_attempts add column if not exists quiz_mode text not null default 'micro';
alter table public.quiz_attempts
  add constraint quiz_attempts_quiz_mode_check check (quiz_mode in ('micro', 'lesson_review')),
  add constraint quiz_attempts_question_count_check check (question_count between 3 and 15),
  add constraint quiz_attempts_score_check check (score is null or score between 0 and question_count),
  add constraint quiz_attempts_answers_check check (answers is null or (jsonb_typeof(answers) = 'array' and jsonb_array_length(answers) = question_count));

alter table public.quiz_reports drop constraint if exists quiz_reports_slot_id_check;
alter table public.quiz_reports add constraint quiz_reports_slot_id_check check (slot_id ~ '^q(?:[1-9]|1[0-5])$');

create index if not exists quiz_variants_mode_lookup_idx on public.quiz_variants (lesson_id, quiz_mode, question_count, generated_at desc);
create index if not exists quiz_attempts_class_mode_idx on public.quiz_attempts (class_id, quiz_mode, completed_at desc);

drop policy if exists activities_self_insert on public.student_activities;
create policy activities_self_insert on public.student_activities for insert to authenticated with check (
  user_id = auth.uid()
  and public.can_access_class_lesson(class_id, lesson_id)
  and pg_column_size(metadata) <= 4096
  and (metadata - array[
    'wordCount', 'nodeCount', 'status', 'slideId', 'slideNumber', 'keyword',
    'source', 'activeSeconds', 'trigger', 'quizId', 'score', 'questionCount',
    'durationSeconds', 'quizMode', 'requestedQuestionCount', 'deliveredQuestionCount', 'retrievalVersion'
  ]) = '{}'::jsonb
  and (not (metadata ? 'slideId') or (jsonb_typeof(metadata -> 'slideId') = 'string' and char_length(metadata ->> 'slideId') between 1 and 120))
  and (not (metadata ? 'slideNumber') or (jsonb_typeof(metadata -> 'slideNumber') = 'number' and (metadata ->> 'slideNumber')::numeric between 1 and 500))
  and (not (metadata ? 'wordCount') or (jsonb_typeof(metadata -> 'wordCount') = 'number' and (metadata ->> 'wordCount')::numeric between 0 and 100000))
  and (not (metadata ? 'nodeCount') or (jsonb_typeof(metadata -> 'nodeCount') = 'number' and (metadata ->> 'nodeCount')::numeric between 0 and 10000))
  and (not (metadata ? 'activeSeconds') or (jsonb_typeof(metadata -> 'activeSeconds') = 'number' and (metadata ->> 'activeSeconds')::numeric between 0 and 86400))
  and (not (metadata ? 'durationSeconds') or (jsonb_typeof(metadata -> 'durationSeconds') = 'number' and (metadata ->> 'durationSeconds')::numeric between 0 and 86400))
  and (not (metadata ? 'score') or (jsonb_typeof(metadata -> 'score') = 'number' and (metadata ->> 'score')::numeric between 0 and 15))
  and (not (metadata ? 'questionCount') or (jsonb_typeof(metadata -> 'questionCount') = 'number' and (metadata ->> 'questionCount')::numeric between 3 and 15))
  and (not (metadata ? 'requestedQuestionCount') or (jsonb_typeof(metadata -> 'requestedQuestionCount') = 'number' and (metadata ->> 'requestedQuestionCount')::numeric between 3 and 15))
  and (not (metadata ? 'deliveredQuestionCount') or (jsonb_typeof(metadata -> 'deliveredQuestionCount') = 'number' and (metadata ->> 'deliveredQuestionCount')::numeric between 3 and 15))
  and (not (metadata ? 'quizMode') or (jsonb_typeof(metadata -> 'quizMode') = 'string' and (metadata ->> 'quizMode') in ('micro', 'lesson_review')))
  and (not (metadata ? 'retrievalVersion') or (jsonb_typeof(metadata -> 'retrievalVersion') = 'string' and char_length(metadata ->> 'retrievalVersion') between 1 and 80))
  and (not (metadata ? 'status') or (jsonb_typeof(metadata -> 'status') = 'string' and char_length(metadata ->> 'status') between 1 and 50))
  and (not (metadata ? 'keyword') or (jsonb_typeof(metadata -> 'keyword') = 'string' and char_length(metadata ->> 'keyword') between 1 and 80))
  and (not (metadata ? 'source') or (jsonb_typeof(metadata -> 'source') = 'string' and char_length(metadata ->> 'source') between 1 and 80))
  and (not (metadata ? 'trigger') or (jsonb_typeof(metadata -> 'trigger') = 'string' and char_length(metadata ->> 'trigger') between 1 and 120))
  and (not (metadata ? 'quizId') or (jsonb_typeof(metadata -> 'quizId') = 'string' and char_length(metadata ->> 'quizId') between 1 and 80))
  and case kind::text
    when 'note_created' then exists (select 1 from public.slide_notes note where note.user_id = auth.uid() and note.class_id = student_activities.class_id and note.lesson_id = student_activities.lesson_id)
    when 'map_created' then exists (select 1 from public.knowledge_maps map where map.user_id = auth.uid() and map.class_id = student_activities.class_id and map.lesson_id = student_activities.lesson_id)
    else true
  end
);

comment on column public.quiz_variants.quiz_mode is 'Phase 2 mode: near-context micro practice or whole-lesson review.';
comment on column public.quiz_variants.requested_question_count is 'Requested count before validation; question_count is delivered count.';
comment on column public.quiz_attempts.quiz_mode is 'Mode copied from the immutable variant for analytics.';

commit;
