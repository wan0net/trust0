# Changelog
All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [2.1.0] - 2024-12-03
### Added
- SourceHut identity claims
- Bluesky identity claims
- pronouns.page identity claims
### Removed
- Build files from git repo

## [2.0.1] - 2024-09-01
### Fixed
- Issue where Discord claims can have a null string

## [2.0.0] - 2024-08-12
### Added
- Discord identity claims
- pronouns.cc identity claims
- Nix flake
### Changed
- Switched from yarn to npm

## [1.2.9] - 2024-02-01
### Added
- ORCiD identity claims
### Changed
- Improved code documentation
- Optimized creation of Regexp instances
### Fixed
- Bad promise timeout logic
- Dependencies cleaned up

## [1.2.8] - 2024-01-23
### Added
- OpenPGP and ASP claims

## [1.2.7] - 2023-10-09
### Fixed
- Fix regex errors

## [1.2.6] - 2023-10-09
### Added
- JSON schemas for common objects
### Changed
- Additional Github proof location (proof.md)
### Fixed
- IRC compatibility with ASP profiles
- IRC profile display value
- Lobste.rs profile URL value

## [1.2.5] - 2023-10-05
### Added
- Support for theme color

## [1.2.4] - 2023-10-04
### Changed
- Claim display information

## [1.2.3] - 2023-10-03
### Fixed
- Claim ambiguity logic

## [1.2.2] - 2023-10-03
### Fixed
- Service provider information for Lichess and Keybase
- Display data logic in claim toJSON

## [1.2.1] - 2023-09-23
Bump necessary due to tag-related glitch in git forge

## [1.2.0] - 2023-09-23
### Added
- Allow service providers to validate the claim verification result (useful for forks)
- Support for Forgejo claims

## [1.1.1] - 2023-09-22
### Fixed
- Normalize case before hashed proof verification

## [1.1.0] - 2023-09-21
### Changed
- Unify fromJSON() for Profile, Persona and Claim classes

## [1.0.4] - 2023-09-19
### Fixed
- Allow the activitypub Person request to fail

## [1.0.3] - 2023-09-19
### Fixed
- Avoid using potentially missing URL for ActivityPub postprocessing

## [1.0.2] - 2023-09-19
### Fixed
- Make nodeinfo requests use HTTPS

## [1.0.1] - 2023-09-18
### Fixed
- Ignore OpenPGP users without userId
- OpenCollective GraphQL queries
- Improve ActivityPub post proofs support

## [1.0.0] - 2023-07-13
### Changed
- Moved from CommonJS to ESM
- All profiles now use the Profile class
- Functions that used to return OpenPGP keys now return Profile objects
- Compliance with https://spec.keyoxide.org/spec/2/

## [0.19.0] - 2023-07-04
### Added
- Support for ASPE protocol
### Changed
- Made HTTP scheme for proxy calls configurable
- Replaced standard with eslint
### Fixed
- Sort OpenPGP certifications by chronological order
- Allowing white space in fingerprint
- Use correct format for displaying ActivityPub claims
- Missing JSDOC types
- JS bundling

## [0.18.3] - 2023-03-27
### Added
- OpenCollective claim verification
- Keybase claim verification
- GraphQL fetcher protocol
- HTML entity decoding in proofs
### Changed
- Replace devto with forem
### Fixed
- forem service provider ambiguity

## [0.18.2] - 2023-03-08
### Changed
- Use oembed for Twitter verification
### Removed
- query-string dependency
### Fixed
- Matrix URI format

## [0.18.1] - 2022-12-12
### Changed
- Improved XMPP proof requests
### Fixed
- Added missing user-agent headers
### Removed
- jsdom dependency

## [0.18.0] - 2022-11-17
### Changed
- Allow ActivityPub verification through posts
- Improve type consistency
### Removed
- Proxy server code

## [0.17.5] - 2022-11-14
### Fixed
- Implementation of postprocess function

## [0.17.3] - 2022-11-14
### Changed
- Add fetcher to lib exports

## [0.17.2] - 2022-10-27
### Fixed
- Proxy verification options

## [0.17.1] - 2022-10-25
### Fixed
- ActivityPub definition
- Claim verification logic

## [0.17.0] - 2022-10-24
### Added
- ActivityPub claim verification

## [0.16.4] - 2022-10-07
### Fixed
- superuser.com not being detected

## [0.16.3] - 2022-09-30
### Changed
- Updated dependencies

## [0.16.2] - 2022-09-21
### Added
- Support for hashed proofs

## [0.16.1] - 2022-09-10
### Changed
- Updated dependencies
### Fixed
- Telegram route input validation
- Use fetch instead of axios for HTTP proofs

