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
import axios from 'axios'
import { isUri } from 'valid-url'
import { readKey, PublicKey } from 'openpgp'
import HKP from '@openpgp/hkp-client'
import WKD from '@openpgp/wkd-client'
import { Claim } from './claim.js'
import { ProfileType, PublicKeyEncoding, PublicKeyFetchMethod, PublicKeyType } from './enums.js'
import { Profile } from './profile.js'
import { Persona } from './persona.js'

/**
 * Functions related to OpenPGP Profiles
 * @module openpgp
 */

/**
 * Fetch a public key using keyservers
 * @function
 * @param {string} identifier - Fingerprint or email address
 * @param {string} [keyserverDomain] - Domain of the keyserver
 * @returns {Promise<Profile>} The profile from the fetched OpenPGP key
 * @example
 * const key1 = doip.keys.fetchHKP('alice@domain.tld');
 * const key2 = doip.keys.fetchHKP('123abc123abc');
 * const key3 = doip.keys.fetchHKP('123abc123abc', 'pgpkeys.eu');
 */
export async function fetchHKP (identifier, keyserverDomain = 'keys.openpgp.org') {
  const keyserverBaseUrl = `https://${keyserverDomain ?? 'keys.openpgp.org'}`

  const hkp = new HKP(keyserverBaseUrl)
  const lookupOpts = {
    query: identifier
  }

  const publicKeyArmored = await hkp
    .lookup(lookupOpts)
    .catch((error) => {
      throw new Error(`Key does not exist or could not be fetched (${error})`)
    })

  if (!publicKeyArmored) {
    throw new Error('Key does not exist or could not be fetched')
  }

  const publicKey = await readKey({
    armoredKey: publicKeyArmored
  })
    .catch((error) => {
      throw new Error(`Key could not be read (${error})`)
    })

  const profile = await parsePublicKey(publicKey)
  profile.publicKey.fetch.method = PublicKeyFetchMethod.HKP
  profile.publicKey.fetch.query = identifier

  return profile
}

/**
 * Fetch a public key using Web Key Directory
 * @function
 * @param {string} identifier - Identifier of format 'username@domain.tld`
 * @returns {Promise<Profile>} The profile from the fetched OpenPGP key
 * @example
 * const key = doip.keys.fetchWKD('alice@domain.tld');
 */
export async function fetchWKD (identifier) {
  const wkd = new WKD()
  const lookupOpts = {
    email: identifier
  }

  const publicKeyBinary = await wkd
    .lookup(lookupOpts)
    .catch((/** @type {Error} */ error) => {
      throw new Error(`Key does not exist or could not be fetched (${error})`)
    })

  if (!publicKeyBinary) {
    throw new Error('Key does not exist or could not be fetched')
  }

  const publicKey = await readKey({
    binaryKey: publicKeyBinary
  })
    .catch((error) => {
      throw new Error(`Key could not be read (${error})`)
    })

  const profile = await parsePublicKey(publicKey)
  profile.publicKey.fetch.method = PublicKeyFetchMethod.WKD
  profile.publicKey.fetch.query = identifier

  return profile
}

/**
 * Fetch a public key from Keybase
 * @function
 * @param {string} username - Keybase username
 * @param {string} fingerprint - Fingerprint of key
 * @returns {Promise<Profile>} The profile from the fetched OpenPGP key
 * @example
 * const key = doip.keys.fetchKeybase('alice', '123abc123abc');
 */
export async function fetchKeybase (username, fingerprint) {
  const keyLink = `https://keybase.io/${username}/pgp_keys.asc?fingerprint=${fingerprint}`
  let rawKeyContent
  try {
    rawKeyContent = await axios.get(
      keyLink,
      {
        responseType: 'text'
      }
    )
      .then((/** @type {import('axios').AxiosResponse} */ response) => {
        if (response.status === 200) {
          return response
        }
      })
      .then((/** @type {import('axios').AxiosResponse} */ response) => response.data)
  } catch (e) {
    throw new Error(`Error fetching Keybase key: ${e.message}`)
  }

  const publicKey = await readKey({
    armoredKey: rawKeyContent
  })
    .catch((error) => {
      throw new Error(`Key does not exist or could not be fetched (${error})`)
    })

  const profile = await parsePublicKey(publicKey)
  profile.publicKey.fetch.method = PublicKeyFetchMethod.HTTP
  profile.publicKey.fetch.query = null
  profile.publicKey.fetch.resolvedUrl = keyLink

  return profile
}

/**
 * Get a public key from armored public key text data
 * @function
 * @param {string} rawKeyContent - Plaintext ASCII-formatted public key data
 * @returns {Promise<Profile>} The profile from the armored public key
 * @example
 * const plainkey = `-----BEGIN PGP PUBLIC KEY BLOCK-----
 *
 * mQINBF0mIsIBEADacleiyiV+z6FIunvLWrO6ZETxGNVpqM+WbBQKdW1BVrJBBolg
 * [...]
 * =6lib
 * -----END PGP PUBLIC KEY BLOCK-----`
 * const key = doip.keys.fetchPlaintext(plainkey);
 */
