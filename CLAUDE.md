# trust0

## What This Is

Keybase replacement. Open source cryptographic identity verification — prove you own
your accounts (GitHub, DNS, Mastodon, Twitter, wallets, etc.) using Ed25519 signatures
and an append-only sigchain. All verification happens in the viewer's browser.

**Brand:** trust0 (trust-zero). "Trust no one. Verify everything."

**License:** AGPL-3.0 (app), Apache-2.0 (libraries + bots), CC-BY-SA (spec extensions)

## Core Principle

**If trust0.app disappears tomorrow, nobody loses their identity.**

The server stores signed files and serves them. The data is portable. The code is
open source. Anyone can fork, deploy, and restore from backup in 10 minutes.

## Architecture

- **Hono API Worker** + D1 database — stores profiles, chains, attestations
- **SvelteKit frontend** on Cloudflare Pages — dashboard + public profile viewer
- **@trust0/identity** — pure TypeScript crypto library (Apache-2.0)
- **@trust0/verify** — forked from doipjs, audited verification engine (Apache-2.0)
- **CORS proxy Worker** — for doipjs browser verification
- **Discord + Telegram bots** — server-attested proofs (Apache-2.0)
- **Better Auth** — GitHub OAuth for dashboard login (minimal, no orgs/billing)
- **All data is signed JWS** — self-verifying, portable, works without the server

## Relationship to Ariadne / Keyoxide / doipjs

We adopt the Ariadne spec and fork doipjs. Neither has been security audited.
trust0 is the actively maintained, production-grade implementation.

- **Ariadne spec** — adopted (ASP profiles, ASPE protocol)
- **doipjs** — forked as @trust0/verify (audit critical paths before launch)
- **Keyoxide** — compatible (can verify each other's profiles)
- **Sigchain, key rotation, doc signing** — our extensions (Keyoxide doesn't have these)

## Project Structure

```
trust0/
├── apps/
│   ├── api/              # Hono API Worker (ASPE, sigchain, attestations, export/import)
│   ├── web/              # SvelteKit frontend (trust0.app)
│   └── proxy/            # CORS proxy Worker (for doipjs)
├── packages/
│   ├── identity/         # Core crypto library (@trust0/identity)
│   └── verify/           # doipjs fork (@trust0/verify) — TODO
├── bots/
│   ├── discord/          # Discord attestation bot
│   └── telegram/         # Telegram attestation bot
├── CLAUDE.md             # This file
└── PLAN.md → ../PLAN.md  # Full architecture doc
```

## Commands

```bash
pnpm install
pnpm test                              # Run all tests
pnpm --filter @trust0/identity test    # Identity package tests only
pnpm --filter @trust0/api dev          # API dev server
pnpm --filter @trust0/web dev          # Web dev server
pnpm --filter @trust0/proxy dev        # Proxy dev server
```

## Extraction Status

Extracted from link42/login2 (feat/keybase branch, 38 commits, 71 tests).

### Done
- @trust0/identity (keys, profiles, sigchain, signing, SSH, mnemonic) — 71 tests
- API Worker (ASPE, sigchain, attestations, export/import)
- CORS proxy Worker
- Discord + Telegram bots
- D1 schema (7 tables, clean migration)
- Configurable ASPE_DOMAIN

### In Progress
- SvelteKit web app (extracting proof pages + dashboard from link42)

### Remaining
- [ ] Fork doipjs → @trust0/verify (audit critical paths)
- [ ] Deploy guide in README
- [ ] Profile export UI (download zip)
- [ ] Onboarding flow for non-technical users

## Code Style

- TypeScript strict
- Tabs for indentation
- Double quotes
- `jose` for all JWS/JWK operations
- `@trust0/verify` (doipjs fork) for all proof verification
- CSS custom properties for theming (no Tailwind, no UI framework)
- Section markers: `// ── Section Name ──────────`

## Boundaries

### Always
- Run tests before marking work done
- All verification must be client-side (browser, not server)
- Profiles must be portable — never depend on a specific server
- Use @trust0/verify for verification, jose for signing — don't reinvent
- Every D1 row must be a self-verifying JWS — portable by design

### Never
- Add a server dependency for core identity operations
- Store private keys as exportable JSON (use IndexedDB CryptoKey objects)
- Make trust0.app a required component — it must be optional/replaceable
- Hardcode the ASPE domain — configurable via ASPE_DOMAIN env var
- Close-source any component
