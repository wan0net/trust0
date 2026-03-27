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
 * OpenCollective service provider ({@link https://docs.keyoxide.org/service-providers/opencollective/|Keyoxide docs})
 * @module serviceProviders/opencollective
 * @example
 * import { ServiceProviderDefinitions } from 'doipjs';
 * const sp = ServiceProviderDefinitions.data.opencollective.processURI('https://opencollective.com/alice');
 */

import * as E from '../enums.js'
import { ServiceProvider } from '../serviceProvider.js'

export const reURI = /^https:\/\/opencollective\.com\/(.*)\/?/

/**
 * @function
 * @param {string} uri - Claim URI to process
 * @returns {ServiceProvider} The service provider information based on the claim URI
 */
export function processURI (uri) {
  const match = uri.match(reURI)

  return new ServiceProvider({
    about: {
      id: 'opencollective',
      name: 'Open Collective',
      homepage: 'https://opencollective.com'
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
        uri,
        fetcher: E.Fetcher.GRAPHQL,
        accessRestriction: E.ProofAccessRestriction.NOCORS,
        data: {
          url: 'https://api.opencollective.com/graphql/v2',
          query: `{ "query": "query { account(slug: \\"${match[1]}\\") { longDescription } }" }`
        }
      },
      response: {
        format: E.ProofFormat.JSON
      },
      target: [{
        format: E.ClaimFormat.URI,
        encoding: E.EntityEncodingFormat.PLAIN,
        relation: E.ClaimRelation.CONTAINS,
        path: ['data', 'account', 'longDescription']
      }]
    }
  })
}

export const tests = [
  {
    uri: 'https://opencollective.com/Alice',
    shouldMatch: true
  },
  {
    uri: 'https://opencollective.com/Alice/',
    shouldMatch: true
  },
  {
    uri: 'https://domain.org/Alice',
    shouldMatch: false
  }
]
