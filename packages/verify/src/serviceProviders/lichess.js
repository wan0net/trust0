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
 * Lichess service provider ({@link https://docs.keyoxide.org/service-providers/lichess/|Keyoxide docs})
 * @module serviceProviders/lichess
 * @example
 * import { ServiceProviderDefinitions } from 'doipjs';
 * const sp = ServiceProviderDefinitions.data.lichess.processURI('https://lichess.org/@/alice');
 */

import * as E from '../enums.js'
import { ServiceProvider } from '../serviceProvider.js'

export const reURI = /^https:\/\/lichess\.org\/@\/(.*)\/?/

/**
 * @function
 * @param {string} uri - Claim URI to process
 * @returns {ServiceProvider} The service provider information based on the claim URI
 */
export function processURI (uri) {
  const match = uri.match(reURI)

  return new ServiceProvider({
    about: {
      id: 'lichess',
      name: 'Lichess',
      homepage: 'https://lichess.org'
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
        uri: `https://lichess.org/api/user/${match[1]}`,
        fetcher: E.Fetcher.HTTP,
        accessRestriction: E.ProofAccessRestriction.NONE,
        data: {
          url: `https://lichess.org/api/user/${match[1]}`,
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
        path: ['profile', 'links']
      }]
    }
  })
}

export const tests = [
  {
    uri: 'https://lichess.org/@/Alice',
    shouldMatch: true
  },
  {
    uri: 'https://lichess.org/@/Alice/',
    shouldMatch: true
  },
  {
    uri: 'https://domain.org/@/Alice',
    shouldMatch: false
  }
]
