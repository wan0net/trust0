# Architecture

## System Components

```
┌─────────────────────────────────────────────────────────────────┐
│                     trust0.app                                  │
│                                                                 │
│  API Worker (Hono + D1)              SvelteKit Frontend         │
│  ├── ASPE endpoints                  ├── Landing page           │
│  ├── Sigchain endpoints              ├── Identity dashboard     │
│  ├── Attestation endpoints           ├── 20 proof pages         │
│  ├── Export/import                   ├── Profile viewer         │
│  └── Better Auth (GitHub OAuth)      ├── Document signing       │
│                                      └── Key management         │
│                                                                 │
│  CORS Proxy Worker                   Bots                       │
│  └── HTTP, DNS, ActivityPub,         ├── Discord (Worker)       │
│      GraphQL, ASPE proxying          └── Telegram (Worker)      │
│                                                                 │
│  Cloudflare D1 (SQLite)                                         │
│  ├── user, session, account (Better Auth)                       │
│  ├── crypto_profile (fingerprint → profile JWS)                 │
│  ├── sigchain_link (identity_id, seqno → link JWS)              │
│  ├── username (username → fingerprint)                          │
│  └── attestation (fingerprint → platform attestation)           │
└─────────────────────────────────────────────────────────────────┘
```

## Packages

### @trust0/identity (Apache-2.0)

Pure TypeScript crypto library. No I/O, no network. Works in browser and Node.js.

| Module | Purpose |
|--------|---------|
| `keys.ts` | Ed25519 keygen via WebCrypto, fingerprint computation |
| `profile.ts` | ASP profile creation, parsing, request signing |
| `chain.ts` | Sigchain link creation, parsing, hash computation, chain verification |
| `signing.ts` | Document signing (JWS detached), Rekor timestamping, multi-party |
| `ssh.ts` | JWK → SSH public key conversion |
| `mnemonic.ts` | BIP39 24-word paper key backup |

Dependencies: `jose` v6, `rfc4648`, `@scure/bip39`

### @trust0/verify (Apache-2.0)

Forked from [doipjs](https://codeberg.org/keyoxide/doipjs) v2.1.0. Proof verification engine with 31 service providers.

Used client-side in the browser to verify claims. The CORS proxy handles cross-origin requests.

## Verification Flow

```
Viewer's Browser
  │
  ├── Fetch profile from trust0.app/.well-known/aspe/id/{fp}
  │   └── Verify JWS signature (jose library)
  │
  ├── Fetch sigchain from trust0.app/api/identity/chain/{fp}
  │   └── Replay chain, verify all signatures and hashes
  │
  ├── For each claim:
  │   ├── GitHub: fetch gist via GitHub API
  │   ├── DNS: query via CORS proxy → DNS-over-HTTPS
  │   ├── Mastodon: fetch profile via CORS proxy → ActivityPub
  │   ├── Email: check server attestation endpoint
  │   └── ... (31 providers via @trust0/verify)
  │
  └── Render results: VERIFIED / FAILED / UNSUPPORTED
```

The server cannot forge verification results. The viewer computed everything.

## Data Portability

Every row in D1 is a signed JWS blob. The server adds convenience (indexing, auth, nice URLs) but the data doesn't depend on the server.

**Export**: `GET /api/identity/export` returns complete identity as JSON (profile + chain + attestations)

**Import**: `POST /api/identity/import` registers an exported identity on any trust0 instance

**Self-host**: Export files can be served as static files on GitHub Pages, any domain, or any ASPE-compatible server

## Compatibility

trust0 implements the Ariadne specification:
- [Ariadne Core v0](spec/ariadne-core-v0.md) — bidirectional proof protocol
- [Ariadne Signature Profile v0](spec/ariadne-asp-v0.md) — Ed25519 signed profiles
- [ASPE Protocol](spec/ariadne-asp-v0.md#aspe-protocol-exchange) — HTTP API for profiles

trust0 profiles are verifiable by Keyoxide. Keyoxide profiles are verifiable by trust0.

## Testing with Keyoxide

You can verify interoperability by:

1. Create a trust0 profile with at least one proof (e.g., GitHub)
2. Visit `https://keyoxide.org/aspe:trust0.app:YOUR_FINGERPRINT`
3. Keyoxide should fetch and verify your profile

Conversely:
1. Find a Keyoxide user's ASPE URI
2. trust0's profile viewer fetches and verifies it using @trust0/verify (doipjs fork)

This works because both implement the same Ariadne/ASPE specifications.
