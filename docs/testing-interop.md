# Interoperability Testing with Keyoxide

## Why This Matters

trust0 implements the same Ariadne/ASP/ASPE specifications as Keyoxide. If our implementation is correct, a trust0 profile should be verifiable on keyoxide.org, and a Keyoxide profile should be verifiable on trust0.

This is the strongest possible validation: an independent implementation verifying our output.

## Testing trust0 → Keyoxide

Once trust0.app is running:

1. Create a profile on trust0 with at least one client-verified proof (e.g., GitHub gist)
2. Note your ASPE URI: `aspe:trust0.app:YOUR_FINGERPRINT`
3. Visit: `https://keyoxide.org/aspe:trust0.app:YOUR_FINGERPRINT`
4. Keyoxide should:
   - Fetch the profile from trust0's ASPE endpoint
   - Parse the ASP JWS
   - Verify the Ed25519 signature
   - Check each claim against the platform
   - Show verification results

**If this works**, our ASP profile format, JWS signing, fingerprint computation, and ASPE endpoint are all correct.

**If this fails**, compare:
- Is our `Content-Type` header correct? (`application/asp+jwt`)
- Is the JWS compact serialization valid?
- Is the fingerprint computed correctly (SHA-512 → first 16 bytes → BASE32)?
- Are the payload claim names correct (`http://ariadne.id/version`, etc.)?
- Is the ASPE endpoint path correct (`/.well-known/aspe/id/{fp}`)?

## Testing Keyoxide → trust0

1. Find a Keyoxide user's ASPE URI (e.g., from keyoxide.org profiles)
2. Enter it in trust0's profile viewer
3. trust0 should:
   - Fetch the profile from the Keyoxide user's ASPE server
   - Parse and verify using @trust0/verify
   - Show verification results

This tests our verification engine (@trust0/verify, forked from doipjs).

## Automated Interop Tests

Add to the test suite:

```typescript
// test/interop.test.ts
import { createProfile, computeFingerprint, generateIdentityKey } from "@trust0/identity";

describe("Ariadne interop", () => {
  it("profile JWS is valid compact serialization", async () => {
    const { privateKey, publicJWK } = await generateIdentityKey();
    const fp = await computeFingerprint(publicJWK);
    const profile = await createProfile({
      name: "Test",
      claims: ["https://example.com"],
      key: privateKey,
      publicJWK,
      fingerprint: fp,
    });

    // Must be three base64url segments separated by dots
    const parts = profile.split(".");
    expect(parts.length).toBe(3);

    // Header must contain typ, alg, kid, jwk
    const header = JSON.parse(atob(parts[0]));
    expect(header.typ).toBe("JWT");
    expect(header.alg).toBe("EdDSA");
    expect(header.kid).toBe(fp);
    expect(header.jwk.kty).toBe("OKP");
    expect(header.jwk.crv).toBe("Ed25519");

    // Payload must use Ariadne namespaced claims
    const payload = JSON.parse(atob(parts[1]));
    expect(payload["http://ariadne.id/version"]).toBe(0);
    expect(payload["http://ariadne.id/type"]).toBe("profile");
    expect(payload["http://ariadne.id/name"]).toBe("Test");
  });

  it("fingerprint matches Ariadne algorithm", async () => {
    const { publicJWK } = await generateIdentityKey();
    const fp = await computeFingerprint(publicJWK);

    // Must be 26 chars, uppercase BASE32
    expect(fp).toMatch(/^[A-Z2-7]{26}$/);

    // Must be deterministic
    const fp2 = await computeFingerprint(publicJWK);
    expect(fp).toBe(fp2);
  });
});
```

## Known Differences

trust0 extends Ariadne but maintains backward compatibility:

| Feature | Ariadne Spec | trust0 |
|---------|-------------|--------|
| Profile format | ASP v0 | ASP v0 (identical) |
| Fingerprint | SHA-512 → 16 bytes → BASE32 | Same |
| ASPE endpoints | GET/POST .well-known/aspe/ | Same + additional API routes |
| Request iat window | 60 seconds | 5 minutes (more permissive) |
| Sigchain | Not specified | trust0 extension |
| Key rotation | Not specified | trust0 extension |
| Document signing | Not specified | trust0 extension |

The extensions are additive — they don't modify the base spec. A pure Ariadne verifier ignores the sigchain and sees a standard ASP profile.
