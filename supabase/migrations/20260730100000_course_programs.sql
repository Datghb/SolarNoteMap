begin;

create table public.courses (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete restrict,
  name text not null check (char_length(trim(name)) between 1 and 120),
  description text not null default '' check (char_length(description) <= 2000),
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, owner_id)
);

create trigger courses_set_updated_at before update on public.courses
for each row execute function public.set_updated_at();

alter table public.classes add column course_id uuid references public.courses(id) on delete restrict;

-- Every legacy class becomes a one-class course. Reusing the class UUID makes the
-- backfill deterministic while preserving all existing class and lesson IDs.
insert into public.courses (id, owner_id, name, description, archived_at, created_at, updated_at)
select id, teacher_id, name, description, archived_at, created_at, updated_at
from public.classes;

update public.classes set course_id = id where course_id is null;
alter table public.classes alter column course_id set not null;
alter table public.classes add constraint classes_course_teacher_fk
  foreign key (course_id, teacher_id) references public.courses(id, owner_id) on delete restrict;
alter table public.classes add constraint classes_id_course_unique unique (id, course_id);

alter table public.lessons add column course_id uuid references public.courses(id) on delete restrict;
update public.lessons lesson
set course_id = class_row.course_id
from public.classes class_row
where class_row.id = lesson.class_id and lesson.course_id is null;
alter table public.lessons alter column course_id set not null;
alter table public.lessons alter column class_id drop not null;
alter table public.lessons add constraint lessons_id_course_unique unique (id, course_id);

create table public.class_lesson_schedules (
  class_id uuid not null,
  course_id uuid not null,
  lesson_id text not null,
  release_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (class_id, lesson_id),
  foreign key (class_id, course_id) references public.classes(id, course_id) on delete cascade,
  foreign key (lesson_id, course_id) references public.lessons(id, course_id) on delete cascade
);

create trigger class_lesson_schedules_set_updated_at
before update on public.class_lesson_schedules
for each row execute function public.set_updated_at();

create or replace function public.schedule_new_course_lesson()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.class_lesson_schedules (class_id, course_id, lesson_id)
  select id, new.course_id, new.id
  from public.classes
  where course_id = new.course_id and archived_at is null;
  return new;
end;
$$;

create trigger lessons_schedule_for_course_classes
after insert on public.lessons for each row execute function public.schedule_new_course_lesson();
revoke all on function public.schedule_new_course_lesson() from public;

insert into public.class_lesson_schedules (class_id, course_id, lesson_id, release_at)
select lesson.class_id, lesson.course_id, lesson.id, lesson.published_at
from public.lessons lesson
where lesson.class_id is not null;

-- Learning artifacts used to be keyed only by lesson. Once a lesson is shared by
-- multiple classes, the class must be part of both identity and authorization.
alter table public.slide_notes add column class_id uuid;
update public.slide_notes note
set class_id = lesson.class_id
from public.lessons lesson
where lesson.id = note.lesson_id and note.class_id is null;
alter table public.slide_notes alter column class_id set not null;
alter table public.slide_notes
  add constraint slide_notes_class_lesson_fk
  foreign key (class_id, lesson_id)
  references public.class_lesson_schedules(class_id, lesson_id) on delete cascade;
alter table public.slide_notes
  drop constraint slide_notes_lesson_id_user_id_slide_number_key;
alter table public.slide_notes
  add constraint slide_notes_class_lesson_user_slide_unique
  unique (class_id, lesson_id, user_id, slide_number);

alter table public.knowledge_maps add column class_id uuid;
update public.knowledge_maps map
set class_id = lesson.class_id
from public.lessons lesson
where lesson.id = map.lesson_id and map.class_id is null;
alter table public.knowledge_maps alter column class_id set not null;
alter table public.knowledge_maps
  add constraint knowledge_maps_class_lesson_fk
  foreign key (class_id, lesson_id)
  references public.class_lesson_schedules(class_id, lesson_id) on delete cascade;
drop index if exists public.knowledge_maps_lesson_user_unique;
alter table public.knowledge_maps
  add constraint knowledge_maps_class_lesson_user_unique
  unique (class_id, lesson_id, user_id);

create index courses_owner_idx on public.courses(owner_id, archived_at);
create index classes_course_idx on public.classes(course_id, archived_at);
create index lessons_course_idx on public.lessons(course_id, created_at);
create index schedules_release_idx on public.class_lesson_schedules(class_id, release_at);
create index slide_notes_user_class_lesson_idx on public.slide_notes(user_id, class_id, lesson_id);
create index knowledge_maps_user_class_lesson_idx on public.knowledge_maps(user_id, class_id, lesson_id);

