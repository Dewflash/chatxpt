# Establish the verified evidence manifest

- **Type:** Added
- **Role:** Role 1
- **Issue/PR:** PR pending; R1-017
- **Summary:** Added a versioned evidence manifest and real-test resource matrix so every role records what actually ran, which input and surface were used, the immutable source revision, reviewer, artifact, and limitations.
- **Integration impact:** Pull requests now identify evidence manifest entries or explain why none applies; repository checks reject evidence-class mismatches, missing execution details, unsafe artifact references, private links, credential-shaped fields, and incorrect role owners.
- **Verification:** `npm run check:evidence`, `npm run test:evidence`, `npm run check`, and `git diff --check`.
- **Reality status:** This is real repository validation and coordination infrastructure. It records no judged live Twitch/OBS/cloud evidence yet and does not make any product-runtime claim.
