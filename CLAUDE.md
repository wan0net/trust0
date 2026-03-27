# trust0

## What This Is

Keybase replacement. Cryptographic identity verification — prove you own your accounts
(GitHub, DNS, Mastodon, Twitter, wallets, etc.) using Ed25519 signatures and an
append-only sigchain. All verification happens in the viewer's browser. No server trust.

**Brand:** trust0 (trust-zero). "Trust no one. Verify everything."

## Core Principle

**If trust0.app disappears tomorrow, nobody loses their identity.**

Profiles are self-verifying signed files. They work anywhere. The web app is a tool
for creating and viewing them — not a dependency.

## Architecture

- **Static SvelteKit site** on Cloudflare Pages — no backend, no Workers for the main app
- **@trust0/identity** package — pure TypeScript crypto library (jose, doipjs, rfc4648, @scure/bip39)
- **CORS proxy** — single Cloudflare Worker, only compute needed (for doipjs browser verification)
- **Storage is pluggable** — user chooses: GitHub Pages, own domain, or trust0.app hosted
- **Git repo as identity server** — .well-known/aspe/ files committed via GitHub API from browser
- **doipjs** for client-side verification — 30+ providers, battle-tested

## Project Structure

```
trust0/
├── apps/
│   ├── web/              # SvelteKit static site (trust0.app)
│   └── proxy/            # CORS proxy Worker (only compute)
├── packages/
│   └── identity/         # Core crypto library (@trust0/identity)
├── bots/
│   ├── discord/          # Discord attestation bot (Worker)
│   └── telegram/         # Telegram attestation bot (Worker)
├── PLAN.md               # → ../PLAN.md (full architecture doc)
└── CLAUDE.md             # This file
```

## Commands

```bash
pnpm install
pnpm test                          # Run all tests
pnpm --filter @trust0/identity test  # Identity package tests only
```

## Extraction Status

Extracting from link42/login2 (feat/keybase branch). The identity package and proxy
are copied. The web app needs rebuilding as a static site with GitHub storage backend
instead of Hono API + D1.

### Done
- @trust0/identity package (keys, profiles, sigchain, signing, SSH, mnemonic)
- CORS proxy worker
- 71 tests passing

### Remaining
- [ ] Static SvelteKit web app with GitHub OAuth
- [ ] GitHub API storage backend (commit profile + chain files to user's repo)
- [ ] Strip Better Auth — crypto key IS the identity
- [ ] Configurable ASPE domain
- [ ] Copy and adapt Discord/Telegram bots
- [ ] Username directory (static JSON index)
- [ ] trust0.app hosted profiles for users without own hosting

## Code Style

- TypeScript strict
- Tabs for indentation (matches link42 convention in login2)
- Double quotes
- `jose` for all JWS/JWK operations
- `doipjs` for all proof verification — do NOT hand-roll platform-specific fetching
- CSS custom properties for theming (no Tailwind, no UI framework)
- Section markers: `// ── Section Name ──────────`

## Boundaries

### Always
- Run tests before marking work done
- All verification must be client-side (browser, not server)
- Profiles must be portable — never depend on a specific server being available
- Use doipjs for verification, jose for signing — don't reinvent

### Never
- Add a server dependency for core identity operations
- Store private keys as exportable JSON (use IndexedDB CryptoKey objects)
- Make trust0.app a required component — it must be optional
- Hardcode the ASPE domain — it must be configurable per deployment