create or replace function public.is_course_owner(target_course_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.courses
    where id = target_course_id and owner_id = auth.uid()
  );
$$;
revoke all on function public.is_course_owner(uuid) from public;
grant execute on function public.is_course_owner(uuid) to authenticated;

create or replace function public.lesson_belongs_to_course(target_lesson_id text, target_course_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.lessons
    where id = target_lesson_id and course_id = target_course_id
  );
$$;
revoke all on function public.lesson_belongs_to_course(text, uuid) from public;
grant execute on function public.lesson_belongs_to_course(text, uuid) to authenticated;

create or replace function public.can_access_class_lesson(target_class_id uuid, target_lesson_id text)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1
    from public.class_lesson_schedules schedule
    where schedule.class_id = target_class_id
      and schedule.lesson_id = target_lesson_id
      and (
        public.owns_class(schedule.class_id)
        or (
          schedule.release_at is not null
          and schedule.release_at <= now()
          and public.is_class_member(schedule.class_id)
        )
      )
  );
$$;
revoke all on function public.can_access_class_lesson(uuid, text) from public;
grant execute on function public.can_access_class_lesson(uuid, text) to authenticated;

alter table public.courses enable row level security;
alter table public.class_lesson_schedules enable row level security;

create policy courses_visible on public.courses for select to authenticated using (
  owner_id = auth.uid() or public.is_admin() or exists (
    select 1 from public.classes class_row
    where class_row.course_id = courses.id and public.is_class_member(class_row.id)
  )
);
create policy courses_owner_insert on public.courses for insert to authenticated
with check (owner_id = auth.uid() and public.is_teacher());
create policy courses_owner_update on public.courses for update to authenticated
using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy courses_owner_delete on public.courses for delete to authenticated
using (owner_id = auth.uid());

drop policy if exists classes_member_select on public.classes;
create policy classes_member_select on public.classes for select to authenticated
using (public.is_class_member(id) or teacher_id = auth.uid() or public.is_admin());
drop policy if exists classes_teacher_insert on public.classes;
create policy classes_teacher_insert on public.classes for insert to authenticated
with check (teacher_id = auth.uid() and public.is_teacher() and public.is_course_owner(course_id));
drop policy if exists classes_owner_update on public.classes;
create policy classes_owner_update on public.classes for update to authenticated
using (teacher_id = auth.uid())
with check (teacher_id = auth.uid() and public.is_course_owner(course_id));

create policy schedules_visible on public.class_lesson_schedules for select to authenticated
using (public.owns_class(class_id) or public.is_admin() or (
  public.is_class_member(class_id) and release_at is not null and release_at <= now()
));
create policy schedules_owner_insert on public.class_lesson_schedules for insert to authenticated
with check (public.owns_class(class_id) and public.is_course_owner(course_id));
create policy schedules_owner_update on public.class_lesson_schedules for update to authenticated
using (public.owns_class(class_id))
with check (public.owns_class(class_id) and public.is_course_owner(course_id));
create policy schedules_owner_delete on public.class_lesson_schedules for delete to authenticated
using (public.owns_class(class_id));

drop policy if exists lessons_member_select on public.lessons;
drop policy if exists lessons_owner_insert on public.lessons;
drop policy if exists lessons_owner_update on public.lessons;
drop policy if exists lessons_owner_delete on public.lessons;
create policy lessons_course_select on public.lessons for select to authenticated using (
  public.is_course_owner(course_id) or public.is_admin() or exists (
    select 1 from public.class_lesson_schedules schedule
    where schedule.lesson_id = lessons.id
      and schedule.release_at is not null and schedule.release_at <= now()
      and public.is_class_member(schedule.class_id)
  )
);
create policy lessons_course_insert on public.lessons for insert to authenticated with check (
  created_by = auth.uid() and public.is_course_owner(course_id)
  and (class_id is null or exists (
    select 1 from public.classes class_row
    where class_row.id = class_id and class_row.course_id = lessons.course_id
  ))
  and (pdf_path is null or split_part(pdf_path, '/', 1) in (course_id::text, coalesce(class_id::text, '')))
);
create policy lessons_course_update on public.lessons for update to authenticated
using (public.is_course_owner(course_id)) with check (
  public.is_course_owner(course_id)
  and (class_id is null or exists (
    select 1 from public.classes class_row
    where class_row.id = class_id and class_row.course_id = lessons.course_id
  ))
  and (pdf_path is null or split_part(pdf_path, '/', 1) in (course_id::text, coalesce(class_id::text, '')))
);
create policy lessons_course_delete on public.lessons for delete to authenticated
using (public.is_course_owner(course_id));

