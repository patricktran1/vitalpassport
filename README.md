# Vital Passport

**Your health story, ready when it matters.**

Vital Passport is a patient-controlled health intelligence prototype that turns scattered documents, medication photos, symptoms, labs, and questions into a coherent, source-linked clinician brief.

## Hackathon MVP

- Patient dashboard and upcoming-visit readiness score
- Multimodal capture flow with simulated extraction
- Source-aware health timeline
- Adaptive pre-visit interview
- Medication discrepancy detection and patient verification
- Clinician brief with source drill-down
- Temporary share-link and QR-code demonstration
- Download and print actions
- Responsive desktop and mobile interface

The included patient and records are entirely synthetic.

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
```

## Current architecture

This MVP is a React + TypeScript + Vite application with local synthetic data and deterministic demo interactions. It intentionally does not transmit or persist real health information.

## Next technical milestones

1. Add encrypted authentication and user-controlled storage.
2. Add server-side document and image extraction with a healthcare-appropriate model and explicit retention controls.
3. Introduce provenance-aware structured health objects and reconciliation workflows.
4. Export a FHIR-compatible patient summary.
5. Add auditable, expiring clinic sharing.
6. Complete privacy, security, regulatory, and clinical-safety review before handling real health information.

## Safety

Vital Passport organizes patient-provided information. It does not diagnose conditions, recommend medication changes, or replace professional medical care.
