# Proposed Changes to the Ariadne Identity Specification

> Status: Draft proposals from the trust0 project.
> These are changes we believe would strengthen the Ariadne specification
> based on implementing it in production. Where possible, we've included
> the fix in trust0 and @trust0/verify already.
>
> Each proposal has an ID (APC-NNN) for reference in code comments and issues.

---

## APC-001: Relax iat Replay Window

**Severity:** Medium
**Affects:** ASP v0 §ASPE (Request JWS)
**Status:** Implemented in trust0

### Problem

The spec states:

> Servers MUST reject request JWSs that were not issued within 60 seconds of the moment of processing.

60 seconds is too narrow. Real-world conditions that cause legitimate requests to arrive late:

- Mobile devices with poor connectivity (request queued, sent 90 seconds later)
- Clock skew between client and server (NTP drift on embedded devices)
- High-latency connections (satellite internet: 600ms+ round trip)
- User composing a profile update, signing it, then getting distracted before submitting

### Proposed Change

Replace:

> Servers MUST reject request JWSs that were not issued within 60 seconds of the moment of processing.

With:

> Servers MUST reject request JWSs where the `iat` value differs from the server's current time by more than 300 seconds (5 minutes). Servers MAY use a stricter window but MUST NOT use a window shorter than 60 seconds. The recommended value is 300 seconds to accommodate clock skew and network latency.

### trust0 Implementation

`packages/identity/src/profile.ts` line 215: `Math.abs(now - iat) > 300`

---

## APC-002: Add Request Nonce for Replay Protection

**Severity:** High
**Affects:** ASP v0 §ASPE (Request JWS)
**Status:** Proposed (not yet implemented)

### Problem

The spec relies solely on `iat` timestamp freshness for replay protection. An attacker who captures a valid request JWS can replay it within the iat window. This is particularly dangerous for delete requests — a captured delete request replayed within 5 minutes would delete the victim's profile.

### Proposed Change

Add an optional `jti` (JWT ID) field to the request JWS payload:

```json
{
  "http://ariadne.id/version": 0,
  "http://ariadne.id/type": "request",
  "http://ariadne.id/action": "update",
  "iat": 1710230400,
  "jti": "550e8400-e29b-41d4-a716-446655440000",
  "http://ariadne.id/profile_jws": "...",
  "http://ariadne.id/aspe_uri": "aspe:domain:FP"
}
```

Server behavior:

> If a request JWS includes a `jti` field, the server MUST reject the request if a request with the same `jti` value has already been processed. Servers SHOULD store processed `jti` values for at least the duration of the iat window (default: 300 seconds). The `jti` field is OPTIONAL; servers MUST accept requests without it for backward compatibility.

### Impact on Existing Implementations

None — the field is optional and backward compatible. Clients that include `jti` get replay protection. Clients that don't behave as before.

---

## APC-003: Profile Expiry Enforcement

**Severity:** Medium
**Affects:** ASP v0 §JWS Structure (Optional Fields)
**Status:** Proposed

### Problem

The spec defines `exp` as an optional expiration timestamp and states:

> If the ASP has expired — determined by the profile JWS's 'iat' header — the server MUST return a 404 NOT FOUND response.

Two issues:
1. The spec says "iat header" but means `exp` in the payload — likely a typo
2. Enforcement requires the server to parse the JWS payload on every GET request, which contradicts the "opaque blob storage" model

### Proposed Change

Clarify:

> If the ASP includes an `exp` claim in the payload, servers SHOULD check the expiration on fetch requests and return 404 for expired profiles. Servers that store profiles as opaque blobs MAY defer expiration checking to the client. Clients MUST check the `exp` claim when verifying a profile and MUST reject expired profiles.

Add to client verification requirements:

> When verifying a profile JWS, the client MUST check for the presence of an `exp` claim. If present and the current time exceeds the `exp` value, the client MUST treat the profile as invalid.

---

## APC-004: Standardize Content-Type

**Severity:** Low
**Affects:** ASP v0 §ASPE Protocol (Server-Client Operations)
**Status:** Implemented in trust0

### Problem

