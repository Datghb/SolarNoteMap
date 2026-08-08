begin;

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  requested_name text;
  requested_avatar text;
begin
  requested_name := nullif(trim(coalesce(
    new.raw_user_meta_data ->> 'display_name',
    new.raw_user_meta_data ->> 'full_name',
    new.raw_user_meta_data ->> 'name',
    ''
  )), '');
  requested_avatar := nullif(trim(coalesce(
    new.raw_user_meta_data ->> 'avatar_url',
    new.raw_user_meta_data ->> 'picture',
    ''
  )), '');

  insert into public.profiles (id, display_name, avatar_url)
  values (
    new.id,
    left(coalesce(requested_name, split_part(coalesce(new.email, 'Student'), '@', 1), 'Student'), 80),
    left(requested_avatar, 2048)
  );
  return new;
end;
$$;

commit;
