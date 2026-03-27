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
 * Github service provider ({@link https://docs.keyoxide.org/service-providers/github/|Keyoxide docs})
 * @module serviceProviders/github
 * @example
 * import { ServiceProviderDefinitions } from 'doipjs';
 * const sp = ServiceProviderDefinitions.data.github.processURI('https://gist.github.com/alice/title');
 */

import * as E from '../enums.js'
import { ServiceProvider } from '../serviceProvider.js'

export const reURI = /^https:\/\/gist\.github\.com\/(.*)\/(.*)\/?/

/**
 * @function
 * @param {string} uri - Claim URI to process
 * @returns {ServiceProvider} The service provider information based on the claim URI
 */
export function processURI (uri) {
  const match = uri.match(reURI)

  return new ServiceProvider({
    about: {
      id: 'github',
      name: 'GitHub',
      homepage: 'https://github.com'
    },
    profile: {
      display: match[1],
      uri: `https://github.com/${match[1]}`,
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
        accessRestriction: E.ProofAccessRestriction.NONE,
        data: {
          url: `https://api.github.com/gists/${match[2]}`,
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
          path: ['files', 'proof.md', 'content']
        },
        {
          format: E.ClaimFormat.URI,
          encoding: E.EntityEncodingFormat.PLAIN,
          relation: E.ClaimRelation.CONTAINS,
          path: ['files', 'openpgp.md', 'content']
        }
      ]
    }
  })
}

export const tests = [
  {
    uri: 'https://gist.github.com/Alice/123456789',
    shouldMatch: true
  },
  {
    uri: 'https://gist.github.com/Alice/123456789/',
    shouldMatch: true
  },
  {
    uri: 'https://domain.org/Alice/123456789',
    shouldMatch: false
  }
]
