## Role 1

- Added a minimal Vercel project configuration that pins the preview build to `npm ci` and `npm run build` without committing environment values.
- Documented the preview/production environment split, public versus server-only variables, `/api/health` checks, security-header verification, and required evidence recording before claiming deployed proof.
- Added integration tests that keep the Vercel config secret-free and aligned with the environment template.
