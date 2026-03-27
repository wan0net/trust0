# trust0

<p align="center">
  <strong>Cryptographic identity verification</strong><br>
  Prove that person X owns account X. Open source. Open data.
</p>

<p align="center">
  <a href="#why-trust0">Why</a> •
  <a href="#how-it-works">How It Works</a> •
  <a href="#proof-providers">Providers</a> •
  <a href="#document-signing">Signing</a> •
  <a href="#getting-started">Get Started</a> •
  <a href="#deploy-your-own">Deploy</a> •
  <a href="#license">License</a>
</p>

---

> **Early Development** — Core crypto library complete (88 tests), 20+ proof providers, sigchain with key rotation, document signing with Rekor timestamps, BIP39 paper key backup. Web app and deployment in progress.

## Why trust0

Keybase let you cryptographically prove you owned your accounts — then got acquired by Zoom and died. Everyone's identity was on their servers. No export, no migration, no alternatives.

trust0 fixes the same problem without the single point of failure:

- **Your identity is a set of signed files.** They work anywhere — not just on our server.
- **Verification is client-side.** The viewer's browser does all the crypto. The server stores bytes.
- **Your data is portable.** Export everything. Self-host. If trust0.app disappears, your identity survives.
- **The code is open source.** Fork it. Deploy your own. Audit every line.

**What trust0 adds over Keyoxide** (the other active project in this space):

| Capability | Keyoxide | trust0 |
|------------|----------|--------|
| Identity history (sigchain) | No | Yes — append-only signed log |
| Key rotation | No — new key = new identity | Yes — identity survives key changes |
| Revocation | No | Yes — explicit revoke links |
| Document signing | No | Yes — JWS detached + Rekor timestamps |
| Crypto wallet proofs | No | Yes — Ethereum, Bitcoin, Solana, Nostr |
| Data export | N/A (no server data) | Yes — full identity as portable files |

