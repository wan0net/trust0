/*
Copyright 2024 Yarmo Mackenbach

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
 * Contains various types
 * @module types
 */

import { PublicKeyType, PublicKeyEncoding, PublicKeyFetchMethod, ProxyPolicy, ClaimFormat, EntityEncodingFormat, ClaimRelation, ProofAccessRestriction, ProofFormat } from './enums'

/**
 * Service provider
 * @typedef {object} ServiceProviderObject
 * @property {ServiceProviderAbout} about - Details about the service provider
 * @property {ServiceProviderProfile} profile - What the profile would look like if a claim matches this service provider
 * @property {ServiceProviderClaim} claim - Details from the claim matching process
 * @property {ServiceProviderProof} proof - Information for the proof verification process
 */

/**
 * Details about the service provider
 * @typedef {object} ServiceProviderAbout
 * @property {string} id - Identifier of the service provider (no whitespace or symbols, lowercase)
 * @property {string} name - Full name of the service provider
 * @property {string} [homepage] - URL to the homepage of the service provider
 */

/**
 * What the profile would look like if a claim matches this service provider
 * @typedef {object} ServiceProviderProfile
 * @property {string} display - Profile name to be displayed
 * @property {string} uri - URI or URL for public access to the profile
 * @property {string} [qr] -URI or URL associated with the profile usually served as a QR code
 */

/**
 * Information about the claim matching process
 * @typedef {object} ServiceProviderClaim
 * @property {string} uriRegularExpression - Regular expression used to parse the URI
 * @property {boolean} uriIsAmbiguous - Whether this match automatically excludes other matches
 */

/**
 * Information for the proof verification process
 * @typedef {object} ServiceProviderProof
 * @property {ServiceProviderProofRequest} request - Details to request the potential proof
 * @property {ServiceProviderProofResponse} response - Details about the expected response
 * @property {Array<ProofTarget>} target - Details about the target located in the response
 */

/**
 * Details to request the potential proof
 * @typedef {object} ServiceProviderProofRequest
 * @property {string} [uri] - Location of the proof
 * @property {string} fetcher - Fetcher to be used to request the proof
 * @property {ProofAccessRestriction} accessRestriction - Type of access restriction
 * @property {object} data - Data needed by the fetcher or proxy to request the proof
 */

/**
 * Details about the expected response
 * @typedef {object} ServiceProviderProofResponse
 * @property {ProofFormat} format - Expected format of the proof
 */

/**
 * Public key for a profile
 * @typedef {object} ProfilePublicKey
 * @property {PublicKeyType} keyType - The type of cryptographic key
 * @property {PublicKeyEncoding} encoding - The encoding of the cryptographic key
 * @property {string} [fingerprint] - The fingerprint of the cryptographic key
 * @property {string} [encodedKey] - The encoded cryptographic key
 * @property {import('openpgp').PublicKey | import('jose').JWK} [key] - The raw cryptographic key as object (to be removed during toJSON())
 * @property {ProfilePublicKeyFetch} fetch - Details on how to fetch the public key
 */

/**
 * Details on how to fetch the public key
 * @typedef {object} ProfilePublicKeyFetch
 * @property {PublicKeyFetchMethod} method - The method to fetch the key
 * @property {string} [query] - The query to fetch the key
 * @property {string} [resolvedUrl] - The URL the method eventually resolved to
 */

/**
 * Config used for the claim verification
 * @typedef {object} VerificationConfig
 * @property {ProxyVerificationConfig} [proxy] - Options related to the use of proxy servers
 * @property {ClaimVerificationConfig} [claims] - Config related to the verification of supported claims
 */

/**
 * Config related to the use of proxy servers
 * @typedef {object} ProxyVerificationConfig
 * @property {string} [scheme] - The scheme to use for proxy requests
 * @property {string} [hostname] - The hostname of the proxy
 * @property {ProxyPolicy} policy - The policy that defines when to use a proxy
 */

/**
 * Config related to the verification of supported claims
 * @typedef {object} ClaimVerificationConfig
 * @property {ActivityPubClaimVerificationConfig} [activitypub] - Config related to the verification of ActivityPub claims
 * @property {IrcClaimVerificationConfig} [irc] - Config related to the verification of IRC claims
 * @property {MatrixClaimVerificationConfig} [matrix] - Config related to the verification of Matrix claims
 * @property {TelegramClaimVerificationConfig} [telegram] - Config related to the verification of Telegram claims
 * @property {XmppClaimVerificationConfig} [xmpp] - Config related to the verification of XMPP claims
 */

/**
 * Config related to the verification of ActivityPub claims
 * @typedef {object} ActivityPubClaimVerificationConfig
 * @property {string} url - The URL of the verifier account
 * @property {string} privateKey - The private key to sign the request
 */

/**
 * Config related to the verification of IRC claims
 * @typedef {object} IrcClaimVerificationConfig
 * @property {string} nick - The nick that the library uses to connect to the IRC server
 */

/**
 * Config related to the verification of Matrix claims
 * @typedef {object} MatrixClaimVerificationConfig
 * @property {string} instance - The server hostname on which the library can log in
 * @property {string} accessToken - The access token required to identify the library ({@link https://www.matrix.org/docs/guides/client-server-api|Matrix docs})
 */

/**
 * Config related to the verification of Telegram claims
 * @typedef {object} TelegramClaimVerificationConfig
 * @property {string} token - The Telegram API's token ({@link https://core.telegram.org/bots/api#authorizing-your-bot|Telegram docs})
 */

/**
 * Config related to the verification of XMPP claims
 * @typedef {object} XmppClaimVerificationConfig
 * @property {string} service - The server hostname on which the library can log in
 * @property {string} username - The username used to log in
 * @property {string} password - The password used to log in
 */

/**
 * The online verifier instance of identity profiles like Keyoxide's web interface
 * @typedef {object} ProfileVerifier
 * @property {string} name - Name of the profile verifier
 * @property {string} url - URL to the profile verifier
 */

/**
 * Parameters needed to perform the proof verification
 * @typedef {object} VerificationParams
 * @property {string} target - Proof to search
 * @property {ClaimFormat} claimFormat - Format of the claim
 * @property {EntityEncodingFormat} proofEncodingFormat - Encoding of the data containing the proof
 * @property {ClaimRelation} [claimRelation] - How to find the proof inside the JSON data
 */

/**
 * Result of the proof verification
 * @typedef {object} VerificationResult
 * @property {boolean} result - Whether the proof was found and the claim verified
 * @property {boolean} completed - Whether the verification process completed without errors
 * @property {VerificationResultProof} [proof] - Details about the proof and how it was fetched
 * @property {Array<any>} errors - Errors that ocurred during the verification process
 */

/**
 * Information about the proof in the proof verification result
 * @typedef {object} VerificationResultProof
 * @property {string} fetcher - Which fetcher was used to obtain the data containing the proof
 * @property {boolean} viaProxy - Whether a proxy was used to obtain the data containing the proof
 */

/**
 * The method to find the proof inside the response data
 * @typedef {object} ProofTarget
 * @property {ClaimFormat} format - How the response data is formatted
 * @property {EntityEncodingFormat} encoding - How the response data is encoded
 * @property {ClaimRelation} relation - How the proof is related to the response data
 * @property {Array<string>} path - Path to the proof inside the response data object
 */

export const Types = {}
