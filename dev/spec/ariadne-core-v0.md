# Ariadne Identity Core Specification v0

> Original specification by Yarmo Mackenbach, published November 16, 2022.
> Source: https://ariadne.id/core/0/
> License: Apache-2.0
> Status: Draft

This document is included in the trust0 repository for reference. trust0 adopts and extends this specification.

---

## Overview

The Ariadne Identity Core Specification describes a protocol to prove online identity in a decentralized manner using bidirectional linking and secured by cryptography.

The process:
1. Fetch cryptographically secured documents containing **identity claims**
2. Parse them to identify potential proof locations
3. Search those locations for matching **identity proofs**

## Identity Claims

An identity claim is a URI pointing to a digital asset the identity owner controls — a domain, a service account, a crypto address. Claims are stored inside cryptographically signed documents called **identity profiles**.

Claims are URIs. Examples:
- `https://gist.github.com/alice/abc123` (GitHub Gist)
- `dns:alice.dev?type=TXT` (DNS TXT record)
- `https://fosstodon.org/@alice` (Mastodon profile)

## Identity Profiles

A collection of identity claims stored in a cryptographically signed document. Two formats are supported:

### OpenPGP Notations
Claims stored as notations on an OpenPGP public key:
```
proof@ariadne.id=https://gist.github.com/alice/abc123
proof@ariadne.id=dns:alice.dev?type=TXT
```

### Signed Plaintext Documents (ASP)
Claims stored in a JSON Web Signature (JWS) — the Ariadne Signature Profile format. See the [ASP specification](ariadne-asp-v0.md) for details.

## Identity Proofs

An identity proof is a link posted on a platform that points back to the cryptographic key. The proof must be findable at a location deducible from the identity claim.

Proofs can be:
- **Plain text**: The fingerprint string appears in the fetched data
- **Cryptographic hash**: An argon2 or bcrypt hash of the fingerprint
- **URI**: A URL pointing to the profile

## Verification Process

1. **Match**: Compare claim URI against known service provider definitions
2. **Fetch**: Retrieve data from the deduced proof location
3. **Search**: Look for the fingerprint (or its hash) in the fetched data
4. **Result**: If found, the claim is verified

Service provider definitions are maintained at ariadne.id/arc and define how to extract and verify proofs for each platform.

## Fingerprint Computation

For Ed25519 keys:
```
1. Construct canonical JWK: { crv, kty, x }
2. JSON.stringify (keys in alphabetical order)
3. SHA-512 hash
4. Take first 16 bytes
5. BASE32 encode without padding
```

Result: 26-character uppercase string (e.g., `QPRGVPJNWDXH4ESK2RYDTZJLTE`)

The fingerprint is not case-sensitive.

---

*trust0 extends this specification with the [sigchain](../how-it-works.md#the-sigchain), adding identity history, key rotation, and revocation that the core spec does not cover.*
