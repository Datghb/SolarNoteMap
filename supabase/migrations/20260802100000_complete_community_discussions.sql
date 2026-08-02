begin;

alter table public.community_questions
  add column if not exists slide_id text;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'community_questions_slide_id_length'
      and conrelid = 'public.community_questions'::regclass
  ) then
    alter table public.community_questions
      add constraint community_questions_slide_id_length
      check (slide_id is null or char_length(slide_id) between 1 and 120);
  end if;
end $$;

create table if not exists public.community_question_votes (
  question_id uuid not null references public.community_questions(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (question_id, user_id)
);

create index if not exists community_answers_question_time_idx
  on public.community_answers(question_id, created_at);

alter table public.community_question_votes enable row level security;

drop policy if exists question_votes_member_select on public.community_question_votes;
create policy question_votes_member_select on public.community_question_votes
for select to authenticated using (exists (
  select 1 from public.community_questions q
  where q.id = question_id
    and (public.is_class_member(q.class_id) or public.owns_class(q.class_id))
));

drop policy if exists question_votes_self_insert on public.community_question_votes;
create policy question_votes_self_insert on public.community_question_votes
for insert to authenticated with check (
  user_id = auth.uid()
  and exists (
    select 1 from public.community_questions q
    where q.id = question_id
      and (public.is_class_member(q.class_id) or public.owns_class(q.class_id))
  )
);

drop policy if exists question_votes_self_delete on public.community_question_votes;
create policy question_votes_self_delete on public.community_question_votes
for delete to authenticated using (user_id = auth.uid());

do $$
begin
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'community_questions') then
    alter publication supabase_realtime add table public.community_questions;
  end if;
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'community_answers') then
    alter publication supabase_realtime add table public.community_answers;
  end if;
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'community_question_votes') then
    alter publication supabase_realtime add table public.community_question_votes;
  end if;
end $$;

notify pgrst, 'reload schema';

commit;
