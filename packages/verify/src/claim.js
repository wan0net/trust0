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
import isAlphanumeric from 'validator/lib/isAlphanumeric.js'
import { isUri } from 'valid-url'
import mergeOptions from 'merge-options'
import { fetch } from './proofs.js'
import { run } from './verifications.js'
import { list, data as _data } from './serviceProviders/index.js'
import { opts as _opts } from './defaults.js'
import { ClaimStatus } from './enums.js'
import { ServiceProvider } from './serviceProvider.js'

/**
 * @class
 * @classdesc Identity claim
 * @property {string} uri             - The claim's URI
 * @property {string} fingerprint     - The fingerprint to verify the claim against
 * @property {number} status          - The current status code of the claim
 * @property {Array<object>} matches  - The claim definitions matched against the URI
 * @example
 * const claim = doip.Claim();
 * const claim = doip.Claim('dns:domain.tld?type=TXT');
 * const claim = doip.Claim('dns:domain.tld?type=TXT', '123abc123abc');
 */
export class Claim {
  /**
   * Initialize a Claim object
   * @param {string} [uri]          - The URI of the identity claim
   * @param {string} [fingerprint]  - The fingerprint of the OpenPGP key
   */
  constructor (uri, fingerprint) {
    // Verify validity of URI
    if (uri && !isUri(uri)) {
      throw new Error('Invalid URI')
    }

    // Verify validity of fingerprint
    if (fingerprint) {
      try {
        // @ts-ignore
        isAlphanumeric.default(fingerprint)
      } catch (err) {
        throw new Error('Invalid fingerprint')
      }
    }

    /**
     * @type {string}
     */
    this._uri = uri || ''
    /**
     * @type {string}
     */
    this._fingerprint = fingerprint || ''
    /**
     * @type {number}
     */
    this._status = ClaimStatus.INIT
    /**
     * @type {Array<ServiceProvider>}
     */
    this._matches = []
  }

  /**
   * @function
   * @param {*} claimObject - JSON representation of a claim
   * @returns {Claim} Parsed claim
   * @throws Will throw an error if the JSON object can't be coerced into a Claim
   * @example
   * doip.Claim.fromJSON(JSON.stringify(claim));
   */
  static fromJSON (claimObject) {
    /** @type {Claim} */
    let claim
    let result

    if (typeof claimObject === 'object' && 'claimVersion' in claimObject) {
      switch (claimObject.claimVersion) {
        case 1:
          result = importJsonClaimVersion1(claimObject)
          if (result instanceof Error) {
            throw result
          }
          claim = result
          break

        case 2:
          result = importJsonClaimVersion2(claimObject)
          if (result instanceof Error) {
            throw result
          }
          claim = result
          break

        default:
          throw new Error('Invalid claim version')
      }
    }

    return claim
  }

  get uri () {
    return this._uri
  }

  get fingerprint () {
    return this._fingerprint
  }

  get status () {
    return this._status
  }

  get matches () {
    if (this._status === ClaimStatus.INIT) {
      throw new Error('This claim has not yet been matched')
    }
    return this._matches
  }

  set uri (uri) {
    if (this._status !== ClaimStatus.INIT) {
      throw new Error(
        'Cannot change the URI, this claim has already been matched'
      )
    }
    // Verify validity of URI
    if (uri.length > 0 && !isUri(uri)) {
      throw new Error('The URI was invalid')
    }
    // Remove leading and trailing spaces
    uri = uri.replace(/^\s+|\s+$/g, '')

    this._uri = uri
  }

  set fingerprint (fingerprint) {
    if (this._status === ClaimStatus.VERIFIED) {
      throw new Error(
        'Cannot change the fingerprint, this claim has already been verified'
      )
    }
    this._fingerprint = fingerprint
  }

  set status (anything) {
    throw new Error("Cannot change a claim's status")
  }

  set matches (anything) {
    throw new Error("Cannot change a claim's matches")
  }

  /**
   * Match the claim's URI to candidate definitions
   * @function
   */
  match () {
    if (this._status !== ClaimStatus.INIT) {
      throw new Error('This claim was already matched')
    }
    if (this._uri.length === 0 || !isUri(this._uri)) {
      throw new Error('This claim has no URI')
    }

    this._matches = []

    list.every((name, i) => {
      const def = _data[name]

      // If the candidate is invalid, continue matching
      if (!def.reURI.test(this._uri)) {
        return true
      }

      const candidate = def.processURI(this._uri)
      // If the candidate could not be processed, continue matching
      if (!candidate) {
        return true
      }

      if (candidate.claim.uriIsAmbiguous) {
        // Add to the possible candidates
        this._matches.push(candidate)
      } else {
        // Set a single candidate and stop
        this._matches = [candidate]
        return false
      }

      // Continue matching
      return true
    })

    this._status = this._matches.length === 0 ? ClaimStatus.NO_MATCHES : ClaimStatus.MATCHED
  }