export async function fetchPlaintext (rawKeyContent) {
  const publicKey = await readKey({
    armoredKey: rawKeyContent
  })
    .catch((error) => {
      throw new Error(`Key could not be read (${error})`)
    })

  const profile = await parsePublicKey(publicKey)

  return profile
}

/**
 * Fetch a public key using an URI
 * @function
 * @param {string} uri - URI that defines the location of the key
 * @returns {Promise<Profile>} The profile from the fetched OpenPGP key
 * @example
 * const key1 = doip.keys.fetchURI('hkp:alice@domain.tld');
 * const key2 = doip.keys.fetchURI('hkp:123abc123abc');
 * const key3 = doip.keys.fetchURI('wkd:alice@domain.tld');
 */
export async function fetchURI (uri) {
  if (!isUri(uri)) {
    throw new Error('Invalid URI')
  }

  const re = /([a-zA-Z0-9]*):([a-zA-Z0-9@._=+-]*)(?::([a-zA-Z0-9@._=+-]*))?/
  const match = uri.match(re)

  if (!match[1]) {
    throw new Error('Invalid URI')
  }

  switch (match[1]) {
    case 'hkp':
      return await fetchHKP(
        match[3] ? match[3] : match[2],
        match[3] ? match[2] : null
      )

    case 'wkd':
      return await fetchWKD(match[2])

    case 'kb':
      return await fetchKeybase(match[2], match.length >= 4 ? match[3] : null)

    default:
      throw new Error('Invalid URI protocol')
  }
}

/**
 * Fetch a public key
 *
 * This function will attempt to detect the identifier and fetch the key
 * accordingly. If the identifier is an email address, it will first try and
 * fetch the key using WKD and then HKP. Otherwise, it will try HKP only.
 *
 * This function will also try and parse the input as a plaintext key
 * @function
 * @param {string} identifier - URI that defines the location of the key
 * @returns {Promise<Profile>} The profile from the fetched OpenPGP key
 * @example
 * const key1 = doip.keys.fetch('alice@domain.tld');
 * const key2 = doip.keys.fetch('123abc123abc');
 */
export async function fetch (identifier) {
  const re = /([a-zA-Z0-9@._=+-]*)(?::([a-zA-Z0-9@._=+-]*))?/
  const match = identifier.match(re)

  let profile = null

  // Attempt plaintext
  try {
    profile = await fetchPlaintext(identifier)
  } catch (e) {}

  // Attempt WKD
  if (!profile && identifier.includes('@')) {
    try {
      profile = await fetchWKD(match[1])
    } catch (e) {}
  }

  // Attempt HKP
  if (!profile) {
    profile = await fetchHKP(
      match[2] ? match[2] : match[1],
      match[2] ? match[1] : null
    )
  }

  if (!profile) {
    throw new Error('Key does not exist or could not be fetched')
  }

  return profile
}

/**
 * Process a public key to get a profile
 * @function
 * @param {PublicKey} publicKey - The public key to parse
 * @returns {Promise<Profile>} The profile from the processed OpenPGP key
 * @example
 * const key = doip.keys.fetchURI('hkp:alice@domain.tld');
 * const profile = doip.keys.parsePublicKey(key);
 * profile.personas[0].claims.forEach(claim => {
 *   console.log(claim.uri);
 * });
 */
export async function parsePublicKey (publicKey) {
  if (!(publicKey && (publicKey instanceof PublicKey))) {
    throw new Error('Invalid public key')
  }

  const fingerprint = publicKey.getFingerprint()
  const primaryUser = await publicKey.getPrimaryUser()
  const users = publicKey.users
  const personas = []

  users.forEach((user, i) => {
    if (!user.userID) return

    const pe = new Persona(user.userID.name, [])
    pe.setIdentifier(user.userID.userID)
    pe.setDescription(user.userID.comment)
    pe.setEmailAddress(user.userID.email)

    if ('selfCertifications' in user && user.selfCertifications.length > 0) {
      const selfCertification = user.selfCertifications.sort((e1, e2) => e2.created.getTime() - e1.created.getTime())[0]

      if (selfCertification.revoked) {
        pe.revoke()
      }
      const notations = selfCertification.rawNotations
      pe.claims = notations
        .filter(
          ({ name, humanReadable }) =>
            humanReadable && (name === 'proof@ariadne.id' || name === 'proof@metacode.biz')
        )
        .map(
          ({ value }) =>
            new Claim(new TextDecoder().decode(value), `openpgp4fpr:${fingerprint}`)
        )
    }

    personas.push(pe)
  })

  const profile = new Profile(ProfileType.OPENPGP, `openpgp4fpr:${fingerprint}`, personas)
  profile.primaryPersonaIndex = primaryUser.index

  profile.publicKey.keyType = PublicKeyType.OPENPGP
  profile.publicKey.fingerprint = fingerprint
  profile.publicKey.encoding = PublicKeyEncoding.ARMORED_PGP
  profile.publicKey.encodedKey = publicKey.armor()
  profile.publicKey.key = publicKey

  return profile
}
