# User Personas

Five representative users of the cryptographic identity platform, covering different motivations, technical levels, and proof strategies.

---

## 1. Maya Chen — Open Source Maintainer

**Role:** Staff engineer at a mid-size SaaS company; maintains 3 popular npm packages on the side.
**Technical level:** Expert. Comfortable with GPG, SSH keys, CLI tools.
**Location:** San Francisco, CA

**Motivation:** Supply chain trust. After a dependency confusion incident at work, she wants contributors and users to verify that the person publishing `@maya/data-transform` on npm is the same person as `mayachen` on GitHub and `maya.dev` the blog author. She's tired of "trust me, I'm the same person" being the only option.

**Proof strategy:**
- GitHub (gist) — primary developer identity
- DNS (maya.dev) — personal domain
- npm — package registry (when available)
- GitLab — mirrors her repos there
- Mastodon (@maya@hachyderm.io) — tech community presence

**Key behavior:** Will use the CLI if available. Wants to sign git commits and release artifacts with the same key. Cares deeply about key rotation — she's been burned by lost PGP keys before. The sigchain's key rotation support is her main draw over Keyoxide.

**Quote:** "I don't need people to trust me. I need them to verify."

---

## 2. Jamal Wright — Investigative Journalist

**Role:** Freelance journalist covering cybersecurity and government surveillance.
**Technical level:** Intermediate. Uses Signal, understands encryption concepts, but not a developer.
**Location:** London, UK

**Motivation:** Source protection and authentication. His sources need to verify they're talking to the real Jamal, not an impersonator. He also wants to prove continuity — that the person who published the exposé last year is the same person accepting tips today, even if he changes email providers or gets locked out of Twitter.

**Proof strategy:**
- Personal website (jamalwrites.com) — primary professional identity
- Mastodon (@jamal@journalism.social) — post-Twitter presence
- Hacker News (jamalw) — where tech sources find him
- Email (jamal@jamalwrites.com) — server-attested, for source contact
- DNS (jamalwrites.com) — domain ownership proof

**Key behavior:** Uses the web app exclusively. Wants the encrypted backup feature — stores the passphrase in his password manager. The stable identity ID matters to him because he's had accounts suspended before and needs an identity that survives platform bans.

**Quote:** "My identity shouldn't depend on any platform's terms of service."

---

## 3. Priya Ramanathan — Security Researcher

**Role:** Threat intelligence analyst at a CERT. Contributes to MITRE ATT&CK and publishes advisories.
**Technical level:** Expert. Runs her own infrastructure, writes tooling.
**Location:** Bengaluru, India

**Motivation:** Advisory authenticity. When she publishes a vulnerability disclosure, downstream consumers need to verify the advisory came from her and hasn't been tampered with. She also wants cross-platform identity for her research persona across threat intel platforms.

**Proof strategy:**
- GitHub (gist) — where she publishes PoC code
- Personal website (priya.security) — advisory hosting
- DNS — domain proof
- Mastodon (@priya@infosec.exchange) — infosec community
- Discord (server-attested) — active in security Discord communities
- Document signing — signs her advisories and STIX bundles

**Key behavior:** Will use document signing heavily once available. Wants Rekor timestamps on every signed advisory for non-repudiation. The sigchain is her audit trail — she can prove the timeline of her publications. Interested in the git commit signing bridge.

**Quote:** "If I can't prove I wrote it, someone else will claim they did."

---

## 4. Alex Novak — Digital Artist / Content Creator

**Role:** Freelance illustrator and YouTube creator. Sells prints, takes commissions.
**Technical level:** Beginner. Uses a Mac, knows what encryption is but has never used PGP.
**Location:** Portland, OR

**Motivation:** Anti-impersonation. Someone created fake accounts using his art and name on multiple platforms. He needs a canonical "this is really me" page that links all his real accounts, verifiable by anyone. He doesn't care about the cryptography — he cares about the result.

**Proof strategy:**
- Website (alexnovak.art) — portfolio and shop
- Mastodon (@alex@mastodon.art) — art community
- Hacker News — lurks, but wants the proof for credibility
- Discord (server-attested) — active in art commission servers
- Telegram (server-attested) — where clients contact him

**Key behavior:** 100% web app user. Will never touch a CLI. The passphrase-encrypted backup is essential — he'll lose the key otherwise. Wants a simple, shareable profile URL (trust0.app/alexnovak) that he can put in his bio everywhere. The vanity username is his most valued feature.

**Quote:** "I just need people to know the real me from the fakes."

---

## 5. Dr. Fatima Al-Rashidi — Academic Researcher

**Role:** Associate professor of computer science. Publishes papers, serves on program committees, reviews grants.
**Technical level:** Advanced. Writes code for research but doesn't maintain production systems.
**Location:** Zurich, Switzerland

**Motivation:** Academic identity continuity. She's changed institutions three times, each time losing her institutional email and having to re-establish her identity in the academic community. Her ORCID is persistent but not cryptographically verifiable. She wants an identity that follows her across institutions.

**Proof strategy:**
- ORCID — canonical academic identifier (when available as provider)
- Personal website (fatima-alrashidi.ch) — academic homepage
- GitHub — research code repositories
- DNS — domain proof
- GitLab — institutional GitLab instance
- Email (server-attested) — current institutional email, re-verified after each move

**Key behavior:** Interested in document signing for peer review — signing her reviews proves she actually wrote them, which matters for review credit systems. The stable identity ID is her anchor: it persists when she moves from ETH Zurich to wherever's next. Will use key rotation when she gets a new institutional laptop.

**Quote:** "My research identity shouldn't reset every time I change jobs."

---

## Persona Coverage Matrix

| Feature | Maya | Jamal | Priya | Alex | Fatima |
|---|---|---|---|---|---|
| GitHub proof | Primary | - | Primary | - | Yes |
| DNS proof | Yes | Yes | Yes | - | Yes |
| Website proof | - | Primary | Yes | Primary | Yes |
| Mastodon proof | Yes | Yes | Yes | Yes | - |
| HN proof | - | Yes | - | Yes | - |
| GitLab proof | Yes | - | - | - | Yes |
| Email attestation | - | Yes | - | - | Yes |
| Discord bot | - | - | Yes | Yes | - |
| Telegram bot | - | - | - | Yes | - |
| Document signing | - | - | Primary | - | Yes |
| Key rotation | Critical | Important | - | - | Critical |
| Vanity username | Yes | Yes | Yes | Critical | Yes |
| Sigchain history | Critical | Important | Critical | - | Important |
| Encrypted backup | Yes | Critical | Yes | Critical | Yes |
| CLI usage | Yes | Never | Yes | Never | Sometimes |
