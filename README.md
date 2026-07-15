# Vital Passport

**Your health story, ready when it matters.**

Vital Passport is a patient-controlled health intelligence product that turns scattered documents, medication photos, symptoms, labs, and questions into a coherent, source-linked clinician brief.

## Hackathon product

- Real image and text extraction through Nebius Token Factory
- Meta Llama multimodal analysis with structured, source-supported output
- Medication and laboratory reconciliation engine
- Conflicting instructions preserved and resolved by patient confirmation
- Care tasks, timeline events, and clinician brief generated from the structured record
- Local-first persistence that survives browser restarts
- Optional Supabase magic-link accounts and cross-device cloud synchronization
- Row-level database policies that restrict each record to its authenticated owner
- Adaptive pre-visit interview and source-linked clinician brief
- Download, print, QR-code, and sharing demonstrations
- Responsive desktop and mobile interface

The included demo patient and records are entirely synthetic. Do not use identifiable patient information until privacy, security, retention, regulatory, and clinical-safety requirements have been reviewed and implemented.

## Nebius setup on Vercel

Add the following environment variable to the Vercel project:

```text
NEBIUS_API_KEY=your_token_factory_key
```

The server automatically discovers vision-capable models available to the Nebius account and prioritizes Meta Llama. `NEBIUS_MODEL` may be set when a specific model must be used.

```text
NEBIUS_MODEL=the_exact_model_identifier
```

Redeploy after changing server environment variables. The key is read only by the Vercel function in `api/extract.js` and is never exposed to the browser.

## Supabase account persistence

Vital Passport works without Supabase. In local mode, the complete structured patient record is retained in browser storage. Supabase adds passwordless email sign-in and cross-device persistence.

### 1. Create a Supabase project

Create a project and open its SQL Editor.

### 2. Create the protected patient-record table

Run the contents of:

```text
supabase/schema.sql
```

The table uses Row Level Security. Authenticated users can select, insert, and update only the row whose `user_id` matches their Supabase identity.

### 3. Configure authentication URLs

In Supabase Auth URL settings, use:

```text
Site URL: https://vitalpassport.com
Redirect URL: https://vitalpassport.com/**
```

Add the Vercel preview domain as an additional redirect URL when preview authentication is needed.

### 4. Add Vercel variables

From the Supabase project Connect dialog, copy the Project URL and publishable key into Vercel:

```text
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=your_publishable_key
```

These values are intentionally browser-visible. Access control is enforced by authenticated JWTs and the database RLS policies. Never place a Supabase service-role key in a `VITE_` variable.

Redeploy after adding the variables.

### 5. Sign in from Vital Passport

Open the cloud-status control in the sidebar, enter an email address, and use the magic link. On first sign-in:

- An existing local record is uploaded when no cloud copy exists.
- An existing cloud record is restored when one is present.
- Future changes are saved automatically after a short debounce.
- The account panel provides manual save and cloud-reload controls.

## Record architecture

A single versioned patient snapshot contains:

- Patient interview answers
- Upload metadata and structured extractions
- Source records and provenance
- Timeline events
- Reconciled medication records
- Laboratory observations and trends
- Open and resolved discrepancies
- Care and follow-up tasks

The browser maintains an offline local copy. Signed-in users additionally store the snapshot in `public.patient_records`, scoped to their authenticated user ID.

## Extraction flow

1. The browser resizes a JPG, PNG, or WebP image before upload.
2. The same-origin `/api/extract` Vercel function validates the request.
3. The function calls Nebius using its OpenAI-compatible endpoint.
4. The model returns structured health information.
5. The server normalizes the response and preserves evidence and uncertainty.
6. The patient confirms the extraction before it enters the health record.
7. The reconciliation engine compares it with existing source-supported facts.

PDFs are not parsed yet. Photograph the relevant page or paste its text.

## Development

```bash
npm install
npm run dev
```

Validate a production build with:

```bash
npm run check
npm run build
node --check api/extract.js
```

GitHub Actions runs the TypeScript and production builds for every feature branch and pull request.

## Next technical milestones

1. Multi-page PDF ingestion and document splitting
2. Real expiring clinic-sharing records with access logs
3. FHIR-compatible patient-summary export
4. Caregiver and dependent profiles
5. Security, privacy, regulatory, and clinical-safety hardening

## Safety

Vital Passport organizes patient-provided information. It does not diagnose conditions, recommend medication changes, or replace professional medical care.
