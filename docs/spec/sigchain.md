# trust0 Sigchain Specification

> Extension to the Ariadne Identity specification.
> Author: trust0 project
> Status: Draft
> License: CC-BY-SA-4.0

---

## Overview

The Ariadne specification provides current-state identity profiles but no history. The sigchain adds an append-only, hash-linked log of identity events, enabling:

- **Auditability**: See when proofs were added, revoked, or modified
- **Key rotation**: Change keys without losing identity
- **Revocation**: Explicitly mark proofs or keys as invalid
- **Stable identity**: Identity ID survives key changes

This is the capability that Keybase had and Keyoxide lacks.

## Data Model

A sigchain is a sequence of **links**, each a signed JWT file. Links are numbered sequentially (seqno 0, 1, 2, ...) and hash-linked: each link contains the SHA-256 hash of the previous link.

```
chain/0.jwt ─── hash ──→ chain/1.jwt ─── hash ──→ chain/2.jwt ─── hash ──→ ...
(genesis)                 (proof_add)              (username_claim)
```

### Identity ID

The Identity ID is a permanent identifier derived from the genesis link:

```
Identity ID = BASE32(SHA-256(chain/0.jwt))
```

This produces a 52-character uppercase string. It never changes, even when keys rotate.

### Link Structure

Each link is a JWS compact serialization with the following payload:

```json
{
  "version": 1,
  "seqno": 4,
  "prev": "sha256:<base64url hash of previous link>",
  "timestamp": 1710230400,
  "type": "proof_add",
  "body": {
    "claim_uri": "https://gist.github.com/alice/abc123"
  }
}
```

#### Header

Same as ASP profiles:
```json
{
  "typ": "JWT",
  "alg": "EdDSA",
  "kid": "<fingerprint of signing key>",
  "jwk": { "kty": "OKP", "crv": "Ed25519", "x": "..." }
}
```

#### Payload Fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `version` | number | Yes | Must be `1` |
| `seqno` | number | Yes | Sequential index (0 for genesis) |
| `prev` | string\|null | Yes | `sha256:<hash>` of previous link, or `null` for genesis |
| `timestamp` | number | Yes | Unix timestamp (seconds) |
| `type` | string | Yes | Link type (see below) |
| `body` | object | Yes | Type-specific payload |

## Link Types

### key_init (genesis)

Creates a new identity. Must be seqno 0 with null prev.

```json
{
  "type": "key_init",
  "body": {
    "fingerprint": "QPRGVPJNWDXH4ESK2RYDTZJLTE"
  }
}
```

The signing key's fingerprint is added to the **active key set**.

### key_rotate

Delegates authority to a new key. Must be signed by a currently active key.

```json
{
  "type": "key_rotate",
  "body": {
    "new_fingerprint": "NEWKEYFINGERPRINT26CHARS",
    "new_jwk": { "kty": "OKP", "crv": "Ed25519", "x": "..." }
  }
}
```

The new key's fingerprint is added to the active key set. Both old and new keys are now authorized until the old one is explicitly revoked.

### key_revoke

Removes a key from the active set. Must be signed by a currently active key (not necessarily the key being revoked).

```json
{
  "type": "key_revoke",
  "body": {
    "fingerprint": "KEYTOREVOKE26CHARACTERS"
  }
}
```

After this link, the revoked key cannot sign new links.

### proof_add

Claims ownership of an account or resource.

```json
{
  "type": "proof_add",
  "body": {
    "claim_uri": "https://gist.github.com/alice/abc123"
  }
}
```

The claim URI is added to the **active proofs** list.

### proof_revoke

Removes a previously added proof.

```json
{
  "type": "proof_revoke",
  "body": {
    "claim_uri": "https://gist.github.com/alice/abc123"
  }
}
```

The claim URI is removed from the active proofs list.

### profile_update

Points to a new ASP profile (e.g., after key rotation).

```json
{
  "type": "profile_update",
  "body": {
    "profile_fingerprint": "NEWKEYFINGERPRINT26CHARS"
  }
}
```

### username_claim

Claims a vanity username on the server.

```json
{
  "type": "username_claim",
  "body": {
    "username": "alice"
  }
}
```

### username_release

Releases a previously claimed username.

```json
{
  "type": "username_release",
  "body": {}
}
```

### doc_sign

Records a document signature in the identity's audit trail. Informational only — does not change chain state.

```json
{
  "type": "doc_sign",
  "body": {
    "doc_hash": "sha256:<base64url>",
    "doc_name": "contract.pdf",
    "rekor_log_index": 12345
  }
}
```

## Verification Algorithm

```
function verifyChain(links[]) → ChainState:
  1. Parse link[0], verify it is key_init with seqno=0 and prev=null
  2. Compute Identity ID = BASE32(SHA-256(links[0]))
  3. Initialize state:
     - activeFingerprints = { link[0].fingerprint }
     - activeProofs = []
     - username = null
  4. For each subsequent link[i]:
     a. Verify JWS signature
     b. Verify prev == SHA-256(links[i-1])
     c. Verify seqno == i
     d. Verify signer fingerprint is in activeFingerprints
     e. Update state based on link type
  5. Return final state
```

If any step fails, the chain is invalid. A verifier MUST reject the entire chain.

## Security Properties

- **Append-only**: Links can only be added, never modified or removed
- **Hash-linked**: Tampering with any link breaks the chain
- **Signed**: Only authorized keys can append links
- **Fork-resistant**: The unique index on (identity_id, seqno) prevents forks at the server level

### Limitations (v1)

- No Merkle tree: The server could withhold recent links (rollback attack). A verifier cannot detect missing links unless they have seen a more recent version of the chain.
- No cross-signing of rotation: The new key does not counter-sign the rotation link. This means a compromised old key could rotate to an attacker's key. Future versions may require bidirectional rotation signatures.

---

*Implementation: `@trust0/identity` package — `createChainLink()`, `parseChainLink()`, `verifyChain()`, `computeLinkHash()`, `computeIdentityId()`*
