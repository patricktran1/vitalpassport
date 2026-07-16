# Google and private-source test plan

## Google sign-in

- Signed-out account panel shows Google and email options.
- Google returns to `https://vitalpassport.com`.
- Existing magic-link users keep the same account when the email matches.
- Signing in while Maria demo is open does not upload Maria.

## Private source upload

- Signed-in personal user confirms a JPG, PNG, WebP, or PDF.
- The original file appears in the private source library.
- Metadata includes checksum, model, selected pages, and linked source IDs.
- Another authenticated account cannot list or open the object.
- Demo mode and signed-out local mode do not claim a cloud source was saved.

## Signed access

- Open original creates a temporary URL.
- The URL expires.
- No public bucket URL is exposed.

## Deletion

- Individual delete removes the Storage object and metadata row.
- Full cloud-record delete removes private sources, clinician shares, and patient bundle.
- The authentication identity remains able to sign in to a blank Passport.
