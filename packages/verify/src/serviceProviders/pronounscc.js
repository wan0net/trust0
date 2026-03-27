/*
Copyright 2024 Tyler Beckman

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
 * pronouns.cc service provider
 * @module serviceProviders/pronounscc
 * @example
 * import { ServiceProviderDefinitions } from 'doipjs';
 * const sp = ServiceProviderDefinitions.data.pronounscc.processURI('https://pronouns.cc/@Alice');
 */

import * as E from '../enums.js'
import { ServiceProvider } from '../serviceProvider.js'

export const reURI = /^https:\/\/pronouns\.cc\/@(.*)\/?/

/**
 * @function
 * @param {string} uri - Claim URI to process
 * @returns {ServiceProvider} The service provider information based on the claim URI
 */
export function processURI (uri) {
  const match = uri.match(reURI)

  return new ServiceProvider({
    about: {
      id: 'pronounscc',
      name: 'pronouns.cc',
      homepage: 'https://pronouns.cc'
    },
    profile: {
      display: `@${match[1]}`,
      uri: `https://pronouns.cc/@${match[1]}`,
      qr: null
    },
    claim: {
      uriRegularExpression: reURI.toString(),
      uriIsAmbiguous: false
    },
    proof: {
      request: {
        uri,
        fetcher: E.Fetcher.HTTP,
        accessRestriction: E.ProofAccessRestriction.NOCORS,
        data: {
          url: `https://pronouns.cc/api/v1/users/${match[1]}`,
          format: E.ProofFormat.JSON
        }
      },
      response: {
        format: E.ProofFormat.JSON
      },
      target: [
        {
          format: E.ClaimFormat.URI,
          encoding: E.EntityEncodingFormat.PLAIN,
          relation: E.ClaimRelation.CONTAINS,
          path: ['links']
        },
        {
          format: E.ClaimFormat.URI,
          encoding: E.EntityEncodingFormat.PLAIN,
          relation: E.ClaimRelation.CONTAINS,
          path: ['bio']
        }
      ]
    }
  })
}

export const tests = [
  {
    uri: 'https://pronouns.cc/@Alice',
    shouldMatch: true
  },
  {
    uri: 'https://pronouns.cc/@Alice/',
    shouldMatch: true
  },
  {
    uri: 'https://pronouns.cc/Alice',
    shouldMatch: false
  },
  {
    uri: 'https://pronouns.cc/Alice/',
    shouldMatch: false
  }
]
