# Changelog

Append-only log of features built during autonomous development loops.

---

## Iteration 1 — 2026-03-26

### Review
All 5 personas reviewed the project. Document signing (B-001) was the highest-priority unblocked item — Priya's primary need, also requested by Maya and Fatima. 3/5 personas need it.

### Build Target
**B-001: Document signing (JWS detached, .sig.json bundles)**

### Result
- **Status:** DONE (unmerged)
- **Branch:** `feat/document-signing`
- **Commit:** `6e8cdef`
- **Tests:** 30/30 pass (7 new signing tests)
- **Files created:** `signing.ts`, `signing.test.ts`, `sign/+page.svelte`
- **Files modified:** `index.ts` (exports), `+page.svelte` (sign link)
- **CI:** No GitHub Actions configured for feature branches (Q-001)
## Iteration 1 — B-001: Document Signing (2026-03-26)
- **Branch:** `feat/document-signing`
- **Tests:** 30/30 (7 new signing tests)
- **Files:** `signing.ts`, `signing.test.ts`, `sign/+page.svelte`

## Iteration 2 — B-002: QR Code Generation (2026-03-26)
- **Branch:** `feat/qr-code`
- **Tests:** 23/23 (no new — frontend-only feature using qrcode-svg)
- **Files:** `+page.svelte` (dashboard), `profile/[id]/+page.svelte` (public)
