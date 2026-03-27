# How trust0 Works

## The Problem

You have accounts on GitHub, Mastodon, a personal domain, maybe a crypto wallet. How does someone know these all belong to the same person? Today, you can't prove it without trusting a third party.

Keybase solved this — then got acquired by Zoom and effectively died. The accounts, the proofs, the infrastructure — all gone, because everything lived on their servers.

trust0 solves the same problem without the single point of failure.

## The Core Idea

Identity verification through **bidirectional linking**:

1. Your cryptographic identity (an Ed25519 keypair) makes a **claim**: "I own this GitHub account"
2. Your GitHub account makes a **proof**: "I belong to this cryptographic identity"
3. Anyone can verify both directions — no server trust needed

```
Your Identity Profile                    Your GitHub Gist
┌──────────────────────┐                ┌──────────────────────────────┐
│ claims: [            │                │                              │
│   "https://gist.     │ ──── links ──→ │ aspe:trust0.app:QPRG...     │
│    github.com/..."   │                │                              │
│ ]                    │ ←── proves ─── │ (posted by your GH account) │
│                      │                │                              │
│ signed by: Ed25519   │                └──────────────────────────────┘
│ fingerprint: QPRG... │
└──────────────────────┘
```

The profile is cryptographically signed. The gist is posted from your account. The fingerprint matches. Proof complete.

## Step by Step

### 1. Generate a Key

When you first use trust0, your browser generates an Ed25519 keypair using the Web Cryptography API. The private key never leaves your browser — it's stored in IndexedDB as an opaque CryptoKey object.

Your **fingerprint** is derived from the public key:
```
canonical JWK → SHA-512 → first 16 bytes → BASE32 → 26 characters
Example: QPRGVPJNWDXH4ESK2RYDTZJLTE
```

This fingerprint uniquely identifies your key and is used across all proofs.

### 2. Create a Profile

Your profile is an **Ariadne Signature Profile (ASP)** — a JWS (JSON Web Signature) containing your name, claims, and optional metadata. It's signed with your Ed25519 key.

```json
{
  "http://ariadne.id/version": 0,
  "http://ariadne.id/type": "profile",
  "http://ariadne.id/name": "Alice",
  "http://ariadne.id/claims": [
    "https://gist.github.com/alice/abc123",
    "dns:alice.dev?type=TXT"
  ]
}
```

This payload is signed and encoded as a compact JWS: `header.payload.signature`

The profile is uploaded to trust0.app (or any ASPE-compatible server) and becomes publicly accessible at:
```
https://trust0.app/.well-known/aspe/id/QPRGVPJNWDXH4ESK2RYDTZJLTE
```

### 3. Add Proofs

For each account you want to prove, you post your fingerprint on that platform:

| Platform | Where you post the proof |
|----------|------------------------|
| GitHub | Create a public Gist containing your fingerprint |
| DNS | Add a TXT record at `_aspe.yourdomain.com` |
| Mastodon | Add fingerprint to your profile bio |
| Hacker News | Add fingerprint to your "about" field |
| Twitter/X | Post a tweet containing your fingerprint |
| Ethereum | Sign a message with your wallet |
| Nostr | Cross-sign with your Nostr key |

Then you add the claim URI (the URL of the proof) to your profile and re-sign it.

### 4. Verification (Client-Side)

When someone visits your profile, **their browser** does the verification:

1. Fetch your ASP profile from the ASPE server
2. Verify the JWS signature (confirms the profile was signed by your key)
3. For each claim in the profile:
   - Fetch the platform data (the gist, the DNS record, the bio)
   - Search for your fingerprint in the fetched data
   - If found → **VERIFIED**

The server never participates in verification. It just stores and serves the signed profile. A malicious server could withhold your profile (denial of service), but it cannot forge a verification result.

## The Sigchain

Ariadne profiles are current-state only — they tell you what claims exist now, but not the history. trust0 adds a **sigchain**: an append-only, hash-linked log of every identity action.

