# Vital Passport

**Your health story, ready when it matters.**

Vital Passport is a patient-controlled health intelligence product that turns scattered documents, medication photos, symptoms, labs, and questions into a coherent, source-linked clinician brief.

## Hackathon MVP

- Patient dashboard and upcoming-visit readiness score
- Real image and text extraction through Nebius Token Factory
- Meta Llama multimodal analysis with strict structured output
- Evidence snippets, confidence scores, warnings, and patient confirmation
- Safe synthetic fallback when the API key has not been configured
- Source-aware health timeline
- Adaptive pre-visit interview
- Medication discrepancy detection and patient verification
- Clinician brief with source drill-down
- Temporary share-link and QR-code demonstration
- Download and print actions
- Responsive desktop and mobile interface

The included demo patient and records are entirely synthetic. Do not use identifiable patient information until privacy, security, retention, and regulatory requirements have been reviewed and implemented.

## Nebius setup on Vercel

Add the following environment variable to the Vercel project:

```text
NEBIUS_API_KEY=your_token_factory_key
```

The default model is:

```text
meta-llama/Llama-4-Scout-17B-16E-Instruct
```

If the model identifier shown in your Nebius catalog differs, add:

```text
NEBIUS_MODEL=the_exact_model_identifier
```

Redeploy after changing environment variables. The key is read only by the Vercel function in `api/extract.js` and is never exposed to the browser.

## Extraction flow

1. The browser resizes a JPG, PNG, or WebP image before upload.
2. The same-origin `/api/extract` Vercel function validates the request.
3. The function calls Nebius using its OpenAI-compatible chat-completions endpoint.
4. The model returns structured health information using a JSON schema, with a JSON-object fallback for model compatibility.
5. The server normalizes the response before returning it to the browser.
6. The patient reviews evidence, confidence, warnings, and required confirmations before adding the item.

PDFs are not parsed in this first pipeline. Photograph the relevant page or paste its text.

## Run locally

```bash
npm install
npm run dev
```

Open `http://localhost:5173`.

## Validate a production build

```bash
npm run check
npm run build
npm run preview
node --check api/extract.js
```

## Current architecture

The frontend is React + TypeScript + Vite. The extraction endpoint is a Vercel serverless function that calls Nebius Token Factory directly with `fetch`; no provider SDK or browser-exposed secret is required. Demo state currently persists in the browser.

## Next technical milestones

1. Insert confirmed extracted objects into a dynamic timeline and reconciliation graph.
2. Add encrypted authentication and user-controlled storage.
3. Add multi-page PDF ingestion and document splitting.
4. Export a FHIR-compatible patient summary.
5. Add auditable, expiring clinic sharing.
6. Complete privacy, security, regulatory, and clinical-safety review before handling real health information.

## Safety

Vital Passport organizes patient-provided information. It does not diagnose conditions, recommend medication changes, or replace professional medical care.