The spec defines the Content-Type as `application/asp+jwt; charset=UTF-8` but this is not consistently used across implementations. Keyoxide's server returns the JWS without a specific Content-Type. trust0 was returning `application/asp`.

### Proposed Change

Standardize:

> Servers MUST return profile JWS responses with Content-Type `application/asp+jwt`. The `charset=UTF-8` parameter is OPTIONAL since JWS compact serialization uses only ASCII characters. Clients SHOULD accept responses with Content-Type `application/asp+jwt`, `application/asp`, `text/plain`, or `application/jwt` for interoperability with existing implementations.

---

## APC-005: CORS Requirements for Browser Clients

**Severity:** High
**Affects:** ASP v0 §ASPE Protocol
**Status:** Implemented in trust0

### Problem

The spec does not mention CORS (Cross-Origin Resource Sharing). Browser-based ASPE clients cannot fetch profiles from a different origin without CORS headers. This is a critical gap — the entire Ariadne verification model depends on the viewer's browser fetching data from multiple origins.

### Proposed Change

Add a new section to the ASPE protocol:

> **Cross-Origin Access**
>
> ASPE servers MUST include appropriate CORS headers to allow browser-based clients to fetch profiles and submit requests. At minimum, servers MUST respond to preflight OPTIONS requests and include the following headers on GET and POST responses:
>
> ```
> Access-Control-Allow-Origin: *
> Access-Control-Allow-Methods: GET, POST, OPTIONS
> Access-Control-Allow-Headers: Content-Type
> ```
>
> Servers MAY restrict `Access-Control-Allow-Origin` to a list of known client origins instead of using `*`. Servers that restrict origins MUST include the requesting origin if it matches the allowlist.
>
> The `.well-known/aspe/id/` endpoint SHOULD allow unrestricted cross-origin GET access since profile data is public by design.

### Note

The CORS proxy pattern (used by doipjs and trust0) is a workaround for platforms that don't set CORS headers (GitHub API, DNS-over-HTTPS, etc.). The ASPE server itself should not require a proxy.

---

## APC-006: Profile Versioning for Concurrent Updates

**Severity:** Medium
**Affects:** ASP v0 §ASPE Protocol (Client-Server Operations)
**Status:** Proposed

### Problem

If two clients update the same profile concurrently, last-write-wins silently. The client that submitted second has no way to know it overwrote the first client's changes. This is particularly problematic for profiles with many claims — one client adds a GitHub proof while another adds a DNS proof, and one overwrites the other.

### Proposed Change

Add an optional `If-Match` mechanism:

> Servers SHOULD support conditional updates via an `ETag` header on GET responses and an `If-Match` header on update request JWSs.
>
> When returning a profile via GET, the server SHOULD include an `ETag` header containing a hash of the stored profile JWS.
>
> When processing an update request, if the request JWS includes an `http://ariadne.id/if_match` claim, the server MUST compare it against the current profile's ETag. If they do not match, the server MUST return 409 Conflict.
>
> This mechanism is OPTIONAL for both clients and servers. If omitted, behavior is unchanged (last-write-wins).

---

## APC-007: Specify Fingerprint Collision Handling

**Severity:** Low
**Affects:** ASP v0 §Fingerprint Computation
**Status:** Informational

### Problem

The fingerprint is 128 bits (16 bytes of SHA-512), encoded as 26 characters of BASE32. While the collision probability is negligible (birthday bound at ~2^64), the spec does not discuss what happens if two different keys produce the same fingerprint.

### Proposed Change

Add a note:

> The probability of two different keys producing the same fingerprint is approximately 2^-64, which is negligible for practical purposes. However, servers MUST NOT overwrite an existing profile with a different signing key that happens to produce the same fingerprint. When processing a create request, if a profile with the same fingerprint already exists and was signed by a different key, the server MUST return 409 Conflict.

### Note

This is already the behavior of most implementations (including trust0 and aspe-server-rs) since they check fingerprint uniqueness on create. This proposal just makes it explicit in the spec.

---

## APC-008: Email Verification Mechanism

**Severity:** Medium
**Affects:** ASP v0 §JWS Structure (Optional Fields)
**Status:** Implemented in trust0

### Problem

