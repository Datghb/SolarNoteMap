begin;

create table public.lesson_summary_chats (
  lesson_id text not null references public.lessons(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  messages jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (lesson_id, user_id),
  constraint lesson_summary_chats_messages_array check (jsonb_typeof(messages) = 'array'),
  constraint lesson_summary_chats_messages_size check (pg_column_size(messages) <= 500000)
);

create trigger lesson_summary_chats_set_updated_at
before update on public.lesson_summary_chats
for each row execute function public.set_updated_at();

alter table public.lesson_summary_chats enable row level security;

create policy summary_chats_owner_select on public.lesson_summary_chats
for select to authenticated using (
  user_id = auth.uid()
  and exists (select 1 from public.lessons where id = lesson_summary_chats.lesson_id)
);

create policy summary_chats_owner_insert on public.lesson_summary_chats
for insert to authenticated with check (
  user_id = auth.uid()
  and exists (select 1 from public.lessons where id = lesson_summary_chats.lesson_id)
);

create policy summary_chats_owner_update on public.lesson_summary_chats
for update to authenticated
using (user_id = auth.uid())
with check (
  user_id = auth.uid()
  and exists (select 1 from public.lessons where id = lesson_summary_chats.lesson_id)
);

create policy summary_chats_owner_delete on public.lesson_summary_chats
for delete to authenticated using (user_id = auth.uid());

commit;