```
chain/0.jwt — key_init (genesis). Identity ID = SHA-256(this)
    ↓ sha256 hash
chain/1.jwt — proof_add (GitHub). prev = hash of link 0
    ↓ sha256 hash
chain/2.jwt — username_claim. prev = hash of link 1
    ↓ sha256 hash
chain/3.jwt — key_rotate (new key). prev = hash of link 2
    ↓ sha256 hash
chain/4.jwt — proof_revoke (removed old proof). prev = hash of link 3
```

Each link is a signed JWT containing:
- **seqno**: sequential number (0, 1, 2, ...)
- **prev**: SHA-256 hash of the previous link (null for genesis)
- **type**: what happened (proof_add, key_rotate, etc.)
- **body**: the details
- **timestamp**: when it happened

The chain is verifiable by anyone:
1. Check link 0 is `key_init` and compute Identity ID = SHA-256(link 0)
2. For each subsequent link: verify the signature, check prev hash matches, check signer is authorized
3. Derive current state: which keys are active, which proofs are live, what's the username

### Link Types

| Type | What it does |
|------|-------------|
| `key_init` | Genesis link. Creates the identity. |
| `key_rotate` | Delegates authority to a new key. Old key signs the handoff. |
| `key_revoke` | Marks a key as revoked. Only active keys can sign new links. |
| `proof_add` | Adds a claim (GitHub, DNS, etc.) |
| `proof_revoke` | Removes a claim |
| `profile_update` | Points to a new ASP profile |
| `username_claim` | Claims a vanity username |
| `username_release` | Releases a claimed username |
| `doc_sign` | Records a document signature in the audit trail |

### Stable Identity

Your **Identity ID** is the SHA-256 hash of your genesis link, encoded as BASE32 (52 characters). It never changes, even when you rotate keys. The genesis link is the permanent anchor for your identity.

```
Identity ID: ABCDEFGHIJKLMNOPQRSTUVWXYZABCDEFGHIJKLMNOPQRSTUVWXYZ
             (52 characters, permanent, survives key rotation)

Fingerprint: QPRGVPJNWDXH4ESK2RYDTZJLTE
             (26 characters, changes when key rotates)
```

## Key Rotation

If your key is compromised or you want a new one:

1. Generate new Ed25519 keypair
2. Sign a `key_rotate` link with the **old** key (proves authorization)
3. The new key is now authorized to sign links
4. Create a new profile with the new key
5. Optionally revoke the old key with a `key_revoke` link
6. Identity ID stays the same — your identity survives the key change

This is what Keyoxide cannot do. In Keyoxide, a new key = a new identity.

## Document Signing

trust0 uses the same Ed25519 key for document signing:

- **JWS detached payload** (RFC 7515 Appendix F) — the signature is separate from the document
- **Rekor timestamping** — submit to Sigstore's transparency log for proof-of-existence
- **Multi-party signatures** — multiple signers over the same document
- **SSH key export** — same key works for `git commit -S`

The signature carries your identity metadata (ASPE URI, fingerprint), so a verifier can look up your profile, verify your social proofs, and know *who* signed the document.

## Data Portability

Every piece of data in trust0 is a self-verifying signed file:

- **Profile**: JWS compact serialization — works anywhere JOSE libraries exist
- **Chain links**: JWT files — independently verifiable
- **Attestations**: signed by the server — verifiable with the server's public key

You can export your complete identity and host it yourself — on GitHub Pages, your own domain, anywhere that serves static files. If trust0.app disappears, your identity survives.

## Privacy Model

Everything is public by design — that's the point. You're proving identity publicly.

| Data | Visibility |
|------|-----------|
| Profile (name, claims) | Public |
| Sigchain | Public |
| Proofs on platforms | Public |
| Usernames | Public |
| Private key | **Never on server** — browser only |

The only private thing is your key. Everything else is intentionally public because the whole system is about publicly verifiable identity.