The `http://ariadne.id/email` field is described as an "associated email address" with no verification mechanism. Anyone can claim any email address. This undermines the trust model — email is the one claim type where the proof cannot be publicly verified by the viewer's browser.

### Proposed Change

Add a new section or extend the existing email field:

> The `http://ariadne.id/email` field represents a self-asserted email address and SHOULD be treated as unverified by default.
>
> Servers MAY implement email verification via a challenge-response mechanism:
>
> 1. Client requests verification for an email address
> 2. Server generates a random challenge and sends it to the email address
> 3. Client signs the challenge with the profile's private key
> 4. Server verifies the signature and stores a server-signed attestation
>
> Attestation format:
> ```json
> {
>   "type": "email_attestation",
>   "email": "alice@example.com",
>   "fingerprint": "QPRG...",
>   "attested_by": "trust0.app",
>   "attested_at": 1710230400,
>   "expires_at": 1741766400
> }
> ```
>
> Clients displaying verified profiles SHOULD visually distinguish between self-asserted and server-attested email claims.

### trust0 Implementation

`apps/api/src/aspe.ts`: `/api/identity/email/challenge` and `/api/identity/email/verify` endpoints implement this flow.

---

## APC-009: Server-Attested Identity Proofs

**Severity:** Medium
**Affects:** Ariadne Core v0 §Identity Proofs
**Status:** Implemented in trust0

### Problem

The core spec only covers proofs that can be verified by fetching public data from a platform. Some platforms have no public profile data that a browser can access (Discord DMs, Telegram, private Slack workspaces). The spec has no mechanism for server-witnessed proofs.

### Proposed Change

Add a new proof type:

> **Server-Attested Proofs**
>
> For platforms where identity proofs cannot be publicly fetched, a trusted intermediary (bot, server) MAY witness the proof and produce a signed attestation.
>
> Flow:
> 1. User sends their fingerprint to a verification bot on the platform (e.g., Discord `/verify FINGERPRINT`)
> 2. Bot confirms the user's platform identity (user ID, username)
> 3. Bot creates a signed attestation linking the platform identity to the fingerprint
> 4. Attestation is stored on the ASPE server and served alongside the profile
>
> Clients displaying server-attested proofs MUST visually distinguish them from client-verified proofs, clearly indicating which server performed the attestation.
>
> Server-attested proofs are inherently weaker than client-verified proofs because they require trusting the attestation server. Clients SHOULD display the attesting server's identity.

---

## APC-010: Sigchain Extension

**Severity:** N/A (new feature)
**Affects:** New specification document
**Status:** Implemented in trust0

### Problem

The Ariadne spec provides current-state profiles only. There is no mechanism for:
- Identity history (when was a proof added?)
- Key rotation (change keys without losing identity)
- Explicit revocation (mark a proof as removed vs. just absent)
- Stable identity across key changes

### Proposed Change

This is not a modification to the existing spec but a new companion specification. See [trust0 Sigchain Specification](sigchain.md) for the full document.

The sigchain is layered on top of ASP profiles — it does not modify the profile format. A verifier that only implements the core Ariadne spec sees a standard ASP profile and ignores the sigchain. A verifier that implements the sigchain extension gets additional trust signals.

---

## Summary

| ID | Title | Severity | Backward Compatible | Implemented |
|----|-------|----------|--------------------:|-------------|
| APC-001 | Relax iat window | Medium | Yes | trust0 |
| APC-002 | Request nonce (jti) | High | Yes | Proposed |
| APC-003 | Profile expiry enforcement | Medium | Yes | Proposed |
| APC-004 | Standardize Content-Type | Low | Yes | trust0 |
| APC-005 | CORS requirements | High | Yes | trust0 |
| APC-006 | Profile versioning (ETag) | Medium | Yes | Proposed |
| APC-007 | Fingerprint collision handling | Low | Yes | Informational |
| APC-008 | Email verification | Medium | Yes | trust0 |
| APC-009 | Server-attested proofs | Medium | Yes | trust0 |
| APC-010 | Sigchain extension | N/A | Yes | trust0 |

All proposals are backward compatible — existing implementations continue to work without changes. Proposals marked "Implemented" include working code in the trust0 repository.