Compatible with [Keyoxide](https://keyoxide.org) and the [Ariadne specification](https://ariadne.id). Keyoxide users can verify trust0 profiles and vice versa.

## How It Works

```
┌───────────────────────────────────────────────────────┐
│                   YOUR BROWSER                         │
│                                                        │
│  1. Generate Ed25519 keypair (WebCrypto)               │
│  2. Sign an identity profile (ASP format)              │
│  3. Post fingerprint on GitHub / DNS / Mastodon / etc  │
│  4. Upload signed profile to trust0.app                │
│                                                        │
│  Private key never leaves your browser.                │
└───────────────────────────────────────────────────────┘
                         │
                         ▼
┌───────────────────────────────────────────────────────┐
│                 ANYONE CAN VERIFY                      │
│                                                        │
│  1. Fetch your profile from trust0.app                 │
│  2. Verify the Ed25519 signature                       │
│  3. For each claim: fetch proof from platform           │
│  4. Check fingerprint matches                          │
│                                                        │
│  All verification in the viewer's browser.             │
│  Server cannot forge results.                          │
└───────────────────────────────────────────────────────┘
```

Every identity action is recorded in a **sigchain** — an append-only, hash-linked log of signed events. The sigchain enables key rotation (change your key without losing your identity), proof revocation (explicitly mark a proof as removed), and full audit history.

## Proof Providers

**Client-verified** (viewer's browser checks directly):

GitHub · GitLab · Sourcehut · Codeberg · Mastodon · Bluesky · Twitter/X · Reddit · Hacker News · Lobsters · ORCID · Keybase · DNS · Personal website

**Server-attested** (bot-witnessed):

Email (challenge-response) · Discord · Telegram

**Key-to-key** (cryptographic cross-signing):

Ethereum · Bitcoin · Solana · Nostr

Verification engine: [@trust0/verify](packages/verify) — forked from [doipjs](https://codeberg.org/keyoxide/doipjs) (31 service providers, Apache-2.0).

## Document Signing

Sign files with your verified identity key:

- **JWS detached payload** (RFC 7515 / RFC 7797) — signature separate from document
- **Rekor timestamps** — submit to [Sigstore](https://rekor.sigstore.dev) transparency log for proof-of-existence
- **Multi-party signatures** — multiple signers over the same document
- **SSH key export** — same Ed25519 key works for `git commit -S`
- **Sigchain audit trail** — every signature recorded in identity history

## Architecture

```
trust0/
├── packages/
│   ├── identity/         # @trust0/identity — Ed25519 keys, ASP profiles,
│   │                     # sigchain, document signing, SSH, BIP39 mnemonic
│   │                     # 88 tests. Apache-2.0.
│   └── verify/           # @trust0/verify — proof verification engine
│                         # 31 providers. Forked from doipjs. Apache-2.0.
├── apps/
│   ├── api/              # Hono Worker + D1 — ASPE, sigchain, attestations,
│   │                     # export/import, Better Auth (GitHub OAuth)
│   ├── web/              # SvelteKit — dashboard, 20 proof pages, profile viewer
│   └── proxy/            # CORS proxy Worker for browser verification
├── bots/
│   ├── discord/          # Discord attestation bot (Worker)
│   └── telegram/         # Telegram attestation bot (Worker)
├── dev/                  # Developer docs, specs, proposals
│   └── spec/             # Ariadne specs + sigchain spec + APC proposals
└── docs/                 # GitHub Pages site (wan0.net/trust0/)
```

## Getting Started

```bash
git clone https://github.com/wan0net/trust0.git
cd trust0
pnpm install

# Run tests (88 tests)
pnpm --filter @trust0/identity test

# Dev servers
pnpm --filter @trust0/api dev          # API on :8788
pnpm --filter @trust0/web dev          # Web on :5173
pnpm --filter @trust0/proxy dev        # Proxy on :8790
```

## Deploy Your Own

trust0 runs on Cloudflare's free tier. Total cost: ~$15/year (domain only).

```bash
# 1. Create D1 database
wrangler d1 create trust0-db

# 2. Update apps/api/wrangler.toml with your database_id

# 3. Run migration
cd apps/api && wrangler d1 migrations apply trust0-db --remote

# 4. Set secrets
wrangler secret put AUTH_SECRET
wrangler secret put GITHUB_CLIENT_ID
wrangler secret put GITHUB_CLIENT_SECRET

# 5. Deploy
pnpm --filter @trust0/api deploy
pnpm --filter @trust0/proxy deploy
pnpm --filter @trust0/web deploy
```

## Resilience

**If trust0.app disappears, your identity survives.**

Every piece of data in the database is a self-verifying signed file (JWS). Export your identity, host it anywhere. The proofs on platforms (GitHub gists, DNS records) still contain your fingerprint. Anyone can fork the code and deploy a new instance.

| Scenario | Impact |
|----------|--------|
| Server goes down | Users with export: redeploy anywhere. Proofs on platforms still valid. |
| User loses device | Restore from encrypted backup, BIP39 paper key, or git clone. |
| Domain changes | Sigchain `profile_update` link migrates ASPE URI to new domain. |
| Operator disappears | Fork repo → deploy to Cloudflare → restore from D1 backup. |

## Spec Compliance

Built on the [Ariadne Identity Specification](https://ariadne.id):

- [Ariadne Core v0](dev/spec/ariadne-core-v0.md) — bidirectional proof protocol
- [ASP / ASPE v0](dev/spec/ariadne-asp-v0.md) — Ed25519 signed profiles + exchange protocol
- [Sigchain](dev/spec/sigchain.md) — trust0 extension (append-only identity history)
- [Proposed Changes](dev/spec/proposed-changes.md) — 10 proposals (APC-001 to APC-010)

All spec deviations are marked in code with `SPEC DEVIATION (APC-NNN)` comments.

## CI/CD

- **Tests** — 88 unit tests + Ariadne interop tests
- **Keyoxide interop** — live tests against [aspe-server-rs](https://codeberg.org/keyoxide/aspe-server-rs) in Docker
- **Semgrep** — SAST (JS/TS + OWASP + security-audit), SARIF → GitHub Security tab
- **Trivy** — vuln/secret/misconfig scanning, SARIF → GitHub Security tab

## Project Stats

| Metric | Value |
|--------|-------|
| Source files | ~130 |
| Lines of code | ~20,000 |
| Tests | 88 |
| Proof providers | 20 (UI) + 31 (verify engine) |
| Sigchain link types | 9 |
| CI jobs | 4 (test, interop, semgrep, trivy) |

## Contributing

trust0 is open source and welcomes contributions. See [CLAUDE.md](CLAUDE.md) for architecture, code style, and boundaries.

## Roadmap

See [dev/persona-review.md](dev/persona-review.md) for the persona-driven feature plan.

**Next:**
- Onboarding wizard for non-technical users
- Public profile redesign (link-in-bio style)
- CLI tool (`trust0 init`, `trust0 prove`, `trust0 sign`)
- OpenGraph/Twitter Card meta tags

**Future:**
- AT Protocol integration
- Merkle tree for sigchain consistency
- Matrix bot

## License

- **App** (apps/, bots/) — [AGPL-3.0](LICENSE)
- **Libraries** (packages/identity, packages/verify) — [Apache-2.0](packages/verify/LICENSE)

---

<p align="center">
  <a href="https://wan0.net/trust0/">Website</a> •
  <a href="https://ariadne.id">Ariadne Spec</a> •
  <a href="https://keyoxide.org">Keyoxide</a>
</p>
