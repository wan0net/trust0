/*
Copyright 2023 Yarmo Mackenbach

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
import { PublicKeyFetchMethod, PublicKeyEncoding, PublicKeyType, ProfileType } from './enums.js'
import { Persona } from './persona.js'

/**
 * @class
 * @classdesc A profile of personas with identity claims
 * @param {Array<Persona>} personas - Personas of the profile
 * @example
 * const claim = Claim('https://alice.tld', '123');
 * const pers = Persona('Alice', 'About Alice', [claim]);
 * const profile = Profile([pers]);
 */
export class Profile {
  /**
   * Create a new profile
   * @function
   * @param {ProfileType} profileType - Type of profile (ASP, OpenPGP, etc.)
   * @param {string} identifier - Profile identifier (fingerprint, URI, etc.)
   * @param {Array<Persona>} personas - Personas of the profile
   * @public
   */
  constructor (profileType, identifier, personas) {
    this.profileVersion = 2
    /**
     * Profile version
     * @type {ProfileType}
     * @public
     */
    this.profileType = profileType
    /**
     * Identifier of the profile (fingerprint, email address, uri...)
     * @type {string}
     * @public
     */
    this.identifier = identifier
    /**
     * List of personas
     * @type {Array<Persona>}
     * @public
     */
    this.personas = personas || []
    /**
     * Index of primary persona (to be displayed first or prominently)
     * @type {number}
     * @public
     */
    this.primaryPersonaIndex = personas.length > 0 ? 0 : -1
    /**
     * The cryptographic key associated with the profile
     * @type {import('./types').ProfilePublicKey}
     * @public
     */
    this.publicKey = {
      keyType: PublicKeyType.NONE,
      fingerprint: null,
      encoding: PublicKeyEncoding.NONE,
      encodedKey: null,
      key: null,
      fetch: {
        method: PublicKeyFetchMethod.NONE,
        query: null,
        resolvedUrl: null
      }
    }
    /**
     * List of verifier URLs
     * @type {Array<import('./types').ProfileVerifier>}
     * @public
     */
    this.verifiers = []
  }

  /**
   * Parse a JSON object and convert it into a profile
   * @function
   * @param {object} profileObject - JSON representation of a profile
   * @returns {Profile | Error} Parsed profile
   * @example
   * doip.Profile.fromJSON(JSON.stringify(profile));
   */
  static fromJSON (profileObject) {
    /** @type {Profile} */
    let profile
    let result

    if (typeof profileObject === 'object' && 'profileVersion' in profileObject) {
      switch (profileObject.profileVersion) {
        case 2:
          result = importJsonProfileVersion2(profileObject)
          if (result instanceof Error) {
            throw result
          }
          profile = result
          break

        default:
          throw new Error('Invalid profile version')
      }
    }

    return profile
  }

  /**
   * Add profile verifier to the profile
   * @function
   * @param {string} name - Name of the verifier
   * @param {string} url - URL of the verifier
   */
  addVerifier (name, url) {
    this.verifiers.push({ name, url })
  }

  /**
   * Get a JSON representation of the profile
   * @function
   * @returns {object} JSON representation of the profile
   */
  toJSON () {
    return {
      profileVersion: this.profileVersion,
      profileType: this.profileType,
      identifier: this.identifier,
      personas: this.personas.map(x => x.toJSON()),
      primaryPersonaIndex: this.primaryPersonaIndex,
      publicKey: {
        keyType: this.publicKey.keyType,
        fingerprint: this.publicKey.fingerprint,
        encoding: this.publicKey.encoding,
        encodedKey: this.publicKey.encodedKey,
        fetch: {
          method: this.publicKey.fetch.method,
          query: this.publicKey.fetch.query,
          resolvedUrl: this.publicKey.fetch.resolvedUrl
        }
      },
      verifiers: this.verifiers
    }
  }
}

/**
 * @ignore
 * @param {object} profileObject - JSON representation of the profile
 * @returns {Profile | Error} Parsed profile
 */
function importJsonProfileVersion2 (profileObject) {
  if (!('profileVersion' in profileObject && profileObject.profileVersion === 2)) {
    return new Error('Invalid profile')
  }

  const personas = profileObject.personas.map(x => Persona.fromJSON(x, 2))

  const profile = new Profile(profileObject.profileType, profileObject.identifier, personas)

  profile.primaryPersonaIndex = profileObject.primaryPersonaIndex
  profile.publicKey = profileObject.publicKey
  profile.verifiers = profileObject.verifiers

  return profile
}
