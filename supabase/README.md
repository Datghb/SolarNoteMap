# Supabase setup

1. Create a Supabase project.
2. Open **SQL Editor** and run `migrations/20260729103000_initial_auth_classroom.sql`.
3. Copy the Project URL and Publishable key into `.env.local`:

   ```env
   VITE_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
   VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_YOUR_KEY
   ```

4. Restart the app and register the first account.
5. Bootstrap only the first teacher in SQL Editor, replacing the email:

   ```sql
   update public.profiles
   set role = 'teacher'
   where id = (select id from auth.users where email = 'teacher@example.com');
   ```

6. The teacher can create a class and choose a private join code (at least 8 characters). Students register normally, then enter that code.

## Creating another teacher invite

Choose a random secret of at least 24 characters and insert only its SHA-256 hash. Send the original secret to the invited teacher through a private channel.

```sql
insert into public.teacher_invites (token_hash, created_by, expires_at)
select
  encode(extensions.digest('REPLACE_WITH_A_LONG_RANDOM_SECRET', 'sha256'), 'hex'),
  id,
  now() + interval '7 days'
from public.profiles
where id = auth.uid() and role = 'teacher';
```

When running this statement directly in SQL Editor, `auth.uid()` may be null. Replace it with the teacher profile UUID in that case.

## Security notes

- Never expose a Supabase secret/service-role key in a `VITE_` variable.
- The `lesson-pdfs` bucket is private and restricted to PDFs up to 50 MB.
- All application tables have Row Level Security enabled.
- Teachers can see activity only for classes they own. Students can access only their own learning records and published lessons in joined classes.
