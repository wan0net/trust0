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
/**
 * Keybase service provider ({@link https://docs.keyoxide.org/service-providers/keybase/|Keyoxide docs})
 * @module serviceProviders/keybase
 * @example
 * import { ServiceProviderDefinitions } from 'doipjs';
 * const sp = ServiceProviderDefinitions.data.keybase.processURI('https://keybase.io/alice');
 */

import * as E from '../enums.js'
import { ServiceProvider } from '../serviceProvider.js'

export const reURI = /^https:\/\/keybase.io\/(.*)\/?/

/**
 * @function
 * @param {string} uri - Claim URI to process
 * @returns {ServiceProvider} The service provider information based on the claim URI
 */
export function processURI (uri) {
  const match = uri.match(reURI)

  return new ServiceProvider({
    about: {
      id: 'keybase',
      name: 'keybase',
      homepage: 'https://keybase.io'
    },
    profile: {
      display: match[1],
      uri,
      qr: null
    },
    claim: {
      uriRegularExpression: reURI.toString(),
      uriIsAmbiguous: false
    },
    proof: {
      request: {
        uri: `https://keybase.io/_/api/1.0/user/lookup.json?username=${match[1]}`,
        fetcher: E.Fetcher.HTTP,
        accessRestriction: E.ProofAccessRestriction.NOCORS,
        data: {
          url: `https://keybase.io/_/api/1.0/user/lookup.json?username=${match[1]}`,
          format: E.ProofFormat.JSON
        }
      },
      response: {
        format: E.ProofFormat.JSON
      },
      target: [{
        format: E.ClaimFormat.FINGERPRINT,
        encoding: E.EntityEncodingFormat.PLAIN,
        relation: E.ClaimRelation.CONTAINS,
        path: ['them', 'public_keys', 'primary', 'key_fingerprint']
      }]
    }
  })
}

export const tests = [
  {
    uri: 'https://keybase.io/Alice',
    shouldMatch: true
  },
  {
    uri: 'https://keybase.io/Alice/',
    shouldMatch: true
  },
  {
    uri: 'https://domain.org/Alice',
    shouldMatch: false
  }
]
