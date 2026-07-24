# Contributing to Vital Passport

Vital Passport favors small, reviewable changes that preserve patient control, source provenance, explicit confirmation, and clear clinical-safety boundaries.

## Local validation

Requires Node.js 22 or later.

```bash
npm install
npm run validate
npm run test:coverage
```

## Contribution expectations

- Add or update tests for every deterministic behavior change.
- Keep synthetic fixtures clearly labeled and free of identifiable patient information.
- Preserve source links, uncertainty, and patient confirmation when health information is normalized or reconciled.
- Never commit service-role keys, private health information, production tokens, or live clinic links.
- Explain changes to authentication, sharing, storage, extraction, and access-control boundaries.
- Do not present extracted or summarized information as diagnosis, treatment advice, or autonomous clinical judgment.

## Pull request checklist

- [ ] The change is focused and documented.
- [ ] `npm run validate` passes.
- [ ] Coverage includes important success and failure paths.
- [ ] Fixtures are synthetic and contain no identifying information.
- [ ] Privacy, source-provenance, and clinical-safety implications are described.
