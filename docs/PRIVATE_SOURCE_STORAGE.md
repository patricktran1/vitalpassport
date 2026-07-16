# Private source storage architecture

Vital Passport separates the structured patient bundle from the original evidence used to create it.

## Storage layout

Original PDF and image files are stored in the private Supabase Storage bucket:

```text
patient-sources/{user_id}/{source_document_id}/{safe_filename}
```

The bucket is not public. Storage Row Level Security policies require the first path segment to match the authenticated user ID for insert, select, update, and delete operations.

## Metadata

`public.source_documents` stores:

- authenticated owner ID
- original filename and MIME type
- byte size
- SHA-256 checksum
- source type
- linked upload and source-record IDs
- extraction title, summary, facility, and event date
- extraction status and model
- complete structured extraction JSON
- selected PDF pages and total page count
- timestamps

Manual text sources use the same metadata table but do not create a Storage object.

## Access

The application creates short-lived signed URLs only when an authenticated owner asks to open an original file. Signed URLs expire after five minutes by default.

## Deletion

Deleting an individual source removes its Storage object and metadata row. It does not silently remove already confirmed clinical facts, because those may have been reviewed and reconciled separately.

Deleting the entire cloud record removes:

- all private source Storage objects
- all source-document metadata
- all clinician share rows
- the patient bundle

The Supabase Auth identity remains available so the user can sign in again and create a blank Passport.

## Current boundary

This architecture provides account isolation and traceability for the prototype. Production use still requires retention rules, malware scanning, audit logs, key and access governance, backup and deletion validation, incident response, and the appropriate contractual and regulatory controls.
