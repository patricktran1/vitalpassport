# Activation checklist

After this branch is deployed:

1. Run the latest `supabase/schema.sql` in the Vital Passport Supabase SQL Editor.
2. Confirm `source_documents` exists in Data Editor.
3. Confirm the private `patient-sources` bucket exists in Storage.
4. Follow `docs/GOOGLE_AUTH_SETUP.md` to enable Google.
5. Redeploy Vital Passport if any Vercel environment variable changed.
6. Sign in, upload a small PDF or image, confirm it, and open **Private sources**.
7. Open the original through its signed link, then test deletion.

Keep all testing synthetic until the production privacy, security, regulatory, and clinical-safety controls are complete.
