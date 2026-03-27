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
 * Twitter service provider ({@link https://docs.keyoxide.org/service-providers/twitter/|Keyoxide docs})
 * @module serviceProviders/twitter
 * @example
 * import { ServiceProviderDefinitions } from 'doipjs';
 * const sp = ServiceProviderDefinitions.data.twitter.processURI('https://twitter.com/alice/status/123456789');
 */

import * as E from '../enums.js'
import { ServiceProvider } from '../serviceProvider.js'

export const reURI = /^https:\/\/twitter\.com\/(.*)\/status\/([0-9]*)(?:\?.*)?/

/**
 * @function
 * @param {string} uri - Claim URI to process
 * @returns {ServiceProvider} The service provider information based on the claim URI
 */
export function processURI (uri) {
  const match = uri.match(reURI)

  const urlsp = new URLSearchParams()
  urlsp.set('url', match[0])
  urlsp.set('omit_script', '1')

  return new ServiceProvider({
    about: {
      id: 'twitter',
      name: 'Twitter',
      homepage: 'https://twitter.com'
    },
    profile: {
      display: `@${match[1]}`,
      uri: `https://twitter.com/${match[1]}`,
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
          // Returns an oembed json object with the tweet content in html form
          url: `https://publish.twitter.com/oembed?${urlsp}`,
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
        path: ['html']
      }]
    }
  })
}

export const tests = [
  {
    uri: 'https://twitter.com/alice/status/1234567890123456789',
    shouldMatch: true
  },
  {
    uri: 'https://twitter.com/alice/status/1234567890123456789/',
    shouldMatch: true
  },
  {
    uri: 'https://domain.org/alice/status/1234567890123456789',
    shouldMatch: false
  }
]
