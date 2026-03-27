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
import { CleartextMessage, PublicKey, readCleartextMessage, verify } from 'openpgp'
import { Claim } from './claim.js'
import { fetchURI } from './openpgp.js'
import { Profile } from './profile.js'
import { ProfileType, PublicKeyEncoding, PublicKeyType } from './enums.js'
import { Persona } from './persona.js'

/**
 * @module signatures
 */

/**
 * Extract the profile from a signature and fetch the associated key
 * @param {string} signature - The plaintext signature to parse
 * @returns {Promise<Profile>} The profile obtained from the signature
 */
export async function parse (signature) {
  /** @type {CleartextMessage} */
  let sigData

  // Read the signature
  try {
    sigData = await readCleartextMessage({
      cleartextMessage: signature
    })
  } catch (e) {
    throw new Error(`Signature could not be read (${e.message})`)
  }

  // @ts-ignore
  const issuerKeyID = sigData.signature.packets[0].issuerKeyID.toHex()
  // @ts-ignore
  const signersUserID = sigData.signature.packets[0].signersUserID
  const preferredKeyServer =
  // @ts-ignore
    sigData.signature.packets[0].preferredKeyServer ||
    'https://keys.openpgp.org/'
  const text = sigData.getText()
  const sigKeys = []
  const claims = []

  text.split('\n').forEach((line, i) => {
    const match = line.match(/^([a-zA-Z0-9]*)=(.*)$/i)
    if (!match) {
      return
    }
    switch (match[1].toLowerCase()) {
      case 'key':
        sigKeys.push(match[2])
        break

      case 'proof':
        claims.push(new Claim(match[2]))
        break

      default:
        break
    }
  })

  const obtainedKey = {
    query: null,
    data: null,
    method: null
  }

  // Try key identifier found in the signature
  if (sigKeys.length > 0) {
    try {
      obtainedKey.query = sigKeys[0]
      /** @type {PublicKey} */
      obtainedKey.data = (await fetchURI(obtainedKey.query)).publicKey.key
      obtainedKey.method = obtainedKey.query.split(':')[0]
    } catch (e) {}
  }
  // Try WKD
  if (!obtainedKey.data && signersUserID) {
    try {
      obtainedKey.query = signersUserID
      obtainedKey.data = (await fetchURI(`wkd:${signersUserID}`)).publicKey.key
      obtainedKey.method = 'wkd'
    } catch (e) {}
  }
  // Try HKP
  if (!obtainedKey.data) {
    try {
      const match = preferredKeyServer.match(/^(.*:\/\/)?([^/]*)(?:\/)?$/i)
      obtainedKey.query = issuerKeyID || signersUserID
      obtainedKey.data = (await fetchURI(`hkp:${match[2]}:${obtainedKey.query}`)).publicKey.key
      obtainedKey.method = 'hkp'
    } catch (e) {
      throw new Error('Public key not found')
    }
  }

  const primaryUserData = await obtainedKey.data.getPrimaryUser()
  const fingerprint = obtainedKey.data.getFingerprint()

  // Verify the signature
  const verificationResult = await verify({
    // @ts-ignore
    message: sigData,
    verificationKeys: obtainedKey.data
  })
  const { verified } = verificationResult.signatures[0]
  try {
    await verified
  } catch (e) {
    throw new Error(`Signature could not be verified (${e.message})`)
  }

  // Build the persona
  const persona = new Persona(primaryUserData.user.userID.name, [])
  persona.setIdentifier(primaryUserData.user.userID.userID)
  persona.setDescription(primaryUserData.user.userID.comment || null)
  persona.setEmailAddress(primaryUserData.user.userID.email || null)
  persona.claims = claims
    .map(
      ({ value }) =>
        new Claim(new TextDecoder().decode(value), `openpgp4fpr:${fingerprint}`)
    )

  const profile = new Profile(ProfileType.OPENPGP, `openpgp4fpr:${fingerprint}`, [persona])

  profile.publicKey.keyType = PublicKeyType.OPENPGP
  profile.publicKey.encoding = PublicKeyEncoding.ARMORED_PGP
  profile.publicKey.encodedKey = obtainedKey.data.armor()
  profile.publicKey.key = obtainedKey.data
  profile.publicKey.fetch.method = obtainedKey.method
  profile.publicKey.fetch.query = obtainedKey.query

  return profile
}
