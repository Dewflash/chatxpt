## Role 1

- Added a thin `/quest-board/[roomCode]` route shell over the accepted hosted-board access service.
- Rendered granted, not-found, inactive, expired, invalid-code, unavailable, direct viewer path, and QR payload states without exposing private viewer recovery data.
- Preserved the evidence boundary: this is local route/shell coverage only, not real multi-client hosted-board evidence.
