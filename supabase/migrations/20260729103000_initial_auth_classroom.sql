begin;

create extension if not exists pgcrypto with schema extensions;

create type public.user_role as enum ('student', 'teacher');
create type public.membership_role as enum ('student', 'teacher');
create type public.activity_kind as enum ('lesson_viewed', 'note_created', 'map_created', 'question_posted', 'answer_posted');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  role public.user_role not null default 'student',
  display_name text not null check (char_length(trim(display_name)) between 1 and 80),
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.teacher_invites (
  id uuid primary key default gen_random_uuid(),
  token_hash text not null unique,
  created_by uuid not null references public.profiles(id) on delete restrict,
  expires_at timestamptz not null,
  redeemed_by uuid unique references public.profiles(id) on delete set null,
  redeemed_at timestamptz,
  created_at timestamptz not null default now(),
  constraint teacher_invites_redemption_complete check (
    (redeemed_by is null and redeemed_at is null) or
    (redeemed_by is not null and redeemed_at is not null)
  ),
  constraint teacher_invites_future_expiry check (expires_at > created_at)
);

create table public.classes (
  id uuid primary key default gen_random_uuid(),
  teacher_id uuid not null references public.profiles(id) on delete restrict,
  name text not null check (char_length(trim(name)) between 1 and 120),
  description text not null default '' check (char_length(description) <= 2000),
  join_code_hash text unique,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.class_memberships (
  class_id uuid not null references public.classes(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  role public.membership_role not null default 'student',
  joined_at timestamptz not null default now(),
  primary key (class_id, user_id)
);

create table public.lessons (
  id text primary key check (id ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$' and char_length(id) between 1 and 120),
  class_id uuid not null references public.classes(id) on delete cascade,
  created_by uuid not null references public.profiles(id) on delete restrict,
  title text not null check (char_length(trim(title)) between 1 and 180),
  short_name text not null check (char_length(trim(short_name)) between 1 and 80),
  description text not null default '' check (char_length(description) <= 4000),
  prompt text not null default '' check (char_length(prompt) <= 2000),
  pdf_path text check (pdf_path is null or (pdf_path !~ '(^|/)\.\.(/|$)' and pdf_path !~ '^/')),
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.slide_notes (
  id uuid primary key default gen_random_uuid(),
  lesson_id text not null references public.lessons(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  slide_number integer not null check (slide_number > 0),
  content text not null default '' check (char_length(content) <= 20000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (lesson_id, user_id, slide_number)
);

create table public.knowledge_maps (
  id uuid primary key default gen_random_uuid(),
  lesson_id text not null references public.lessons(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  title text not null check (char_length(trim(title)) between 1 and 180),
  graph jsonb not null default '{"nodes":[],"edges":[]}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint knowledge_maps_graph_object check (jsonb_typeof(graph) = 'object')
);

create table public.student_activities (
  id bigint generated always as identity primary key,
  user_id uuid not null references public.profiles(id) on delete cascade,
  class_id uuid not null references public.classes(id) on delete cascade,
  lesson_id text references public.lessons(id) on delete cascade,
  kind public.activity_kind not null,
  metadata jsonb not null default '{}'::jsonb check (jsonb_typeof(metadata) = 'object'),
  occurred_at timestamptz not null default now()
);

create table public.community_questions (
  id uuid primary key default gen_random_uuid(),
  class_id uuid not null references public.classes(id) on delete cascade,
  lesson_id text references public.lessons(id) on delete set null,
  author_id uuid not null references public.profiles(id) on delete cascade,
  title text not null check (char_length(trim(title)) between 1 and 240),
  body text not null check (char_length(trim(body)) between 1 and 20000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.community_answers (
  id uuid primary key default gen_random_uuid(),
  question_id uuid not null references public.community_questions(id) on delete cascade,
  author_id uuid not null references public.profiles(id) on delete cascade,
  body text not null check (char_length(trim(body)) between 1 and 20000),
  accepted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index class_memberships_user_id_idx on public.class_memberships(user_id);
create index classes_teacher_id_idx on public.classes(teacher_id);
create index lessons_class_published_idx on public.lessons(class_id, published_at);
create index slide_notes_user_lesson_idx on public.slide_notes(user_id, lesson_id);
create index knowledge_maps_user_lesson_idx on public.knowledge_maps(user_id, lesson_id);
create index student_activities_class_time_idx on public.student_activities(class_id, occurred_at desc);
create index student_activities_user_time_idx on public.student_activities(user_id, occurred_at desc);
create index community_questions_class_time_idx on public.community_questions(class_id, created_at desc);
create index community_answers_question_time_idx on public.community_answers(question_id, created_at);
create index teacher_invites_active_idx on public.teacher_invites(expires_at) where redeemed_at is null;

create function public.set_updated_at()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_set_updated_at before update on public.profiles for each row execute function public.set_updated_at();
create trigger classes_set_updated_at before update on public.classes for each row execute function public.set_updated_at();
create trigger lessons_set_updated_at before update on public.lessons for each row execute function public.set_updated_at();
create trigger slide_notes_set_updated_at before update on public.slide_notes for each row execute function public.set_updated_at();
create trigger knowledge_maps_set_updated_at before update on public.knowledge_maps for each row execute function public.set_updated_at();
create trigger community_questions_set_updated_at before update on public.community_questions for each row execute function public.set_updated_at();
create trigger community_answers_set_updated_at before update on public.community_answers for each row execute function public.set_updated_at();

create function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  requested_name text;
begin
  requested_name := nullif(trim(coalesce(new.raw_user_meta_data ->> 'display_name', '')), '');
  insert into public.profiles (id, display_name)
  values (new.id, left(coalesce(requested_name, split_part(coalesce(new.email, 'Student'), '@', 1), 'Student'), 80));
  return new;
end;
$$;

create trigger on_auth_user_created after insert on auth.users
for each row execute function public.handle_new_user();

create function public.is_teacher()
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role = 'teacher');
$$;

create function public.is_class_member(target_class_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.class_memberships
    where class_id = target_class_id and user_id = auth.uid()
  );
$$;

create function public.owns_class(target_class_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.classes where id = target_class_id and teacher_id = auth.uid()
  );
$$;

revoke all on function public.is_teacher() from public;
revoke all on function public.is_class_member(uuid) from public;
revoke all on function public.owns_class(uuid) from public;
grant execute on function public.is_teacher() to authenticated;
grant execute on function public.is_class_member(uuid) to authenticated;
grant execute on function public.owns_class(uuid) to authenticated;

create function public.redeem_teacher_invite(invite_token text)
returns boolean language plpgsql security definer set search_path = '' as $$
declare
  claimed_id uuid;
begin
  if auth.uid() is null or char_length(invite_token) < 24 then
    return false;
  end if;

  update public.teacher_invites
  set redeemed_by = auth.uid(), redeemed_at = now()
  where token_hash = encode(extensions.digest(invite_token, 'sha256'), 'hex')
    and redeemed_at is null
    and expires_at > now()
  returning id into claimed_id;

  if claimed_id is null then return false; end if;
  update public.profiles set role = 'teacher' where id = auth.uid();
  return true;
end;
$$;
revoke all on function public.redeem_teacher_invite(text) from public;
grant execute on function public.redeem_teacher_invite(text) to authenticated;

create function public.create_class_with_code(class_name text, class_description text, join_token text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  new_class_id uuid;
begin
  if not public.is_teacher() then raise exception 'Teacher role required'; end if;
  if char_length(trim(class_name)) not between 1 and 120 then raise exception 'Invalid class name'; end if;
  if char_length(join_token) < 8 then raise exception 'Join code must contain at least 8 characters'; end if;
  insert into public.classes (teacher_id, name, description, join_code_hash)
  values (auth.uid(), trim(class_name), left(coalesce(class_description, ''), 2000), encode(extensions.digest(join_token, 'sha256'), 'hex'))
  returning id into new_class_id;
  insert into public.class_memberships (class_id, user_id, role) values (new_class_id, auth.uid(), 'teacher');
  return new_class_id;
end;
$$;
revoke all on function public.create_class_with_code(text, text, text) from public;
grant execute on function public.create_class_with_code(text, text, text) to authenticated;

create function public.join_class(join_token text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  target_class_id uuid;
begin
  if auth.uid() is null or char_length(join_token) < 8 then return null; end if;
  select id into target_class_id from public.classes
  where join_code_hash = encode(extensions.digest(join_token, 'sha256'), 'hex') and archived_at is null;
  if target_class_id is null then return null; end if;
  insert into public.class_memberships (class_id, user_id, role)
  values (target_class_id, auth.uid(), 'student')
  on conflict (class_id, user_id) do nothing;
  return target_class_id;
end;
$$;
revoke all on function public.join_class(text) from public;
grant execute on function public.join_class(text) to authenticated;

alter table public.profiles enable row level security;
alter table public.teacher_invites enable row level security;
alter table public.classes enable row level security;
alter table public.class_memberships enable row level security;
alter table public.lessons enable row level security;
alter table public.slide_notes enable row level security;
alter table public.knowledge_maps enable row level security;
alter table public.student_activities enable row level security;
alter table public.community_questions enable row level security;
alter table public.community_answers enable row level security;

create policy profiles_select on public.profiles for select to authenticated
using (id = auth.uid() or exists (
  select 1 from public.class_memberships mine join public.class_memberships theirs using (class_id)
  where mine.user_id = auth.uid() and theirs.user_id = profiles.id
));
create policy profiles_update_self on public.profiles for update to authenticated
using (id = auth.uid()) with check (id = auth.uid());

revoke update on public.profiles from authenticated;
grant update (display_name, avatar_url) on public.profiles to authenticated;

create policy teacher_invites_teacher_select on public.teacher_invites for select to authenticated using (public.is_teacher());
create policy teacher_invites_teacher_insert on public.teacher_invites for insert to authenticated
with check (public.is_teacher() and created_by = auth.uid() and redeemed_by is null);
create policy teacher_invites_creator_delete on public.teacher_invites for delete to authenticated using (created_by = auth.uid() and redeemed_at is null);

create policy classes_member_select on public.classes for select to authenticated using (public.is_class_member(id) or teacher_id = auth.uid());
create policy classes_teacher_insert on public.classes for insert to authenticated with check (teacher_id = auth.uid() and public.is_teacher());
create policy classes_owner_update on public.classes for update to authenticated using (teacher_id = auth.uid()) with check (teacher_id = auth.uid());
create policy classes_owner_delete on public.classes for delete to authenticated using (teacher_id = auth.uid());

create policy memberships_member_select on public.class_memberships for select to authenticated using (public.is_class_member(class_id) or public.owns_class(class_id));
create policy memberships_owner_insert on public.class_memberships for insert to authenticated
with check (public.owns_class(class_id) and (role = 'student' or user_id = auth.uid()));
create policy memberships_owner_update on public.class_memberships for update to authenticated using (public.owns_class(class_id)) with check (public.owns_class(class_id));
create policy memberships_owner_delete on public.class_memberships for delete to authenticated using (public.owns_class(class_id) or user_id = auth.uid());

create policy lessons_member_select on public.lessons for select to authenticated
using (public.owns_class(class_id) or (public.is_class_member(class_id) and published_at is not null));
create policy lessons_owner_insert on public.lessons for insert to authenticated with check (
  public.owns_class(class_id) and created_by = auth.uid()
  and (pdf_path is null or split_part(pdf_path, '/', 1) = class_id::text)
);
create policy lessons_owner_update on public.lessons for update to authenticated using (public.owns_class(class_id)) with check (
  public.owns_class(class_id) and (pdf_path is null or split_part(pdf_path, '/', 1) = class_id::text)
);
create policy lessons_owner_delete on public.lessons for delete to authenticated using (public.owns_class(class_id));

create policy notes_owner_select on public.slide_notes for select to authenticated using (user_id = auth.uid());
create policy notes_owner_insert on public.slide_notes for insert to authenticated with check (
  user_id = auth.uid() and exists (select 1 from public.lessons l where l.id = lesson_id and (public.owns_class(l.class_id) or (public.is_class_member(l.class_id) and l.published_at is not null)))
);
create policy notes_owner_update on public.slide_notes for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy notes_owner_delete on public.slide_notes for delete to authenticated using (user_id = auth.uid());

create policy maps_owner_select on public.knowledge_maps for select to authenticated using (user_id = auth.uid());
create policy maps_owner_insert on public.knowledge_maps for insert to authenticated with check (
  user_id = auth.uid() and exists (select 1 from public.lessons l where l.id = lesson_id and (public.owns_class(l.class_id) or (public.is_class_member(l.class_id) and l.published_at is not null)))
);
create policy maps_owner_update on public.knowledge_maps for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy maps_owner_delete on public.knowledge_maps for delete to authenticated using (user_id = auth.uid());

create policy activities_visible on public.student_activities for select to authenticated using (user_id = auth.uid() or public.owns_class(class_id));
create policy activities_self_insert on public.student_activities for insert to authenticated with check (user_id = auth.uid() and public.is_class_member(class_id));

create policy questions_member_select on public.community_questions for select to authenticated using (public.is_class_member(class_id) or public.owns_class(class_id));
create policy questions_member_insert on public.community_questions for insert to authenticated with check (author_id = auth.uid() and (public.is_class_member(class_id) or public.owns_class(class_id)));
create policy questions_author_update on public.community_questions for update to authenticated using (author_id = auth.uid()) with check (author_id = auth.uid() and (public.is_class_member(class_id) or public.owns_class(class_id)));
create policy questions_author_or_teacher_delete on public.community_questions for delete to authenticated using (author_id = auth.uid() or public.owns_class(class_id));

create policy answers_member_select on public.community_answers for select to authenticated using (exists (
  select 1 from public.community_questions q where q.id = question_id and (public.is_class_member(q.class_id) or public.owns_class(q.class_id))
));
create policy answers_member_insert on public.community_answers for insert to authenticated with check (author_id = auth.uid() and exists (
  select 1 from public.community_questions q where q.id = question_id and (public.is_class_member(q.class_id) or public.owns_class(q.class_id))
));
create policy answers_author_update on public.community_answers for update to authenticated using (author_id = auth.uid())
with check (author_id = auth.uid() and accepted_at is null);
create policy answers_author_or_teacher_delete on public.community_answers for delete to authenticated using (author_id = auth.uid() or exists (
  select 1 from public.community_questions q where q.id = question_id and public.owns_class(q.class_id)
));

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('lesson-pdfs', 'lesson-pdfs', false, 52428800, array['application/pdf'])
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

create policy lesson_pdfs_read on storage.objects for select to authenticated using (
  bucket_id = 'lesson-pdfs' and exists (
    select 1 from public.lessons l
    where l.pdf_path = name
      and (storage.foldername(name))[1] = l.class_id::text
      and (public.owns_class(l.class_id) or (public.is_class_member(l.class_id) and l.published_at is not null))
  )
);
create policy lesson_pdfs_insert on storage.objects for insert to authenticated with check (
  bucket_id = 'lesson-pdfs' and exists (
    select 1 from public.classes c where c.id::text = (storage.foldername(name))[1] and c.teacher_id = auth.uid()
  )
);
create policy lesson_pdfs_update on storage.objects for update to authenticated using (
  bucket_id = 'lesson-pdfs' and exists (
    select 1 from public.classes c where c.id::text = (storage.foldername(name))[1] and c.teacher_id = auth.uid()
  )
) with check (bucket_id = 'lesson-pdfs' and exists (
  select 1 from public.classes c where c.id::text = (storage.foldername(name))[1] and c.teacher_id = auth.uid()
));
create policy lesson_pdfs_delete on storage.objects for delete to authenticated using (
  bucket_id = 'lesson-pdfs' and exists (
    select 1 from public.classes c where c.id::text = (storage.foldername(name))[1] and c.teacher_id = auth.uid()
  )
);

commit;
