# Open Questions

Append-only log of questions encountered during autonomous development loops.

---

### Q-001 (Iteration 1, 2026-03-26)
**No GitHub Actions CI configured for feature branches.** `gh run list --branch feat/document-signing` returned nothing. The repo may have CI only on main/PR events. Build integrity check skipped — local tests pass (30/30).

### Q-002 (Iteration 1, 2026-03-26)
**jose v6 `Uint8Array` type incompatibility with `crypto.subtle.digest`.** TypeScript strict mode flags `Uint8Array` as incompatible with `BufferSource` due to `SharedArrayBuffer` union. Workaround: cast via `unknown`. Not a runtime issue — only a TS strictness artifact.
**No GitHub Actions CI configured for feature branches.** `gh run list --branch feat/document-signing` returned nothing. Build integrity check relies on local tests only.

### Q-002 (Iteration 1, 2026-03-26)
**jose v6 `Uint8Array` type incompatibility with `crypto.subtle.digest`.** Workaround: cast via `unknown`. Not a runtime issue.

### Q-003 (Iteration 2, 2026-03-26)
**qrcode-svg has no TypeScript declarations.** Used `// @ts-ignore` on dynamic import. Could add a `.d.ts` shim later.
