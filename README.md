# trust0

**Trust no one. Verify everything.**

Cryptographic identity verification. Prove you own your accounts across platforms using Ed25519 signatures and an append-only sigchain. All verification happens in the viewer's browser.

Open source. Open data. Resilient by design.

---

## What is trust0?

trust0 is a [Keybase](https://keybase.io) replacement built on the [Ariadne specification](https://ariadne.id). It lets you cryptographically prove ownership of your online accounts — GitHub, Mastodon, DNS, Twitter, crypto wallets, and more — using Ed25519 digital signatures.

**Key properties:**

- **Client-side verification** — Your browser fetches proofs directly from platforms and verifies signatures. The server stores bytes — it can't forge results.
- **Append-only sigchain** — Every identity action is a signed, hash-linked chain entry. Key rotation, proof revocation, and identity history are all auditable.
- **Portable identity** — Export your complete identity as signed files. Self-host on GitHub Pages, your own domain, or anywhere. Your data works without this server.
- **Resilient** — If trust0.app disappears, your identity survives. Every piece of data is a self-verifying signed file. The code is open source and redeployable.

## How it works

```
1. Generate an Ed25519 keypair in your browser (WebCrypto)
2. Create a signed identity profile (Ariadne ASP format)
3. Add proofs: post your fingerprint on GitHub, DNS, Mastodon, etc.
4. Anyone can verify: their browser fetches your proofs and checks signatures
5. The server never sees your private key and can't forge verification results
```

## Proof Providers

**Client-verified** (viewer's browser checks directly):

GitHub · GitLab · Sourcehut · Codeberg · Mastodon · Bluesky · Twitter/X · Reddit · Hacker News · Lobsters · ORCID · Keybase · DNS · Personal website

**Server-attested** (bot-witnessed):

Email · Discord · Telegram

**Key-to-key** (cryptographic cross-signing):

Ethereum · Bitcoin · Solana · Nostr

## Features

| Feature | Description |
|---------|-------------|
| **Sigchain** | Append-only signed log with 9 link types (key_init, key_rotate, key_revoke, proof_add, proof_revoke, profile_update, username_claim, username_release, doc_sign) |
| **Key rotation** | Generate a new key, delegate via sigchain. Identity ID survives key changes. |
| **Document signing** | JWS detached signatures with Rekor transparency log timestamps |
| **Multi-party signatures** | Multiple signers over the same document |
| **SSH key export** | Same Ed25519 key works for `git commit -S` |
| **Paper key backup** | BIP39 24-word mnemonic for offline recovery |
| **Encrypted backup** | AES-256-GCM + PBKDF2 passphrase-protected export |
| **Identity export** | Download your complete identity (profile + chain + attestations) |
| **QR codes** | Shareable profile QR codes |

## Architecture

```
trust0.app
├── Web app (SvelteKit, Cloudflare Pages)
├── API (Hono Worker, Cloudflare D1)
├── CORS Proxy (Hono Worker — for browser verification)
├── Discord Bot (Worker)
└── Telegram Bot (Worker)

Packages:
├── @trust0/identity  — Ed25519 keys, profiles, sigchain, signing, SSH, BIP39
└── @trust0/verify    — Proof verification engine (forked from doipjs)
```

**All data is signed JWS** — self-verifying and portable. If the server disappears, the data still works anywhere.

## Quick Start

```bash
# Clone
git clone https://github.com/wan0net/trust0.git
cd trust0

# Install
pnpm install

# Run tests (71 tests)
pnpm --filter @trust0/identity test

# Dev server
pnpm --filter @trust0/api dev     # API on :8788
pnpm --filter @trust0/web dev     # Web on :5173
pnpm --filter @trust0/proxy dev   # Proxy on :8790
```

## Deploy Your Own

trust0 runs on Cloudflare's free tier. Total cost: ~$15/year (domain only).

```bash
# 1. Create D1 database
wrangler d1 create trust0-db

# 2. Update wrangler.toml with your database_id

# 3. Run migration
cd apps/api
wrangler d1 migrations apply trust0-db --local   # local
wrangler d1 migrations apply trust0-db --remote  # production

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

**If trust0.app disappears tomorrow, nobody loses their identity.**

| Scenario | Impact |
|----------|--------|
| Server goes down | Users with exported identity: redeploy anywhere. Proofs on platforms still valid. |
| User loses device | Restore from encrypted backup, BIP39 paper key, or git clone. |
| Domain changes | Sigchain `profile_update` link migrates ASPE URI to new domain. |
| Operator disappears | Anyone forks the repo, deploys to Cloudflare, restores from D1 backup. |

## Compatibility

Built on the [Ariadne specification](https://ariadne.id). Verification engine forked from [doipjs](https://codeberg.org/keyoxide/doipjs).

- **Keyoxide** users can verify trust0 profiles
- **trust0** users can verify Keyoxide profiles
- The sigchain is layered on top — invisible to Ariadne-only verifiers

## What trust0 adds over Keyoxide

| Capability | Keyoxide | trust0 |
|------------|----------|--------|
| Identity history (sigchain) | No | Yes — append-only signed log |
| Key rotation | No — new key = new identity | Yes — identity survives key changes |
| Revocation signaling | No | Yes — explicit revoke links |
| Document signing | No | Yes — JWS detached + Rekor timestamps |
| Crypto wallet proofs | No | Yes — Ethereum, Bitcoin, Solana, Nostr |
| Data export | N/A (no server data) | Yes — full identity export as JSON |
| Server-attested proofs | No | Yes — Discord, Telegram, email bots |

## License

- **App** (apps/, bots/) — [AGPL-3.0](LICENSE)
- **Libraries** (packages/identity, packages/verify) — [Apache-2.0](packages/verify/LICENSE)

## Contributing

trust0 is open source and welcomes contributions. See [CLAUDE.md](CLAUDE.md) for architecture, code style, and boundaries.

---

*Keyoxide proved the concept. Keybase proved the demand. trust0 is the maintained, audited, open-source implementation.*
