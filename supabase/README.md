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

6. Users enter the personal learning space directly. Built-in lessons, teacher-created lessons, notes, maps, and activity are stored locally on the current device.

## Bootstrapping the first administrator

After applying `20260729180000_admin_accounts.sql`, register the administrator normally, then run this once in SQL Editor:

```sql
update public.profiles
set role = 'admin'
where id = (select id from auth.users where email = 'admin@example.com');
```

Sign out and back in. Admins open the account dashboard automatically and can switch non-admin accounts between student and teacher roles. Admin accounts cannot demote themselves or other admins from the dashboard.

## Security notes

- Never expose a Supabase secret/service-role key in a `VITE_` variable.
- All application tables have Row Level Security enabled.
