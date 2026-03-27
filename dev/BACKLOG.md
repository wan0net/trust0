# Backlog

Append-only. Items are never removed, only marked with status.

## Iteration 1 — Persona Review (2026-03-26)

### Implemented (baseline)
- Ed25519 key generation + localStorage + encrypted backup
- ASP profiles (create, sign, parse) + ASPE server
- Sigchain (create, parse, verify, hash, identity ID) + 23 tests
- Vanity usernames
- 10 proof flows: GitHub, GitLab, DNS, Mastodon, HN, Website, Discord, Telegram + Email + Profile edit/revoke
- doipjs integration (29 service providers)
- CORS proxy worker
- General attestation system + Discord/Telegram bots
- Public profile viewer with chain history + attestation display
- Profile editing + proof revocation

### New Items

| # | Feature | Priority | Requested By | Status |
|---|---------|----------|-------------|--------|
| B-001 | Document signing (JWS detached, .sig.json bundles) | P0 — Critical | Maya, Priya (PRIMARY), Fatima | DONE (unmerged, feat/document-signing) |
| B-002 | QR code generation for profile sharing | P1 — High | Jamal, Alex (PRIMARY) | READY |
| # | Feature | Priority | Requested By | Status |
|---|---------|----------|-------------|--------|
| B-001 | Document signing (JWS detached, .sig.json bundles) | P0 — Critical | Maya, Priya (PRIMARY), Fatima | DONE (unmerged, feat/document-signing) |
| B-002 | QR code generation for profile sharing | P1 — High | Jamal, Alex (PRIMARY) | DONE (unmerged, feat/qr-code) |
| B-003 | Key rotation (key_rotate sigchain link, new key delegation) | P1 — High | Maya (CRITICAL), Fatima (CRITICAL) | READY |
| B-004 | OpenGraph meta tags on public profile pages | P2 — Medium | Alex | READY |
| B-005 | Profile avatar + theme color (ASP spec fields) | P2 — Medium | Alex | READY |
| B-006 | Profile export as JSON | P3 — Low | Jamal | READY |
| B-007 | Rekor timestamp integration for document signing | P1 — High | Priya | BLOCKED (needs B-001) |
| B-008 | Multi-party document signing | P2 — Medium | Priya | BLOCKED (needs B-001) |
| B-007 | Rekor timestamp integration for document signing | P1 — High | Priya | BLOCKED (needs B-001 merged) |
| B-008 | Multi-party document signing | P2 — Medium | Priya | BLOCKED (needs B-001 merged) |
| B-009 | Git commit signing bridge (SSH format export) | P2 — Medium | Maya, Priya | READY |
| B-010 | ORCID proof provider | P3 — Low | Fatima | READY |
