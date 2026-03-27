/*
Copyright 2021 Yarmo Mackenbach

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
*/
/**
 * Contains enums
 * @module enums
 */

/**
 * The proxy policy that decides how to fetch a proof
 * @readonly
 * @enum {string}
 */
export const ProxyPolicy = {
  /** Proxy usage decision depends on environment and service provider */
  ADAPTIVE: 'adaptive',
  /** Always use a proxy */
  ALWAYS: 'always',
  /** Never use a proxy, skip a verification if a proxy is inevitable */
  NEVER: 'never'
}

/**
 * Methods for fetching proofs
 * @readonly
 * @enum {string}
 */
export const Fetcher = {
  /** HTTP requests to ActivityPub */
  ACTIVITYPUB: 'activitypub',
  /** ASPE HTTP requests */
  ASPE: 'aspe',
  /** DNS module from Node.js */
  DNS: 'dns',
  /** GraphQL over HTTP requests */
  GRAPHQL: 'graphql',
  /** Basic HTTP requests */
  HTTP: 'http',
  /** IRC module from Node.js */
  IRC: 'irc',
  /** HTTP request to Matrix API */
  MATRIX: 'matrix',
  /** HKP and WKS request for OpenPGP */
  OPENPGP: 'openpgp',
  /** HTTP request to Telegram API */
  TELEGRAM: 'telegram',
  /** XMPP module from Node.js */
  XMPP: 'xmpp'
}

/**
 * Entity encoding format
 * @readonly
 * @enum {string}
 */
export const EntityEncodingFormat = {
  /** No special formatting */
  PLAIN: 'plain',
  /** HTML encoded entities */
  HTML: 'html',
  /** XML encoded entities */
  XML: 'xml'
}

/**
 * Levels of access restriction for proof fetching
 * @readonly
 * @enum {string}
 */
export const ProofAccessRestriction = {
  /** Any HTTP request will work */
  NONE: 'none',
  /** CORS requests are denied */
  NOCORS: 'nocors',
  /** HTTP requests must contain API or access tokens */
  GRANTED: 'granted',
  /** Not accessible by HTTP request, needs server software */
  SERVER: 'server'
}

/**
 * Format of proof
 * @readonly
 * @enum {string}
 */
export const ProofFormat = {
  /** JSON format */
  JSON: 'json',
  /** Plaintext format */
  TEXT: 'text'
}

/**
 * Format of claim
 * @readonly
 * @enum {string}
 */
export const ClaimFormat = {
  /** `openpgp4fpr:123123123` */
  URI: 'uri',
  /** `123123123` */
  FINGERPRINT: 'fingerprint'
}

/**
 * How to find the proof inside the fetched data
 * @readonly
 * @enum {string}
 */
export const ClaimRelation = {
  /** Claim is somewhere in the JSON field's textual content */
  CONTAINS: 'contains',
  /** Claim is equal to the JSON field's textual content */
  EQUALS: 'equals',
  /** Claim is equal to an element of the JSON field's array of strings */
  ONEOF: 'oneof'
}

/**
 * Status of the Claim instance
 * @readonly
 * @enum {number}
 */
export const ClaimStatus = {
  /** Claim has been initialized */
  INIT: 100,
  /** Claim has matched its URI to candidate claim definitions */
  MATCHED: 101,
  /** Claim was successfully verified */
  VERIFIED: 200,
  /** Claim was successfully verified using proxied data */
  VERIFIED_VIA_PROXY: 201,
  /** Unknown matching error */
  MATCHING_ERROR: 300,
  /** No matched service providers */
  NO_MATCHES: 301,
  /** Unknown matching error */
  VERIFICATION_ERROR: 400,
  /** No proof found in data returned by service providers */
  NO_PROOF_FOUND: 401
}

/**
 * Profile type
 * @readonly
 * @enum {string}
 */
export const ProfileType = {
  /** ASP profile */
  ASP: 'asp',
  /** OpenPGP profile */
  OPENPGP: 'openpgp'
}

/**
 * Public key type
 * @readonly
 * @enum {string}
 */
export const PublicKeyType = {
  EDDSA: 'eddsa',
  ES256: 'es256',
  OPENPGP: 'openpgp',
  UNKNOWN: 'unknown',
  NONE: 'none'
}

/**
 * Public key format
 * @readonly
 * @enum {string}
 */
export const PublicKeyEncoding = {
  PEM: 'pem',
  JWK: 'jwk',
  ARMORED_PGP: 'armored_pgp',
  NONE: 'none'
}

/**
 * Method to fetch the public key
 * @readonly
 * @enum {string}
 */
export const PublicKeyFetchMethod = {
  ASPE: 'aspe',
  HKP: 'hkp',
  WKD: 'wkd',
  HTTP: 'http',
  NONE: 'none'
}

/**
 * Protocol to query OpenPGP public keys
 * @readonly
 * @enum {string}
 */
export const OpenPgpQueryProtocol = {
  HKP: 'hkp',
  WKD: 'wkd'
}
