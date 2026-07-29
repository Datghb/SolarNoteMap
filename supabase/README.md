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

## Google sign-in

1. In Google Cloud, create an OAuth 2.0 Web client.
2. Add `https://YOUR_PROJECT_REF.supabase.co/auth/v1/callback` as an authorized redirect URI.
3. In Supabase Dashboard, open **Authentication → Providers → Google**, enable Google, then add the Google client ID and client secret.
4. In **Authentication → URL Configuration**, add `http://localhost:5173` and the production application URL to Redirect URLs.

The application sends users back to the current origin after Google authentication, so every origin used for testing or deployment must be allowlisted.

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
- Google OAuth secrets belong only in Google Cloud and the Supabase provider configuration, never in client environment variables.
