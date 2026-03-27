# Persona Review — What Works, What's Broken, What's Missing

Review of trust0 against each persona. Status as of 2026-03-27.

---

## Maya Chen — Open Source Maintainer

**What works:**
- GitHub gist proof page ✅
- DNS proof page ✅
- GitLab proof page ✅
- Mastodon proof page ✅
- Key rotation (chain.ts + UI) ✅
- Sigchain history ✅
- SSH key export for git commit signing ✅
- BIP39 paper key backup ✅

**What's broken/missing:**
- **npm proof** — no proof page for npm packages. doipjs doesn't have an npm provider either. Need to build this. Maya can't prove she publishes `@maya/data-transform`.
- **CLI** — no CLI tool at all. Maya wants `trust0 sign release.tar.gz` from the terminal. The web app works but expert users expect a CLI.
- **Git commit signing integration** — SSH key export exists but no guide on connecting it to the identity. Need a "Set up git signing" flow that outputs the config commands.
- **Release artifact signing** — document signing exists but no "sign a release" workflow. Should support signing a tarball and producing a `.sig.json` alongside it.

**Priority fixes for Maya:**
1. CLI tool (high effort, high value)
2. npm proof page (medium effort)
3. Git signing guide in docs

---

## Jamal Wright — Investigative Journalist

**What works:**
- Website proof page ✅
- Mastodon proof page ✅
- Hacker News proof page ✅
- Email attestation (challenge-response) ✅
- DNS proof page ✅
- Encrypted backup ✅
- Stable identity ID (survives platform bans) ✅
- Vanity username ✅

**What's broken/missing:**
- **Web app UX is developer-focused** — Jamal is intermediate. The current identity dashboard assumes you know what Ed25519 is. Need plain-language onboarding: "Your identity is like a digital passport. Here's how to set it up."
- **No "share your profile" prominent feature** — Jamal needs trust0.app/jamal as a link to put in his bio everywhere. The profile viewer exists but there's no emphasis on sharing.
- **No recovery flow** — if Jamal loses his device, the backup restore flow exists but isn't intuitive. Need a guided "I lost my key" recovery wizard.
- **Profile page isn't public-friendly** — the profile viewer shows technical details (fingerprint, chain links). Jamal's sources need a simple "this is Jamal, here are his verified accounts" page.

**Priority fixes for Jamal:**
1. Onboarding flow with plain language (medium effort, high value)
2. Public profile page redesign — human-friendly, not crypto-technical
3. "Share your profile" feature (copy link button, QR code prominent)
4. Recovery wizard

---

## Priya Ramanathan — Security Researcher

**What works:**
- GitHub proof ✅
- Website proof ✅
- DNS proof ✅
- Mastodon proof ✅
- Discord bot attestation ✅
- Document signing with Rekor timestamps ✅
- Sigchain audit trail ✅
- Multi-party signatures ✅

**What's broken/missing:**
- **Document signing UX is basic** — sign a file, download `.sig.json`. Priya wants batch signing, STIX bundle signing, and a way to verify signatures from the command line.
- **No signed advisory workflow** — need a "Sign & Publish" flow that signs, timestamps via Rekor, appends to sigchain, and produces a shareable verification page.
- **Rekor integration hasn't been tested live** — the `submitToRekor` function exists but may have issues with the actual Rekor API format.
- **No git notes integration** — the PLAN mentions storing JWS counter-signatures in git notes for richer commit signing. Not implemented.

**Priority fixes for Priya:**
1. Test Rekor integration against real API (critical — may be broken)
2. Verify page for signed documents (someone receives a `.sig.json`, visits trust0 to verify)
3. CLI for batch signing

---

## Alex Novak — Digital Artist

**What works:**
- Website proof ✅
- Mastodon proof ✅
- Hacker News proof ✅
- Discord bot ✅
- Telegram bot ✅
- Vanity username ✅
- Encrypted backup ✅

