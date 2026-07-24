# Vital Passport

[![CI](https://github.com/patricktran1/vitalpassport/actions/workflows/ci.yml/badge.svg)](https://github.com/patricktran1/vitalpassport/actions/workflows/ci.yml)
[![CodeQL](https://github.com/patricktran1/vitalpassport/actions/workflows/codeql.yml/badge.svg)](https://github.com/patricktran1/vitalpassport/actions/workflows/codeql.yml)

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
- Expiring, revocable, view-only clinic links with QR access and access counts
- Frozen clinician packets that cannot open or modify the patient account
- Row-level database policies that restrict each record and share record to its authenticated owner
- Adaptive pre-visit interview and source-linked clinician brief
- Download, print, and responsive desktop/mobile interfaces

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

## Supabase account persistence and sharing

Vital Passport works without Supabase. In local mode, the complete structured patient record is retained in browser storage and the synthetic Maria sharing route remains available. Supabase adds passwordless email sign-in, cross-device persistence, and real revocable clinic links.

### 1. Create a Supabase project

Create a project and open its SQL Editor.

### 2. Create the protected record and sharing tables

Run the contents of:

```text
supabase/schema.sql
```

This creates:

- `public.patient_records`, containing one versioned record per authenticated user
- `public.shared_briefs`, containing frozen clinician packets and only a SHA-256 hash of each share secret
- Row Level Security policies that let authenticated users manage only their own rows
- `get_shared_brief(text)`, a narrowly scoped public function that returns a packet only when the supplied secret is valid, unexpired, and not revoked

The public resolver increments the packet access count and updates its last-accessed time. It does not return the owner ID, account record, email address, or any other account data.

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

These values are intentionally browser-visible. Access control is enforced by authenticated JWTs, Row Level Security, and the share-token resolver. Never place a Supabase service-role key in a `VITE_` variable.

Redeploy after adding the variables.

### 5. Sign in from Vital Passport

Open the cloud-status control in the sidebar, enter an email address, and use the magic link. On first sign-in:

- An existing local record is uploaded when no cloud copy exists.
- An existing cloud record is restored when one is present.
- Future changes are saved automatically after a short debounce.
- The account panel provides manual save and cloud-reload controls.

### 6. Create a clinic link

Open the clinician brief and choose **Share clinic link** or **Visit QR code**.

A real share link:

- Uses a cryptographically random 256-bit secret
- Stores only the SHA-256 hash of that secret in Supabase
- Freezes the current clinician packet at creation time
- Expires after 24 hours, 72 hours, or seven days
- Can be revoked immediately by the patient
- Tracks access count and last-opened time
- Exposes only the frozen packet, never the patient account

The raw link secret is kept only on the browser that created it. Other signed-in devices can see and revoke the share record, but cannot reconstruct the original URL. They can create a replacement link when needed.

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

A shared clinician packet is separate from that live record. It includes only the selected patient demographics, visit reason, priorities, medications, labs, reconciliation status, timeline, tasks, and source summaries needed for the handoff.

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

Run the complete local gate with:

```bash
npm run validate
npm run test:coverage
```

`npm run validate` performs TypeScript validation, unit tests, a production Vite build, and server-function syntax checking.

### Automated quality gates

Every pull request and push to `main` runs:

1. TypeScript validation
2. Deterministic unit tests for patient-profile normalization and date handling
3. V8 coverage reporting with a retained CI artifact
4. Production Vite build verification
5. Server-function syntax validation
6. CodeQL security analysis

These checks validate software contracts. They do not establish privacy compliance, clinical validity, diagnostic accuracy, or readiness for identifiable patient information.

## Next technical milestones

1. Multi-page PDF ingestion and document splitting
2. FHIR-compatible patient-summary export
3. Caregiver and dependent profiles
4. Source-file object storage with signed URLs
5. Security, privacy, regulatory, and clinical-safety hardening

## Contributing

Focused contributions are welcome. Read [`CONTRIBUTING.md`](CONTRIBUTING.md) before opening a pull request.

## Safety

Vital Passport organizes patient-provided information. It does not diagnose conditions, recommend medication changes, or replace professional medical care.