-- Learning artifacts are accessible only through a released schedule (or to the
-- course owner previewing their own material).
drop policy if exists notes_owner_select on public.slide_notes;
drop policy if exists notes_owner_insert on public.slide_notes;
drop policy if exists notes_owner_update on public.slide_notes;
drop policy if exists notes_owner_delete on public.slide_notes;
create policy notes_owner_select on public.slide_notes for select to authenticated using (
  user_id = auth.uid() and public.can_access_class_lesson(class_id, lesson_id)
);
create policy notes_owner_insert on public.slide_notes for insert to authenticated with check (
  user_id = auth.uid() and public.can_access_class_lesson(class_id, lesson_id)
);
create policy notes_owner_update on public.slide_notes for update to authenticated
using (user_id = auth.uid()) with check (
  user_id = auth.uid()
  and public.can_access_class_lesson(class_id, lesson_id)
);
create policy notes_owner_delete on public.slide_notes for delete to authenticated using (
  user_id = auth.uid() and public.can_access_class_lesson(class_id, lesson_id)
);

drop policy if exists maps_owner_select on public.knowledge_maps;
drop policy if exists maps_owner_insert on public.knowledge_maps;
drop policy if exists maps_owner_update on public.knowledge_maps;
drop policy if exists maps_owner_delete on public.knowledge_maps;
create policy maps_owner_select on public.knowledge_maps for select to authenticated using (
  user_id = auth.uid() and public.can_access_class_lesson(class_id, lesson_id)
);
create policy maps_owner_insert on public.knowledge_maps for insert to authenticated with check (
  user_id = auth.uid() and public.can_access_class_lesson(class_id, lesson_id)
);
create policy maps_owner_update on public.knowledge_maps for update to authenticated
using (user_id = auth.uid()) with check (
  user_id = auth.uid()
  and public.can_access_class_lesson(class_id, lesson_id)
);
create policy maps_owner_delete on public.knowledge_maps for delete to authenticated using (
  user_id = auth.uid() and public.can_access_class_lesson(class_id, lesson_id)
);

