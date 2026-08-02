begin;

create table public.keyword_definitions (
  id uuid primary key default gen_random_uuid(),
  term text not null check (char_length(trim(term)) between 2 and 80),
  normalized_term text not null check (char_length(trim(normalized_term)) between 2 and 80),
  definition text not null check (char_length(trim(definition)) between 3 and 600),
  source_lesson_id text references public.lessons(id) on delete set null,
  created_by uuid not null references public.profiles(id) on delete restrict default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (created_by, normalized_term)
);

create table public.lesson_keywords (
  lesson_id text not null references public.lessons(id) on delete cascade,
  keyword_id uuid not null references public.keyword_definitions(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (lesson_id, keyword_id)
);

create index lesson_keywords_keyword_id_idx on public.lesson_keywords(keyword_id);

create trigger keyword_definitions_set_updated_at
before update on public.keyword_definitions
for each row execute function public.set_updated_at();

alter table public.keyword_definitions enable row level security;
alter table public.lesson_keywords enable row level security;

create policy keyword_definitions_authenticated_select on public.keyword_definitions
for select to authenticated using (
  created_by = auth.uid()
  or exists (
    select 1
    from public.lesson_keywords
    join public.lessons on lessons.id = lesson_keywords.lesson_id
    where lesson_keywords.keyword_id = keyword_definitions.id
  )
);

create policy keyword_definitions_teacher_insert on public.keyword_definitions
for insert to authenticated with check (
  created_by = auth.uid()
  and exists (select 1 from public.profiles where id = auth.uid() and role = 'teacher')
);

create policy keyword_definitions_owner_update on public.keyword_definitions
for update to authenticated
using (created_by = auth.uid())
with check (created_by = auth.uid());

create policy lesson_keywords_authenticated_select on public.lesson_keywords
for select to authenticated using (
  exists (select 1 from public.lessons where id = lesson_keywords.lesson_id)
);

create policy lesson_keywords_lesson_owner_insert on public.lesson_keywords
for insert to authenticated with check (
  exists (
    select 1 from public.lessons
    where id = lesson_keywords.lesson_id and created_by = auth.uid()
  )
);

comment on table public.keyword_definitions is
  'Shared glossary. Existing definitions are reused across newly analyzed lessons.';
comment on table public.lesson_keywords is
  'Keywords detected for each lesson without duplicating their shared definitions.';

commit;
