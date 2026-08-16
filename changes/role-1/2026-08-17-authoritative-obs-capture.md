---
role: role-1
type: feature
summary: Mount secure authoritative OBS output and Gameplay Capture input
---

- Added a server-issued, session-and-broadcaster-bound OBS overlay read grant and canonical `/obs-overlay` route.
- Kept the overlay token in the URL fragment and sent it only as an authorization header for no-store state reads.
- Added Studio setup fields that distinguish Gameplay Capture input from OBS Browser Source broadcast output.
- Connected OBS Virtual Camera analysis to authenticated normalized gameplay ingress without uploading or persisting raw frames.
- Preserved the legacy `/overlay` route as diagnostic output rather than silently treating it as canonical proof.