  /**
   * Verify the claim. The proof for each candidate is sequentially fetched and
   * checked for the fingerprint. The verification stops when either a positive
   * result was obtained, or an unambiguous claim definition was processed
   * regardless of the result.
   * @function
   * @param {import('./types').VerificationConfig} [opts] - Options for proxy, fetchers
   */
  async verify (opts) {
    if (this._status === ClaimStatus.INIT) {
      throw new Error('This claim has not yet been matched')
    }
    if (this._status >= 200) {
      throw new Error('This claim has already been verified')
    }
    if (this._fingerprint.length === 0) {
      throw new Error('This claim has no fingerprint')
    }

    // Handle options
    opts = mergeOptions(_opts, opts || {})

    // If there are no matches
    if (this._matches.length === 0) {
      this.status = ClaimStatus.NO_MATCHES
    }

    // For each match
    for (let index = 0; index < this._matches.length; index++) {
      // Continue if a result was already obtained
      if (this._status >= 200) { continue }

      let claimData = this._matches[index]

      /** @type {import('./types').VerificationResult | null} */
      let verificationResult = null
      let proofData = null
      let proofFetchError

      try {
        proofData = await fetch(claimData, opts)
      } catch (err) {
        proofFetchError = err
      }

      if (proofData) {
        // Run the verification process
        verificationResult = await run(
          proofData.result,
          claimData,
          this._fingerprint
        )
        verificationResult.proof = {
          fetcher: proofData.fetcher,
          viaProxy: proofData.viaProxy
        }

        // Validate the result
        const def = _data[claimData.about.id]
        if (def.functions?.validate && verificationResult.completed && verificationResult.result) {
          try {
            (verificationResult.result = await def.functions.validate(claimData, proofData, verificationResult, opts))
          } catch (_) {}
        }

        // Post process the data
        if (def.functions?.postprocess) {
          try {
            ({ claimData, proofData } = await def.functions.postprocess(claimData, proofData, opts))
          } catch (_) {}
        }
      } else {
        // Consider the proof completed but with a negative result
        verificationResult = verificationResult || {
          result: false,
          completed: true,
          proof: null,
          errors: [proofFetchError]
        }
      }

      if (this.isAmbiguous() && !verificationResult.result) {
        // Assume a wrong match and continue
        continue
      }

      if (verificationResult.result) {
        this._status = verificationResult.proof.viaProxy ? ClaimStatus.VERIFIED_VIA_PROXY : ClaimStatus.VERIFIED
        this._matches = [claimData]
      }
    }

    this._status = this._status >= 200 ? this._status : ClaimStatus.NO_PROOF_FOUND
  }

  /**
   * Determine the ambiguity of the claim. A claim is only unambiguous if any
   * of the candidates is unambiguous. An ambiguous claim should never be
   * displayed in an user interface when its result is negative.
   * @function
   * @returns {boolean} Whether the claim is ambiguous
   */
  isAmbiguous () {
    if (this._status < ClaimStatus.MATCHED) {
      throw new Error('The claim has not been matched yet')
    }
    if (this._matches.length === 0) {
      throw new Error('The claim has no matches')
    }
    if (this._status >= 200 && this._status < 300) return false
    return this._matches.length > 1 || this._matches[0].claim.uriIsAmbiguous
  }

  /**
   * Get a JSON representation of the Claim object. Useful when transferring
   * data between instances/machines.
   * @function
   * @returns {object} JSON reprentation of the claim
   */
  toJSON () {
    let displayProfileName = this._uri
    let displayProfileUrl = null
    let displayProofUrl = null
    let displayServiceProviderName = null
    let displayServiceProviderId = null

    if (this._status >= ClaimStatus.MATCHED && this._matches.length > 0 && !this.isAmbiguous()) {
      displayProfileName = this._matches[0].profile.display
      displayProfileUrl = this._matches[0].profile.uri
      displayProofUrl = this._matches[0].proof.request.uri
      displayServiceProviderName = this._matches[0].about.name
      displayServiceProviderId = this._matches[0].about.id
    }

    return {
      claimVersion: 2,
      uri: this._uri,
      proofs: [this._fingerprint],
      matches: this._matches.map(x => x.toJSON()),
      status: this._status,
      display: {
        profileName: displayProfileName,
        profileUrl: displayProfileUrl,
        proofUrl: displayProofUrl,
        serviceProviderName: displayServiceProviderName,
        serviceProviderId: displayServiceProviderId
      }
    }
  }
}

/**
 * @ignore
 * @param {object} claimObject - JSON representation of a claim
 * @returns {Claim | Error} Parsed claim
 */
function importJsonClaimVersion1 (claimObject) {
  if (!('claimVersion' in claimObject && claimObject.claimVersion === 1)) {
    return new Error('Invalid claim')
  }

  const claim = new Claim()

  claim._uri = claimObject.uri
  claim._fingerprint = claimObject.fingerprint
  claim._matches = claimObject.matches.map(x => new ServiceProvider(x))

  if (claimObject.status === 'init') {
    claim._status = 100
  }
  if (claimObject.status === 'matched') {
    if (claimObject.matches.length === 0) {
      claim._status = 301
    }
    claim._status = 101
  }

  if (!('result' in claimObject.verification && 'errors' in claimObject.verification)) {
    claim._status = 400
  }
  if (claimObject.verification.errors.length > 0) {
    claim._status = 400
  }
  if (claimObject.verification.result && claimObject.verification.proof.viaProxy) {
    claim._status = 201
  }
  if (claimObject.verification.result && !claimObject.verification.proof.viaProxy) {
    claim._status = 200
  }

  return claim
}

/**
 * @ignore
 * @param {object} claimObject - JSON representation of a claim
 * @returns {Claim | Error} Parsed claim
 */
function importJsonClaimVersion2 (claimObject) {
  if (!('claimVersion' in claimObject && claimObject.claimVersion === 2)) {
    return new Error('Invalid claim')
  }

  const claim = new Claim()

  claim._uri = claimObject.uri
  claim._fingerprint = claimObject.proofs[0]
  claim._matches = claimObject.matches.map(x => new ServiceProvider(x))
  claim._status = claimObject.status

  return claim
}
