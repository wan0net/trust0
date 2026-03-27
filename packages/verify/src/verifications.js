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
import { generateClaim, getUriFromString } from './utils.js'
import { ClaimFormat, EntityEncodingFormat, ClaimRelation, ProofFormat } from './enums.js'
import { bcryptVerify, argon2Verify } from 'hash-wasm'
import { decodeHTML, decodeXML } from 'entities'
import { ServiceProvider } from './serviceProvider.js'

/**
 * @module verifications
 * @ignore
 */

/**
 * Check if string contains the proof
 * @function
 * @param {string} data - Data potentially containing the proof
 * @param {import('./types').VerificationParams} params - Verification parameters
 * @returns {Promise<boolean>} Whether the proof was found in the string
 */
const containsProof = async (data, params) => {
  const fingerprintFormatted = generateClaim(params.target, params.claimFormat)
  const fingerprintURI = generateClaim(params.target, ClaimFormat.URI)
  let result = false

  // Decode eventual special entities
  switch (params.proofEncodingFormat) {
    case EntityEncodingFormat.HTML:
      data = decodeHTML(data)
      break

    case EntityEncodingFormat.XML:
      data = decodeXML(data)
      break

    case EntityEncodingFormat.PLAIN:
    default:
      break
  }
  data = decodeHTML(data)

  // Check for plaintext proof
  result = data
    // remove newlines and carriage returns
    .replace(/\r?\n|\r/g, '')
    // remove spaces
    .replace(/\s/g, '')
    // normalize
    .toLowerCase()
    // search for fingerprint
    .indexOf(fingerprintFormatted.toLowerCase()) !== -1

  // Check for hashed proof
  if (!result) {
    const hashRe = /\$(argon2(?:id|d|i)|2a|2b|2y)(?:\$[a-zA-Z0-9=+\-,./]+)+/g
    let match

    while (!result && (match = hashRe.exec(data)) != null) {
      let timeoutHandle
      const timeoutPromise = new Promise((resolve, reject) => {
        timeoutHandle = setTimeout(
          () => {
            resolve(false)
          }, 1000
        )
      })

      switch (match[1]) {
        case '2a':
        case '2b':
        case '2y':
          try {
            // Patch until promise.race properly works on WASM
            if (parseInt(match[0].split('$')[2]) > 12) continue

            const hashPromise = bcryptVerify({
              password: fingerprintURI.toLowerCase(),
              hash: match[0]
            })
              .then(result => result)
              .catch(_ => false)

            result = await Promise.race([hashPromise, timeoutPromise]).then((result) => {
              clearTimeout(timeoutHandle)
              return result
            })
          } catch (err) {
            result = false
          }

          // Accept mixed-case fingerprints until deadline
          if (!result) {
            try {
              // Patch until promise.race properly works on WASM
              if (parseInt(match[0].split('$')[2]) > 12) continue

              const hashPromise = bcryptVerify({
                password: fingerprintURI,
                hash: match[0]
              })
                .then(result => result)
                .catch(_ => false)

              result = await Promise.race([hashPromise, timeoutPromise]).then((result) => {
                clearTimeout(timeoutHandle)
                return result
              })
            } catch (err) {
              result = false
            }
          }
          break

        case 'argon2':
        case 'argon2i':
        case 'argon2d':
        case 'argon2id':
          try {
            const hashPromise = argon2Verify({
              password: fingerprintURI.toLowerCase(),
              hash: match[0]
            })
              .then(result => result)
              .catch(_ => false)

            result = await Promise.race([hashPromise, timeoutPromise]).then((result) => {
              clearTimeout(timeoutHandle)
              return result
            })
          } catch (err) {
            result = false
          }

          // Accept mixed-case fingerprints until deadline
          if (!result) {
            try {
              const hashPromise = argon2Verify({
                password: fingerprintURI,
                hash: match[0]
              })
                .then(result => result)
                .catch(_ => false)

              result = await Promise.race([hashPromise, timeoutPromise]).then((result) => {
                clearTimeout(timeoutHandle)
                return result
              })
            } catch (err) {
              result = false
            }
          }
          break

        default:
      }
    }
  }

  // Check for HTTP proof
  if (!result) {
    const uris = getUriFromString(data)

    for (let index = 0; index < uris.length; index++) {
      if (result) continue

      const candidate = uris[index]
      /** @type {URL} */
      let candidateURL

      try {
        candidateURL = new URL(candidate)
      } catch (_) {
        continue
      }

      if (candidateURL.protocol !== 'https:') {
        continue
      }

      // Using fetch -> axios doesn't find the ariadne-identity-proof header
      /** @type {Response} */
      const response = await fetch(candidate, {
        method: 'HEAD'
      })
        .catch(e => {
          return undefined
        })

      if (!response) continue
      if (response.status !== 200) continue
      if (!response.headers.get('ariadne-identity-proof')) continue

      result = response.headers.get('ariadne-identity-proof')
        .toLowerCase()
        .indexOf(fingerprintURI.toLowerCase()) !== -1
    }
  }

  return result
}

