## Summary

- Added a bounded Content Security Policy to the global Next.js deployment headers.
- Preserved OBS Virtual Camera setup permission, Twitch Extension helper/script origin, Twitch frame ancestors, Supabase realtime/HTTPS, Twitch API, and Twitch PubSub access.
- Documented that the CSP is configuration readiness and still needs deployed preview plus Twitch Local/Hosted Test evidence before live claims.

## Verification

- `npm run test -- tests/integration/deployment-config.test.ts`
- `npm run check`
