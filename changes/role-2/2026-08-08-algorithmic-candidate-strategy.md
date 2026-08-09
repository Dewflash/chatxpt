# Role 2 algorithmic candidate strategy

- Added `createAlgorithmicCandidateStrategy`, a credential-free Role 2 candidate generation strategy.
- The strategy deterministically emits exactly three canonical algorithmic candidates, avoids recent titles when alternatives exist, and cites only fresh, high-confidence known canonical signal IDs that remain compatible with Role 3 validation.
- Added tests for canonical exactly-three output, recent-title avoidance, signal citation/privacy, and deterministic replay.

This does not select or call an AI provider. Role 3 still validates every generated candidate before it can reach voting or overlay surfaces.