**What's broken/missing:**
- **Onboarding is too technical** — Alex will bounce off "Generate an Ed25519 key pair." Need: "Create your verified identity in 3 steps" with illustrations.
- **No social preview** — when Alex shares trust0.app/alexnovak on Twitter/Discord, there's no OpenGraph image. Need OG meta tags with profile info.
- **QR code isn't prominent enough** — Alex wants to print a QR code for art shows. The QR exists but it's buried in the dashboard.
- **No profile customization on the public page** — avatar and theme color exist in the profile JWS but the public profile viewer doesn't render them nicely. Alex needs his brand colors and art as avatar.
- **No "link in bio" page** — Alex doesn't just want verified proofs, he wants a pretty link-in-bio page (like Linktree) that happens to be cryptographically verified.
- **The web app still has login2 layout remnants** — `@link42/ui` and `@link42/tokens` references stripped but the layout needs polish.

**Priority fixes for Alex:**
1. Onboarding wizard (highest impact for non-technical adoption)
2. Public profile as a pretty "link in bio" page
3. OpenGraph/Twitter Card meta tags for social sharing
4. QR code as a downloadable/printable asset

---

## Dr. Fatima Al-Rashidi — Academic Researcher

**What works:**
- ORCID proof page ✅
- Website proof ✅
- GitHub proof ✅
- DNS proof ✅
- GitLab proof ✅
- Email attestation ✅
- Key rotation ✅
- Stable identity ID ✅
- Document signing ✅

**What's broken/missing:**
- **No peer review signing workflow** — Fatima wants to sign her reviews to prove she wrote them. The generic document signing works but there's no "sign a review" template.
- **ORCID integration is shallow** — the proof page just adds an ORCID URL as a claim. It doesn't fetch or display ORCID metadata (publications, affiliations).
- **No institutional email re-verification flow** — when Fatima moves to a new university, she needs to replace her old email attestation with the new one. The system supports this (upsert) but there's no "Update your email" UI flow.
- **Cross-institution identity is the killer feature but not marketed** — the stable Identity ID that persists across jobs needs to be front and center for academic users.

**Priority fixes for Fatima:**
1. "Update email" flow (re-attest with new institutional email)
2. ORCID metadata display on profile
3. Academic use case in docs/marketing

---

## Cross-Persona Priority Matrix

| Fix | Maya | Jamal | Priya | Alex | Fatima | Effort | Impact |
|-----|------|-------|-------|------|--------|--------|--------|
| **Onboarding wizard** | - | HIGH | - | CRITICAL | - | Medium | Very High |
| **Public profile redesign** | - | HIGH | - | CRITICAL | High | Medium | Very High |
| **OG/social meta tags** | - | High | - | HIGH | - | Low | High |
| **CLI tool** | CRITICAL | - | HIGH | - | - | High | High |
| **Test Rekor live** | - | - | CRITICAL | - | - | Low | High |
| **Recovery wizard** | - | HIGH | - | High | - | Medium | Medium |
| **npm proof page** | HIGH | - | - | - | - | Medium | Low |
| **QR downloadable** | - | - | - | HIGH | - | Low | Medium |
| **Update email flow** | - | - | - | - | HIGH | Low | Medium |
| **Web app layout polish** | Low | Medium | Low | HIGH | Low | Medium | Medium |
| **Batch doc signing** | - | - | HIGH | - | - | Medium | Low |
| **Link-in-bio profile** | - | - | - | CRITICAL | - | Medium | High |
| **ORCID metadata** | - | - | - | - | Medium | Medium | Low |
| **Git notes integration** | High | - | Medium | - | - | Medium | Low |

## Recommended Build Order

### Phase A: Make It Usable (non-technical users)
1. Onboarding wizard — plain-language 3-step identity setup
2. Public profile redesign — pretty, human-friendly, "link in bio" style
3. OpenGraph/Twitter Card meta tags on profile pages
4. QR code as downloadable PNG/SVG asset

### Phase B: Make It Trustworthy (verify the crypto works)
5. Test Rekor integration against real Sigstore API
6. Interop test: create profile on trust0, verify on keyoxide.org live
7. Audit @trust0/verify critical paths (GitHub, DNS, Mastodon providers)

### Phase C: Make It Powerful (expert users)
8. CLI tool — `trust0 init`, `trust0 prove`, `trust0 sign`, `trust0 verify`
9. npm proof page
10. Recovery wizard
11. Update email flow
12. Batch document signing

### Phase D: Make It Beautiful (polish)
13. Web app layout overhaul (strip login2 remnants, trust0-native design)
14. Profile customization rendering (avatar, colors on public profile)
15. ORCID metadata enrichment
16. Git notes integration guide
