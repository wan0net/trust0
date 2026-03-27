# Ariadne Signature Profile (ASP) v0

> Original specification by Yarmo Mackenbach.
> Source: https://ariadne.id/related/ariadne-signature-profile-0/
> License: Apache-2.0

This document is included in the trust0 repository for reference. trust0 implements this specification for all identity profiles.

---

## Overview

An Ariadne Signature Profile (ASP) is a cryptographic method for creating and exchanging identity profiles without OpenPGP, using JSON Web Signatures (JWS).

## Cryptographic Requirements

ASPs MUST use one of:
- **EdDSA** with curve **Ed25519** (recommended, used by trust0)
- **ES256** with curve **P-256**

The public key MUST be included in JWK format within the JWS protected header.

## JWS Structure

### Protected Header

```json
{
  "typ": "JWT",
  "alg": "EdDSA",
  "kid": "QPRGVPJNWDXH4ESK2RYDTZJLTE",
  "jwk": {
    "kty": "OKP",
    "crv": "Ed25519",
    "x": "<base64url-encoded 32-byte public key>"
  }
}
```

| Field | Required | Description |
|-------|----------|-------------|
| `typ` | Yes | Must be `"JWT"` |
| `alg` | Yes | `"EdDSA"` or `"ES256"` |
| `kid` | Yes | Profile fingerprint (26-char BASE32) |
| `jwk` | Yes | Public key in JWK format |

### Payload (Required Fields)

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

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `http://ariadne.id/version` | number | Yes | Must be `0` |
| `http://ariadne.id/type` | string | Yes | Must be `"profile"` |
| `http://ariadne.id/name` | string | Yes | Display name |
| `http://ariadne.id/claims` | string[] | Yes | Array of claim URIs |

### Payload (Optional Fields)

| Field | Type | Description |
|-------|------|-------------|
| `http://ariadne.id/description` | string | Bio or description |
| `http://ariadne.id/avatar_url` | string | Publicly accessible image URL |
| `http://ariadne.id/email` | string | Email address (unverified) |
| `http://ariadne.id/color` | string | Hex color `#RRGGBB` |
| `exp` | number | Expiration timestamp (RFC 7519) |

### Wire Format

Compact JWS serialization:
```
BASE64URL(header) . BASE64URL(payload) . BASE64URL(signature)
```

Content-Type: `application/asp+jwt; charset=UTF-8`

## Fingerprint Algorithm

```
Input:  JWK public key
Output: 26-character BASE32 string

1. Construct canonical JWK object:
   Ed25519: { crv, kty, x }
   P-256:   { crv, kty, x, y }
   (keys in alphabetical order)

2. hash = SHA-512(JSON.stringify(canonical))

3. truncated = hash.slice(0, 16)    // first 16 bytes

4. fingerprint = BASE32(truncated)  // RFC 4648, no padding, uppercase
```

The fingerprint is not case-sensitive.

## ASPE Protocol (Exchange)

### ASPE URI Format

```
aspe:domain:fingerprint
```

Example: `aspe:trust0.app:QPRGVPJNWDXH4ESK2RYDTZJLTE`

### Endpoints

**Fetch profile:**
```
GET https://domain/.well-known/aspe/id/{FINGERPRINT}
→ 200: Compact JWS (Content-Type: application/asp+jwt)
→ 404: Profile not found or expired
```

**Upload/update/delete:**
```
POST https://domain/.well-known/aspe/post/
Body: Request JWS (see below)
```

**Server version:**
```
GET https://domain/.well-known/aspe/version
→ JSON or plaintext server info
```

### Request JWS

Operations are authenticated via a signed request JWS:

```json
{
  "http://ariadne.id/version": 0,
  "http://ariadne.id/type": "request",
  "http://ariadne.id/action": "create",
  "iat": 1710230400,
  "http://ariadne.id/profile_jws": "<compact profile JWS>",
  "http://ariadne.id/aspe_uri": "aspe:domain:FINGERPRINT"
}
```

| Field | create | update | delete |
|-------|--------|--------|--------|
| `profile_jws` | Required | Required | — |
| `aspe_uri` | — | Required | Required |
| `iat` | Required | Required | Required |

Servers MUST reject requests where `iat` is not within an acceptable window (spec recommends 60 seconds; trust0 uses 5 minutes for clock skew tolerance).

## Security Considerations

- **Body size limits**: Servers should limit request body size
- **Rate limiting**: Recommended to prevent abuse
- **Replay protection**: `iat` timestamp validation prevents replay attacks
- **Key storage**: Clients must encrypt private keys before storage or export

---

*trust0 implements this specification fully. The `@trust0/identity` package provides `createProfile()`, `parseProfile()`, `createRequest()`, and `parseRequest()` functions that handle ASP creation and verification.*