drop policy if exists activities_self_insert on public.student_activities;
create policy activities_self_insert on public.student_activities for insert to authenticated with check (
  user_id = auth.uid()
  and public.can_access_class_lesson(class_id, lesson_id)
  and pg_column_size(metadata) <= 4096
  and (metadata - array['wordCount', 'nodeCount', 'status', 'slideId']) = '{}'::jsonb
  and (not (metadata ? 'slideId') or (jsonb_typeof(metadata -> 'slideId') = 'string' and char_length(metadata ->> 'slideId') between 1 and 120))
  and (not (metadata ? 'wordCount') or (jsonb_typeof(metadata -> 'wordCount') = 'number' and (metadata ->> 'wordCount')::numeric between 0 and 100000))
  and (not (metadata ? 'nodeCount') or (jsonb_typeof(metadata -> 'nodeCount') = 'number' and (metadata ->> 'nodeCount')::numeric between 0 and 10000))
  and (not (metadata ? 'status') or (jsonb_typeof(metadata -> 'status') = 'string' and char_length(metadata ->> 'status') between 1 and 50))
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

drop policy if exists activities_visible on public.student_activities;
create policy activities_visible on public.student_activities for select to authenticated
using (user_id = auth.uid() or public.owns_class(class_id) or public.is_admin());

drop policy if exists questions_member_select on public.community_questions;
drop policy if exists questions_member_insert on public.community_questions;
drop policy if exists questions_author_update on public.community_questions;
create policy questions_member_select on public.community_questions for select to authenticated using (
  (public.is_class_member(class_id) or public.owns_class(class_id))
  and (lesson_id is null or public.can_access_class_lesson(class_id, lesson_id))
);
create policy questions_member_insert on public.community_questions for insert to authenticated with check (
  author_id = auth.uid()
  and (public.is_class_member(class_id) or public.owns_class(class_id))
  and (lesson_id is null or public.can_access_class_lesson(class_id, lesson_id))
);
create policy questions_author_update on public.community_questions for update to authenticated
using (author_id = auth.uid()) with check (
  author_id = auth.uid()
  and (public.is_class_member(class_id) or public.owns_class(class_id))
  and (lesson_id is null or public.can_access_class_lesson(class_id, lesson_id))
);

drop policy if exists answers_member_select on public.community_answers;
drop policy if exists answers_member_insert on public.community_answers;
drop policy if exists answers_author_update on public.community_answers;
create policy answers_member_select on public.community_answers for select to authenticated using (exists (
  select 1 from public.community_questions question
  where question.id = community_answers.question_id
    and (public.is_class_member(question.class_id) or public.owns_class(question.class_id))
    and (question.lesson_id is null or public.can_access_class_lesson(question.class_id, question.lesson_id))
));
create policy answers_member_insert on public.community_answers for insert to authenticated with check (
  author_id = auth.uid()
  and exists (
    select 1 from public.community_questions question
    where question.id = community_answers.question_id
      and (public.is_class_member(question.class_id) or public.owns_class(question.class_id))
      and (question.lesson_id is null or public.can_access_class_lesson(question.class_id, question.lesson_id))
  )
);
create policy answers_author_update on public.community_answers for update to authenticated
using (author_id = auth.uid())
with check (
  author_id = auth.uid()
  and accepted_at is null
  and exists (
    select 1 from public.community_questions question
    where question.id = community_answers.question_id
      and (public.is_class_member(question.class_id) or public.owns_class(question.class_id))
      and (question.lesson_id is null or public.can_access_class_lesson(question.class_id, question.lesson_id))
  )
);

drop policy if exists lesson_pdfs_read on storage.objects;
drop policy if exists lesson_pdfs_insert on storage.objects;
drop policy if exists lesson_pdfs_update on storage.objects;
drop policy if exists lesson_pdfs_delete on storage.objects;
create policy lesson_pdfs_read on storage.objects for select to authenticated using (
  bucket_id = 'lesson-pdfs' and exists (
    select 1 from public.lessons lesson
    where lesson.pdf_path = name
      and (storage.foldername(name))[1] in (lesson.course_id::text, coalesce(lesson.class_id::text, ''))
      and (public.is_course_owner(lesson.course_id) or exists (
        select 1 from public.class_lesson_schedules schedule
        where schedule.lesson_id = lesson.id
          and public.can_access_class_lesson(schedule.class_id, lesson.id)
      ))
  )
);
create policy lesson_pdfs_insert on storage.objects for insert to authenticated with check (
  bucket_id = 'lesson-pdfs' and exists (
    select 1 from public.courses course
    where course.id::text = (storage.foldername(name))[1] and course.owner_id = auth.uid()
  )
);
create policy lesson_pdfs_update on storage.objects for update to authenticated using (
  bucket_id = 'lesson-pdfs' and exists (
    select 1 from public.lessons lesson
    where lesson.pdf_path = name and public.is_course_owner(lesson.course_id)
  )
) with check (
  bucket_id = 'lesson-pdfs' and exists (
    select 1 from public.lessons lesson
    where lesson.pdf_path = name and public.is_course_owner(lesson.course_id)
  )
);
create policy lesson_pdfs_delete on storage.objects for delete to authenticated using (
  bucket_id = 'lesson-pdfs' and exists (
    select 1 from public.courses course
    where course.id::text = (storage.foldername(name))[1] and course.owner_id = auth.uid()
  )
);

create or replace function public.create_course_secure(course_name text, course_description text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare new_course_id uuid;
begin
  if not public.is_teacher() then raise exception 'Teacher role required' using errcode = '42501'; end if;
  if char_length(trim(course_name)) not between 1 and 120 then raise exception 'Invalid course name' using errcode = '22023'; end if;
  insert into public.courses (owner_id, name, description)
  values (auth.uid(), trim(course_name), left(coalesce(course_description, ''), 2000))
  returning id into new_course_id;
  return new_course_id;
end;
$$;
revoke all on function public.create_course_secure(text, text) from public;
grant execute on function public.create_course_secure(text, text) to authenticated;

create or replace function public.create_class_for_course(target_course_id uuid, class_name text, class_description text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare new_class_id uuid; generated_token text;
begin
  if not public.is_course_owner(target_course_id) then raise exception 'Course owner required' using errcode = '42501'; end if;
  if char_length(trim(class_name)) not between 1 and 120 then raise exception 'Invalid class name' using errcode = '22023'; end if;
  loop
    generated_token := encode(extensions.gen_random_bytes(12), 'hex');
    begin
      insert into public.classes (course_id, teacher_id, name, description, join_code_hash)
      values (target_course_id, auth.uid(), trim(class_name), left(coalesce(class_description, ''), 2000), encode(extensions.digest(generated_token, 'sha256'), 'hex'))
      returning id into new_class_id;
      exit;
    exception when unique_violation then null;
    end;
  end loop;
  insert into public.class_memberships (class_id, user_id, role)
  values (new_class_id, auth.uid(), 'teacher');
  insert into public.class_lesson_schedules (class_id, course_id, lesson_id)
  select new_class_id, target_course_id, id from public.lessons where course_id = target_course_id;
  return jsonb_build_object('classId', new_class_id, 'joinCode', generated_token);
end;
$$;
revoke all on function public.create_class_for_course(uuid, text, text) from public;
grant execute on function public.create_class_for_course(uuid, text, text) to authenticated;

create or replace function public.load_course_lessons(target_course_id uuid)
returns table (
  id text, class_id uuid, course_id uuid, created_by uuid, title text, short_name text,
  description text, prompt text, pdf_path text, published_at timestamptz,
  created_at timestamptz, updated_at timestamptz, available_at timestamptz
) language plpgsql stable security definer set search_path = '' as $$
begin
  if not (public.is_course_owner(target_course_id) or public.is_admin()) then
    raise exception 'Course owner or admin required' using errcode = '42501';
  end if;
  return query
  select lesson.id, null::uuid, lesson.course_id, lesson.created_by, lesson.title,
    lesson.short_name, lesson.description, lesson.prompt, lesson.pdf_path,
    null::timestamptz, lesson.created_at, lesson.updated_at, null::timestamptz
  from public.lessons lesson
  where lesson.course_id = target_course_id
  order by lesson.created_at, lesson.id;
end;
$$;
revoke all on function public.load_course_lessons(uuid) from public;
grant execute on function public.load_course_lessons(uuid) to authenticated;

create or replace function public.load_class_lessons(target_class_id uuid)
returns table (
  id text, class_id uuid, course_id uuid, created_by uuid, title text, short_name text,
  description text, prompt text, pdf_path text, published_at timestamptz,
  created_at timestamptz, updated_at timestamptz, available_at timestamptz
) language plpgsql stable security definer set search_path = '' as $$
begin
  if not (public.owns_class(target_class_id) or public.is_class_member(target_class_id) or public.is_admin()) then
    raise exception 'Class access required' using errcode = '42501';
  end if;
  return query
  select lesson.id, schedule.class_id, lesson.course_id, lesson.created_by, lesson.title,
    lesson.short_name, lesson.description, lesson.prompt, lesson.pdf_path,
    schedule.release_at, lesson.created_at, lesson.updated_at, schedule.release_at
  from public.class_lesson_schedules schedule
  join public.lessons lesson on lesson.id = schedule.lesson_id and lesson.course_id = schedule.course_id
  where schedule.class_id = target_class_id
    and (public.owns_class(target_class_id) or public.is_admin() or (schedule.release_at is not null and schedule.release_at <= now()))
  order by lesson.created_at, lesson.id;
end;
$$;
revoke all on function public.load_class_lessons(uuid) from public;
grant execute on function public.load_class_lessons(uuid) to authenticated;

create or replace function public.set_class_lesson_release(target_class_id uuid, target_lesson_id text, release_at timestamptz)
returns void language plpgsql security definer set search_path = '' as $$
declare target_course_id uuid;
begin
  select course_id into target_course_id from public.classes
  where id = target_class_id and teacher_id = auth.uid() and archived_at is null;
  if target_course_id is null then raise exception 'Class owner required' using errcode = '42501'; end if;
  if not public.lesson_belongs_to_course(target_lesson_id, target_course_id) then
    raise exception 'Lesson does not belong to class course' using errcode = '23503';
  end if;
  insert into public.class_lesson_schedules (class_id, course_id, lesson_id, release_at)
  values (target_class_id, target_course_id, target_lesson_id, release_at)
  on conflict (class_id, lesson_id) do update set release_at = excluded.release_at;
end;
$$;
revoke all on function public.set_class_lesson_release(uuid, text, timestamptz) from public;
grant execute on function public.set_class_lesson_release(uuid, text, timestamptz) to authenticated;

-- Compatibility for clients deployed before the course picker existed: create a
-- one-class course rather than allowing a class without a parent course.
create or replace function public.create_class_secure(class_name text, class_description text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare new_course_id uuid;
begin
  new_course_id := public.create_course_secure(class_name, class_description);
  return public.create_class_for_course(new_course_id, class_name, class_description);
end;
$$;
revoke all on function public.create_class_secure(text, text) from public;
grant execute on function public.create_class_secure(text, text) to authenticated;

commit;
