# OpenEMR 8.1 document compatibility

The demo OpenEMR 8.1.1 instance accepts native document uploads but returns 404 for the document-list GET endpoint. Vital Passport therefore uploads only to the confirmed existing `/Medical_Record` category and verifies the resulting categorized document through FHIR `DocumentReference`.
