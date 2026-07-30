# Supabase setup

1. Create a Supabase project.
2. Open **SQL Editor** and run every migration in timestamp order through `20260730110000_admin_role_management.sql`.
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

6. Teachers create a shared course program, add reusable PDF lessons, then create one or more classes. Each class receives a server-generated private join code and its own lesson release schedule.
7. Students enter a class code once, can switch between joined classes, and only see lessons released for the selected class. Notes, maps, questions and activity are isolated by class.
8. Admins can inspect accounts, programs, and classes without receiving access to students' private notes or maps.

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
- Join codes are stored as hashes; the original code should be shared privately.
- Failed join attempts are rate-limited per account.
- Lesson PDFs remain private and are delivered through expiring signed URLs.
