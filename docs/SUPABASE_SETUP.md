# Activate Supabase for Vital Passport

Vital Passport remains fully usable in local browser mode until Supabase is configured. Supabase activates passwordless accounts, complete cross-device persistence, and live revocable clinician links.

## 1. Create the project

Create a Supabase project in the Supabase dashboard. The free plan is sufficient for the current prototype.

## 2. Install the database schema

Open **SQL Editor**, paste the complete contents of `supabase/schema.sql`, and run it once.

The script creates and secures:

- `public.patient_records`, one versioned cloud bundle per authenticated user
- `public.shared_briefs`, frozen clinician packets with hashed share secrets
- Row Level Security policies scoped with `auth.uid()`
- `public.get_shared_brief(text)`, the narrow public token resolver

The cloud bundle currently carries:

- Core structured health record
- Health Inbox decisions
- Check-in schedules and responses
- Mock reminder delivery history and demo destinations
- Patient-controlled Copilot memory
- Health Signals snapshots
- Apple Health demo permissions, summaries, and sync receipts

Raw clinician-link secrets, Supabase auth tokens, and service-role credentials are deliberately excluded from the cloud bundle.

## 3. Configure Supabase Auth URLs

In **Authentication → URL Configuration**, set:

```text
Site URL: https://vitalpassport.com
Redirect URL: https://vitalpassport.com/**
```

Add the Vercel preview domain pattern only when preview-deployment login is needed.

## 4. Add Vercel environment variables

Open the Supabase project **Connect** panel and copy:

```text
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=your_publishable_key
```

Add both variables to the Vital Passport Vercel project for Production, Preview, and Development as appropriate, then redeploy.

Do not expose a Supabase service-role or secret key through a `VITE_` variable.

## 5. Verify the connection

1. Open Vital Passport.
2. Open the cloud-status card in the sidebar.
3. Confirm that it shows **Sign in to save** rather than **Local record**.
4. Send yourself a magic link and sign in.
5. Confirm that the account panel reports cloud bundle schema v2 and the synchronized data groups.
6. Change a check-in or memory item, wait a few seconds, and confirm the cloud-save timestamp updates.
7. Open a second browser or device, sign in with the same email, and verify the complete state restores.

## Failure messages

- **Database schema is missing:** run `supabase/schema.sql` in SQL Editor.
- **Row Level Security rejected the record:** confirm the schema completed and the user is authenticated.
- **Still shows Local record:** verify both `VITE_SUPABASE_*` variables exist in Vercel and redeploy.
- **Magic link returns to the wrong address:** correct the Supabase Site URL and Redirect URLs.

## Prototype boundary

The implementation provides authenticated persistence and row isolation, but this alone does not make the product HIPAA compliant. Real patient use still requires an appropriate Supabase plan and agreements, security and privacy review, retention and deletion policies, monitoring, incident response, access governance, and clinical-safety validation.