## [0.16.0] - 2022-09-10
### Added
- StackExchange claim verification
- Telegram claim verification (thanks [Goldstein](https://codeberg.org/Goldstein)!)
- HTTP proof support
### Fixed
- Fix XMPP fetcher logic
### Removed
- Message proof format

## [0.15.7] - 2022-08-04
### Changed
- Gitlab claims now use HTTP fetcher (thanks [hosaka](https://codeberg.org/hosaka)!)
### Removed
- Obsolete Gitlab proof fetcher
### Fixed
- Support another XMPP vCard syntax

## [0.15.6] - 2022-03-27
### Added
- doip.keys.fetch function (with tests)

## [0.15.5] - 2022-03-25
### Fixed
- Signature profile verification

## [0.15.4] - 2022-03-25
### Fixed
- UserIDs in signature profile processing were undefined

## [0.15.3] - 2022-03-22
### Updated
- Bump dependencies

## [0.15.2] - 2022-02-25
### Fixed
- OpenPGP 5 migration issue

## [0.15.1] - 2022-02-25
### Fixed
- CI/CD issues

## [0.15.0] - 2022-02-25
### Added
- Examples
- Browser entrypoint to package.json
### Changed
- Update openpgp.js to 5.*

## [0.14.0] - 2021-11-06
### Added
- Support for ariadne.id notation proofs

## [0.13.0] - 2021-07-26
### Added
- Lichess.org claim verification

## [0.12.9] - 2021-06-03
### Fixed
- Typo during claim generation
- Handle claims without matches

## [0.12.8] - 2021-06-03
### Fixed
- Expose key revocation status

## [0.12.7] - 2021-06-03
### Fixed
- IRC nickname regex

## [0.12.6] - 2021-05-23
### Fixed
- DNS fetcher not running

## [0.12.5] - 2021-05-21
### Fixed
- Keybase key fetching
- Fix IRC NickServ command syntax

## [0.12.4] - 2021-04-30
### Fixed
- Headings in CHANGELOG.md
- References to wrong variable

## [0.12.3] - 2021-04-30
### Fixed
- Ensure an output for the Claim's verification process
- Adaptive proxy policy now uses the fallback fetcher for generic access proofs 
- Refactor bad property names

## [0.12.2] - 2021-04-30
### Fixed
- Fix Claim constructor handling of object data
- Refactor bad property names

## [0.12.1] - 2021-04-26
### Fixed
- Bad interpretation of proxy policy
- Proxy URL protocol

## [0.12.0] - 2021-04-22
### Added
- Proxy server functionality
- JSDoc-based documentation
- Claim class
### Changed
- Improved data fetching logic
### Fixed
- Bug causing false positive verification

## [0.11.2] - 2021-03-06
### Fixed
- Matrix.to URLs

## [0.11.1] - 2021-03-06
### Fixed
- Proxy URL encoding

## [0.11.0] - 2021-03-05
### Added
- IRC service provider
- Matrix service provider
### Fixed
- Handling of requests without URI

## [0.10.5] - 2021-03-02
### Fixed
- Logic error

## [0.10.4] - 2021-03-02
### Changed
- Add Twitter proxy verification

## [0.10.3] - 2021-03-02
### Changed
- Remove twitter dependency

## [0.10.2] - 2021-03-01
### Changed
- Make Twitter verification configurable

## [0.10.1] - 2021-01-26
### Fixed
- Polyfill for promise.allSettled

## [0.10.0] - 2021-01-13
### Added
- Owncast service provider

## [0.9.4] - 2021-01-10
### Fixed
- Fix typo in keyserver url

## [0.9.3] - 2021-01-10
### Fixed
- Fix regex skipping some claims

## [0.9.2] - 2021-01-09
### Fixed
- Network errors blocking code execution

## [0.9.1] - 2021-01-09
### Changed
- Use signature data to find key location

## [0.9.0] - 2021-01-07
### Added
- Signature claims verification

## [0.8.5] - 2021-01-03
### Fixed
- Remove trailing slash from HKP server URL

## [0.8.4] - 2021-01-02
### Fixed
- Fetch Twitter proofs from Nitter

## [0.8.3] - 2020-12-26
### Fixed
- Handling of users without userId

## [0.8.2] - 2020-12-26
### Fixed
- Handling of users without selfCertifications

## [0.8.1] - 2020-12-20
### Fixed
- Timeout for claim verification promises

## [0.8.0] - 2020-12-11
### Added
- Add fallback proxy policy

### Fixed
- Handling of failed network requests
- Handling of rejected promises
- DNS proxy URL generation
- Twitter & Dev.to service provider

## [0.7.5] - 2020-12-08
### Fixed
- Browser bundling

## [0.7.4] - 2020-12-08
### Fixed
- Handling HKP URI

## [0.7.3] - 2020-12-08
### Fixed
- Bundled library for release

## [0.7.2] - 2020-12-08
### Fixed
- Support for specifying keyservers

## [0.7.1] - 2020-12-08
### Changed
- Update openpgpjs dependency

## [0.7.0] - 2020-12-05
### Changed
- Properly reject promises

## [0.6.0] - 2020-11-20
### Changed
- Handle multiple users in key

## [0.5.2] - 2020-11-20
### Fixed
- Claim verification regex

## [0.5.1] - 2020-11-20
### Fixed
- Link to bundled openpgp

## [0.5.0] - 2020-11-18
### Added
- Keys fetching using openpgp.js
- Claims extraction from keys using openpgp.js

### Changed
- Support xmpp via doip-proxy
- Module structure
- Docs

### Fixed
- Bad verification value return for text proofs
- Missing User-Agent request header

## [0.4.2] - 2020-11-06
### Changed
- URLs in package.json

## [0.4.1] - 2020-11-06
### Changed
- Update README
- Add image to coverpage

## [0.4.0] - 2020-11-06
### Added
- Custom request handler for DNS service provider
- Docs

### Changed
- Service provider data structure
- More consistent handling of options

### Removed
- dotenv dependency

### Fixed
- Crash for unexpected JSON data structure
- Body in http requests

## [0.3.0] - 2020-11-04
### Added
- Liberapay service provider
- Proxy request handler

### Changed
- Improve handling of arrays in JSON
- Customizable proxy hostname

### Fixed
- Dots in URL regex

## [0.2.0] - 2020-11-03
Initial release
