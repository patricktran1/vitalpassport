# Activate Supabase for Vital Passport

Vital Passport remains usable in local browser mode until Supabase is configured. Supabase activates passwordless accounts, Google authentication, complete cross-device persistence, private original-source storage, and live revocable clinician links.

## 1. Create the project

Create a Supabase project in the Supabase dashboard. The free plan is sufficient for the current synthetic prototype.

## 2. Install the database and storage schema

Open **SQL Editor**, paste the complete contents of `supabase/schema.sql`, and run it.

The script is rerunnable. Run the latest version again whenever repository migrations add a table, policy, function, or bucket.

The script creates and secures:

- `public.patient_records`, one versioned cloud bundle per authenticated user
- `public.source_documents`, original-source metadata, checksums, and extraction provenance
- the private `patient-sources` Storage bucket with a 25 MB per-file limit
- Storage policies that restrict every object path to its authenticated user-ID folder
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

Original PDFs and images are kept separately in private Storage. Manual source text and all source provenance are stored in `public.source_documents`.

Raw clinician-link secrets, Supabase auth tokens, Google credentials, and service-role credentials are deliberately excluded from the cloud bundle.

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

## 5. Optional: activate Google Sign-In

Follow `docs/GOOGLE_AUTH_SETUP.md` to create a Google web OAuth client and enable the Google provider in Supabase.

Magic-link sign-in remains available as a fallback.

## 6. Verify accounts and source storage

1. Open Vital Passport.
2. Open the cloud-status card in the sidebar.
3. Confirm that it shows **Sign in to save** rather than **Local record**.
4. Sign in with Google or a magic link.
5. Confirm that the account panel reports cloud bundle schema v2.
6. Upload and confirm a small PDF or image.
7. Open **Private sources** and verify the source appears with its checksum.
8. Choose **Open original** and confirm a new short-lived signed link opens the file.
9. In Supabase, confirm one row exists in `source_documents` and the object path begins with the authenticated user ID.
10. Open a second browser or device, sign in with the same account, and verify both the health record and private-source metadata restore.

## Failure messages

- **Database schema is missing:** run the latest `supabase/schema.sql` in SQL Editor.
- **Private source storage is not installed:** rerun the latest schema to create `source_documents`, the bucket, and Storage policies.
- **Row Level Security rejected the record:** confirm the schema completed and the user is authenticated.
- **Still shows Local record:** verify both `VITE_SUPABASE_*` variables exist in Vercel and redeploy.
- **Magic link returns to the wrong address:** correct the Supabase Site URL and Redirect URLs.
- **Google provider is not enabled:** complete `docs/GOOGLE_AUTH_SETUP.md`.

## Deletion behavior

Deleting the cloud record removes:

- the patient bundle
- private original files
- source-document metadata
- clinician share rows

The Supabase authentication identity remains so the user can sign in again and start a blank Passport.

## Prototype boundary

The implementation provides authenticated persistence, row isolation, private file storage, and account-controlled deletion, but this alone does not make the product HIPAA compliant. Real patient use still requires an appropriate Supabase plan and agreements, security and privacy review, retention policies, monitoring, incident response, access governance, and clinical-safety validation.