/**
 * Run a JSON object through the verification process
 * @function
 * @param {*} proofData - Data potentially containing the proof
 * @param {Array<string>} checkPath - Paths to check for proof
 * @param {import('./types').VerificationParams} params - Verification parameters
 * @returns {Promise<boolean>} Whether the proof was found in the object
 */
const runJSON = async (proofData, checkPath, params) => {
  if (!proofData) {
    return false
  }

  if (typeof proofData === 'object' && !Array.isArray(proofData) && checkPath[0] === '*') {
    return runJSON(Object.values(proofData), checkPath.slice(1), params)
  }

  if (Array.isArray(proofData)) {
    let result = false

    for (let index = 0; index < proofData.length; index++) {
      const item = proofData[index]

      if (result) {
        continue
      }

      result = await runJSON(item, checkPath, params)
    }

    return result
  }

  if (checkPath.length === 0) {
    switch (params.claimRelation) {
      case ClaimRelation.ONEOF:
        return containsProof(proofData.join('|'), params)

      case ClaimRelation.CONTAINS:
      case ClaimRelation.EQUALS:
      default:
        return containsProof(proofData, params)
    }
  }

  if (typeof proofData === 'object' && !(checkPath[0] in proofData)) {
    throw new Error('err_json_structure_incorrect')
  }

  return runJSON(
    proofData[checkPath[0]],
    checkPath.slice(1),
    params
  )
}

/**
 * Run the verification by searching for the proof in the fetched data
 * @param {object} proofData - The proof data
 * @param {ServiceProvider} claimData - The claim data
 * @param {string} fingerprint - The fingerprint
 * @returns {Promise<import('./types').VerificationResult>} Result of the verification
 */
export async function run (proofData, claimData, fingerprint) {
  /** @type {import('./types').VerificationResult} */
  const res = {
    result: false,
    completed: false,
    errors: []
  }

  switch (claimData.proof.response.format) {
    case ProofFormat.JSON:
      for (let index = 0; index < claimData.proof.target.length; index++) {
        const claimMethod = claimData.proof.target[index]
        try {
          res.result = res.result || await runJSON(
            proofData,
            claimMethod.path,
            {
              target: fingerprint,
              claimFormat: claimMethod.format,
              proofEncodingFormat: claimMethod.encoding,
              claimRelation: claimMethod.relation
            }
          )
        } catch (error) {
          res.errors.push(error.message ? error.message : error)
        }
      }
      res.completed = true
      break
    case ProofFormat.TEXT:
      for (let index = 0; index < claimData.proof.target.length; index++) {
        const claimMethod = claimData.proof.target[index]
        try {
          res.result = res.result || await containsProof(
            proofData,
            {
              target: fingerprint,
              claimFormat: claimMethod.format,
              proofEncodingFormat: claimMethod.encoding,
              claimRelation: claimMethod.relation
            }
          )
        } catch (error) {
          res.errors.push('err_unknown_text_verification')
        }
      }
      res.completed = true
      break
  }

  // Reset the errors if one of the claim methods was successful
  if (res.result) {
    res.errors = []
  }

  return res
}
