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
 * Lobste.rs service provider ({@link https://docs.keyoxide.org/service-providers/lobsters/|Keyoxide docs})
 * @module serviceProviders/lobsters
 * @example
 * import { ServiceProviderDefinitions } from 'doipjs';
 * const sp = ServiceProviderDefinitions.data.lobsters.processURI('https://lobste.rs/~alice');
 */

import * as E from '../enums.js'
import { ServiceProvider } from '../serviceProvider.js'

export const reURI = /^https:\/\/lobste\.rs\/(?:~|u\/)(.*)\/?/

/**
 * @function
 * @param {string} uri - Claim URI to process
 * @returns {ServiceProvider} The service provider information based on the claim URI
 */
export function processURI (uri) {
  const match = uri.match(reURI)

  return new ServiceProvider({
    about: {
      id: 'lobsters',
      name: 'Lobsters',
      homepage: 'https://lobste.rs'
    },
    profile: {
      display: match[1],
      uri: `https://lobste.rs/~${match[1]}`,
      qr: null
    },
    claim: {
      uriRegularExpression: reURI.toString(),
      uriIsAmbiguous: false
    },
    proof: {
      request: {
        uri: `https://lobste.rs/~${match[1]}.json`,
        fetcher: E.Fetcher.HTTP,
        accessRestriction: E.ProofAccessRestriction.NOCORS,
        data: {
          url: `https://lobste.rs/~${match[1]}.json`,
          format: E.ProofFormat.JSON
        }
      },
      response: {
        format: E.ProofFormat.JSON
      },
      target: [{
        format: E.ClaimFormat.URI,
        encoding: E.EntityEncodingFormat.PLAIN,
        relation: E.ClaimRelation.CONTAINS,
        path: ['about']
      }]
    }
  })
}

export const tests = [
  {
    uri: 'https://lobste.rs/~Alice',
    shouldMatch: true
  },
  {
    uri: 'https://lobste.rs/u/Alice',
    shouldMatch: true
  },
  {
    uri: 'https://lobste.rs/u/Alice/',
    shouldMatch: true
  },
  {
    uri: 'https://domain.org/~Alice',
    shouldMatch: false
  },
  {
    uri: 'https://domain.org/u/Alice',
    shouldMatch: false
  }
]
